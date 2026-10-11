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

import type { SafeHTML } from './interfaces/helpers.js';
import type { Handler, Middleware } from './types.js';

export function createMiddleware<T extends Middleware>(middleware: T): T {
  return middleware;
}

export function factory<T extends readonly Handler[]>(...handlers: T): T {
  return handlers;
}

function escape(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function raw(value: string): SafeHTML {
  return {
    __html: value,
    toString() {
      return value;
    },
  };
}

export function htmlTemplate(strings: TemplateStringsArray, ...values: unknown[]): SafeHTML {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];

    if (i < values.length) {
      const v = values[i];
      if (v && typeof v === 'object' && '__html' in (v as Record<string, unknown>)) {
        out += (v as SafeHTML).__html;
      } else if (Array.isArray(v)) {
        out += v
          .map((x) =>
            x && typeof x === 'object' && '__html' in (x as Record<string, unknown>)
              ? (x as SafeHTML).__html
              : escape(x),
          )
          .join('');
      } else {
        out += escape(v);
      }
    }
  }

  return raw(out);
}

export function accepts(request: Request, types: string[]): string | undefined {
  const header = request.headers.get('accept') ?? '*/*';
  if (header === '*/*') {
    return types[0];
  }

  const entries = header
    .split(',')
    .map((p) => {
      const [t, ...params] = p.split(';');
      const q = params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? '1';
      return { t: t.trim(), q: parseFloat(q) };
    })
    .sort((a, b) => b.q - a.q);

  for (const e of entries) {
    for (const type of types) {
      const [t] = type.split(';');
      if (e.t === '*/*' || e.t === t || (e.t.endsWith('/*') && t.startsWith(e.t.slice(0, -1)))) {
        return type;
      }
    }
  }

  return undefined;
}

export function acceptsEncoding(request: Request, encodings: string[]): string | undefined {
  const header = request.headers.get('accept-encoding') ?? '';
  const entries = header.split(',').map((x) => x.trim().split(';')[0]);
  return encodings.find((x) => entries.includes(x) || entries.includes('*'));
}

export async function proxy(
  target: string | URL,
  request: Request,
  options: {
    rewritePath?: (pathname: string) => string;
    headers?: HeadersInit;
    fetch?: typeof fetch;
  } = {},
): Promise<Response> {
  const from = new URL(request.url),
    to = new URL(target);
  to.pathname = options.rewritePath?.(from.pathname) ?? from.pathname;
  to.search = from.search;

  const headers = new Headers(request.headers);
  new Headers(options.headers).forEach((v, k) => headers.set(k, v));
  headers.delete('host');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: request.signal,
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.clone().arrayBuffer();
  }

  return (options.fetch ?? fetch)(to, init);
}

export function streamText(source: AsyncIterable<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of source) {
          controller.enqueue(encoder.encode(chunk));
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export function cacheKey(request: Request, vary: string[] = []): string {
  const url = new URL(request.url);
  const parts = [request.method, url.origin + url.pathname + url.search];

  for (const h of vary) {
    parts.push(`${h.toLowerCase()}:${request.headers.get(h) ?? ''}`);
  }

  return parts.join('|');
}

export class MemoryCache {
  private store = new Map<string, { expires: number; response: Response }>();

  async match(key: string): Promise<Response | undefined> {
    const hit = this.store.get(key);
    if (!hit) {
      return undefined;
    }

    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return hit.response.clone();
  }

  async put(key: string, response: Response, ttlMs: number): Promise<void> {
    this.store.set(key, { expires: Date.now() + ttlMs, response: response.clone() });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export function cacheMiddleware(options: {
  ttlMs: number;
  cache?: MemoryCache;
  key?: (request: Request) => string;
}): Middleware {
  const cache = options.cache ?? new MemoryCache();
  return async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      return next();
    }

    const key = options.key?.(c.request) ?? cacheKey(c.request);
    const hit = await cache.match(key);

    if (hit) {
      c.res = hit;
      return hit;
    }

    await next();
    if (c.res?.ok) {
      await cache.put(key, c.res, options.ttlMs);
    }
  };
}
