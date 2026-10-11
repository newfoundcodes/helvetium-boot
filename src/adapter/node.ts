/*
 * Helvetium Boot - Helvetium Framework, A Newfoundcodes project.
 *
 * Copyright (C) 2026 Jonathan Eldy Baldivicio
 *
 * Author: Jonathan Eldy Baldivicio
 * Contact: jonathaneldy.baldivicio@newfoundcodes.com
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import type { WebSocketData } from '../websocket.js';
import type { IncomingMessage } from 'node:http';
import type { ServerResponse } from 'node:http';
import type {
  NodeApplication,
  NodeServeOptions,
  NodeServerHandle,
  NodeStaticContext,
} from '../interfaces/node.js';
import type {
  BootWebSocket,
  WebSocketHandlerContext,
  WebSocketHandlers,
} from '../interfaces/websocket.js';

export type NodeStaticMiddleware = (
  context: NodeStaticContext,
  next: () => Promise<Response | void>,
) => Response | void | Promise<Response | void>;

async function readNodeBody(
  req: { method?: string } & AsyncIterable<Uint8Array>,
  limit: number,
): Promise<Uint8Array | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const chunk of req) {
    const bytes =
      typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk);

    total += bytes.byteLength;
    if (total > limit) {
      throw Object.assign(new Error('Body too large'), { status: 413 });
    }

    chunks.push(bytes);
  }

  if (!total) {
    return undefined;
  }

  const out = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return out;
}

function nodeRequestURL(
  req: { headers: Record<string, string | string[] | undefined>; url?: string },
  trustProxy: boolean,
): string {
  const proto = trustProxy
    ? String(req.headers['x-forwarded-proto'] ?? 'http')
        .split(',')[0]
        .trim()
    : 'http';

  const host = trustProxy
    ? String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost')
        .split(',')[0]
        .trim()
    : String(req.headers.host ?? 'localhost');
  return `${proto}://${host}${req.url ?? '/'}`;
}

export async function toWebRequest(
  req: {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
  } & AsyncIterable<Uint8Array>,
  options: { maxBodyBytes?: number; trustProxy?: boolean } = {},
): Promise<Request> {
  const body = await readNodeBody(req, options.maxBodyBytes ?? 16 * 1024 * 1024);
  const headers = new Headers();

  for (const [k, v] of Object.entries(req.headers as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        headers.append(k, String(item));
      }
    } else if (v !== undefined) {
      headers.set(k, String(v));
    }
  }

  return new Request(nodeRequestURL(req, options.trustProxy ?? false), {
    method: req.method,
    headers,
    body: body as unknown as ReadableStream,
    signal: undefined,
  });
}

export async function writeNodeResponse(
  response: Response,
  res: {
    statusCode: number;
    statusMessage: string;
    setHeader: Function;
    end: Function;
    write: Function;
  },
): Promise<void> {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;

  const setCookies = (
    response.headers as unknown as { getSetCookie?: () => string[] }
  ).getSetCookie?.();

  response.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'set-cookie') {
      res.setHeader(k, v);
    }
  });

  if (setCookies?.length) {
    res.setHeader('set-cookie', setCookies);
  } else {
    const sc = response.headers.get('set-cookie');
    if (sc) {
      res.setHeader('set-cookie', sc);
    }
  }

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      res.write(value);
    }
  } finally {
    res.end();
  }
}

export function nodeHandler(
  app: Pick<NodeApplication, 'fetch'>,
  options: { maxBodyBytes?: number; trustProxy?: boolean } = {},
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    void (async () => {
      try {
        const request = await toWebRequest(
          req as unknown as {
            method?: string;
            url?: string;
            headers: Record<string, string | string[] | undefined>;
          } & AsyncIterable<Uint8Array>,
          options,
        );

        const response = await app.fetch(request);
        await writeNodeResponse(response, res);
      } catch (err: unknown) {
        const error = err as Record<string, unknown>;
        const status = typeof error.status === 'number' ? error.status : 500;

        res.statusCode = status;
        res.setHeader('content-type', 'application/json');

        res.end(
          JSON.stringify({
            error:
              res.statusCode === 500
                ? 'Internal Server Error'
                : (error?.message ?? 'Request failed'),
          }),
        );
      }
    })();
  };
}

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function acceptKey(key: string): string {
  return createHash('sha1')
    .update(key + WS_GUID)
    .digest('base64');
}

function concat(
  a: Uint8Array<ArrayBufferLike>,
  b: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);

  out.set(a);
  out.set(b, a.length);
  return out;
}

function frame(opcode: number, payload: Uint8Array, fin = true): Uint8Array {
  let header: number;
  if (payload.length < 126) {
    header = 2;
  } else if (payload.length <= 65535) {
    header = 4;
  } else {
    header = 10;
  }

  const out = new Uint8Array(header + payload.length);
  out[0] = (fin ? 0x80 : 0) | opcode;

  if (payload.length < 126) {
    out[1] = payload.length;
  } else if (payload.length <= 65535) {
    out[1] = 126;
    out[2] = (payload.length >>> 8) & 255;
    out[3] = payload.length & 255;
  } else {
    out[1] = 127;

    const view = new DataView(out.buffer);
    view.setBigUint64(2, BigInt(payload.length));
  }

  out.set(payload, header);
  return out;
}

function bytes(data: WebSocketData): Uint8Array {
  return typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
}

class NodeWebSocket implements BootWebSocket {
  readyState: 0 | 1 | 2 | 3 = 1;
  readonly protocol: string;
  private buffer = new Uint8Array();
  private fragments: Uint8Array[] = [];
  private fragmentOpcode = 0;

  constructor(
    private socket: { on: Function; write: Function; destroy: Function; end: Function },
    protocol: string,
    private handlers: WebSocketHandlers,
    private context: WebSocketHandlerContext,
    private maxPayload: number,
  ) {
    this.protocol = protocol;

    socket.on('data', (chunk: Uint8Array) => this.ingest(new Uint8Array(chunk)));
    socket.on('close', () => this.finishClose(1006, '', false));
    socket.on('error', (e: unknown) => void handlers.error?.(e, this, context));
  }

  send(data: WebSocketData): void {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }

    this.socket.write(frame(typeof data === 'string' ? 1 : 2, bytes(data)));
  }

  ping(data: WebSocketData = ''): void {
    if (this.readyState === 1) {
      this.socket.write(frame(9, bytes(data)));
    }
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState >= 2) {
      return;
    }

    this.readyState = 2;

    const reasonBytes = new TextEncoder().encode(reason);
    const p = new Uint8Array(2 + reasonBytes.length);

    new DataView(p.buffer).setUint16(0, code);
    p.set(reasonBytes, 2);

    this.socket.write(frame(8, p));
    this.socket.end();
  }

  private ingest(chunk: Uint8Array<ArrayBufferLike>): void {
    this.buffer = concat(this.buffer, chunk);

    try {
      while (this.readFrame()) {}
    } catch (error) {
      void this.handlers.error?.(error, this, this.context);
      this.close(1002, 'Protocol error');
    }
  }

  private readFrame(): boolean {
    const b = this.buffer;
    if (b.length < 2) {
      return false;
    }

    const fin = !!(b[0] & 0x80),
      opcode = b[0] & 0x0f,
      masked = !!(b[1] & 0x80);
    let len = b[1] & 0x7f,
      offset = 2;

    if (!masked) {
      throw new Error('Client frames must be masked');
    }

    if (len === 126) {
      if (b.length < 4) {
        return false;
      }

      len = (b[2] << 8) | b[3];
      offset = 4;
    } else if (len === 127) {
      if (b.length < 10) {
        return false;
      }

      const big = new DataView(b.buffer, b.byteOffset, b.byteLength).getBigUint64(2);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('Frame too large');
      }

      len = Number(big);
      offset = 10;
    }

    if (len > this.maxPayload) {
      throw new Error('WebSocket payload exceeds limit');
    }

    if (b.length < offset + 4 + len) {
      return false;
    }

    const mask = b.slice(offset, offset + 4);
    offset += 4;

    const payload = b.slice(offset, offset + len);
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }

    this.buffer = b.slice(offset + len);
    this.handleFrame(fin, opcode, payload);
    return this.buffer.length >= 2;
  }

  private handleFrame(fin: boolean, opcode: number, payload: Uint8Array): void {
    if (opcode === 8) {
      let code = 1000,
        reason = '';

      if (payload.length >= 2) {
        code = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint16(0);
        reason = new TextDecoder().decode(payload.slice(2));
      }

      if (this.readyState === 1) {
        this.socket.write(frame(8, payload));
      }

      this.readyState = 3;
      this.socket.end();

      this.finishClose(code, reason, true);
      return;
    }

    if (opcode === 9) {
      this.socket.write(frame(10, payload));
      return;
    }

    if (opcode === 10) {
      return;
    }

    if (opcode === 0) {
      if (!this.fragmentOpcode) {
        throw new Error('Unexpected continuation frame');
      }

      this.fragments.push(payload);
      if (fin) {
        const data = this.fragments.reduce(concat, new Uint8Array());
        const op = this.fragmentOpcode;

        this.fragments = [];
        this.fragmentOpcode = 0;
        this.emitMessage(op, data);
      }

      return;
    }

    if (opcode !== 1 && opcode !== 2) {
      throw new Error('Unsupported opcode');
    }

    if (!fin) {
      this.fragmentOpcode = opcode;
      this.fragments = [payload];
      return;
    }

    this.emitMessage(opcode, payload);
  }

  private emitMessage(opcode: number, payload: Uint8Array): void {
    const data = opcode === 1 ? new TextDecoder().decode(payload) : payload;
    void this.handlers.message?.({ data, binary: opcode === 2 }, this, this.context);
  }

  private closed = false;

  private finishClose(code: number, reason: string, wasClean: boolean) {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.readyState = 3;

    void this.handlers.close?.({ code, reason, wasClean }, this, this.context);
  }
}

export async function upgrade(
  app: Pick<NodeApplication, 'websockets'>,
  req: { headers: Record<string, string | string[] | undefined>; url?: string; method?: string },
  socket: { write: Function; destroy: Function },
  head: unknown,
  maxPayload = 1048576,
): Promise<void> {
  const host = String(req.headers.host ?? 'localhost');
  const url = new URL(req.url ?? '/', `http://${host}`);
  const route = app.websockets?.match(url.pathname) ?? null;

  if (!route) {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'],
    version = req.headers['sec-websocket-version'];
  if (
    req.method !== 'GET' ||
    String(req.headers.upgrade).toLowerCase() !== 'websocket' ||
    !String(req.headers.connection ?? '')
      .toLowerCase()
      .split(',')
      .map((x: string) => x.trim())
      .includes('upgrade') ||
    typeof key !== 'string' ||
    version !== '13'
  ) {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const requested = String(req.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((x: string) => x.trim())
    .filter(Boolean);
  const protocol = requested[0] ?? '';

  let response =
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n`;
  if (protocol) {
    response += `Sec-WebSocket-Protocol: ${protocol}\r\n`;
  }

  response += '\r\n';
  socket.write(response);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) {
      headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
    }
  }

  const request = new Request(url, { headers });
  const context = { request, params: route.params };

  const ws = new NodeWebSocket(
    socket as unknown as { on: Function; write: Function; destroy: Function; end: Function },
    protocol,
    route.handlers,
    context,
    maxPayload,
  );

  const wsSocket = socket as unknown as {
    write: Function;
    destroy: Function;
    on: Function;
    end: Function;
    length?: number;
    unshift: Function;
  };

  if (!req.url || !req.method || !wsSocket.length) {
    wsSocket.unshift(head);
  }

  void route.handlers.open?.(ws, context);
}

export function serve(options: NodeServeOptions): NodeServerHandle {
  const hostname = options.hostname ?? '127.0.0.1';
  const server = createServer(
    nodeHandler(options.app, {
      maxBodyBytes: options.maxBodyBytes,
      trustProxy: options.trustProxy,
    }),
  );

  if (options.requestTimeout !== undefined) {
    server.requestTimeout = options.requestTimeout;
  }

  if (options.headersTimeout !== undefined) {
    server.headersTimeout = options.headersTimeout;
  }

  if (options.keepAliveTimeout !== undefined) {
    server.keepAliveTimeout = options.keepAliveTimeout;
  }

  if (options.maxHeadersCount !== undefined) {
    server.maxHeadersCount = options.maxHeadersCount;
  }

  if (options.websocket !== false && (options.app.websockets?.size ?? 0) > 0) {
    server.on('upgrade', (req: unknown, socket: unknown, head: unknown) =>
      upgrade(
        options.app,
        req as unknown as {
          headers: Record<string, string | string[] | undefined>;
          url?: string;
          method?: string;
        },
        socket as { write: Function; destroy: Function; end: Function; on: Function },
        head,
        options.maxWebSocketPayload,
      ),
    );
  }

  let currentURL = `http://${hostname}:${options.port ?? 3000}`;
  const ready = new Promise<string>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 3000, hostname, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 3000);

      currentURL = `http://${hostname}:${port}`;
      resolveReady(currentURL);
    });
  });
  return {
    server,
    get url() {
      return currentURL;
    },
    ready,
    close: () =>
      new Promise((resolveClose, reject) =>
        server.close((e: unknown) => (e ? reject(e) : resolveClose())),
      ),
  };
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
};

export function serveStatic(
  root: string,
  options: {
    index?: string;
    fallthrough?: boolean;
    maxAge?: number;
    immutable?: boolean;
    dotfiles?: boolean;
  } = {},
): NodeStaticMiddleware {
  const base = resolve(root);
  return async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      return next();
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(c.req.url).pathname);
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    if (!options.dotfiles && pathname.split('/').some((x) => x.startsWith('.') && x !== '.')) {
      return next();
    }

    let file = resolve(base, `.${pathname}`);
    if (file !== base && !file.startsWith(base + sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        file = resolve(file, options.index ?? 'index.html');
        info = await stat(file);
      }

      if (!info.isFile()) {
        return next();
      }

      const data = await readFile(file);
      const headers = new Headers({
        'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'content-length': String(data.byteLength),
        'last-modified': info.mtime.toUTCString(),
      });
      if (options.maxAge !== undefined) {
        headers.set(
          'cache-control',
          `public, max-age=${Math.floor(options.maxAge / 1000)}${options.immutable ? ', immutable' : ''}`,
        );
      }

      return new Response(c.req.method === 'HEAD' ? null : data, { headers });
    } catch {
      return options.fallthrough === false ? new Response('Not Found', { status: 404 }) : next();
    }
  };
}
