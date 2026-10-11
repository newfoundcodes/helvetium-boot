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

export function mergeHeaders(...items: Array<HeadersInit | undefined>): Headers {
  const out = new Headers();
  for (const item of items) {
    if (item) {
      new Headers(item).forEach((v, k) => out.append(k, v));
    }
  }

  return out;
}

export function text(body: string, status = 200, headers?: HeadersInit): Response {
  const h = mergeHeaders({ 'content-type': 'text/plain; charset=utf-8' }, headers);
  return new Response(body, { status, headers: h });
}

export function html(body: string, status = 200, headers?: HeadersInit): Response {
  const h = mergeHeaders({ 'content-type': 'text/html; charset=utf-8' }, headers);
  return new Response(body, { status, headers: h });
}

export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const h = mergeHeaders({ 'content-type': 'application/json; charset=utf-8' }, headers);
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function redirect(location: string, status = 302, headers?: HeadersInit): Response {
  const h = mergeHeaders(headers);
  h.set('location', location);
  return new Response(null, { status, headers: h });
}

export function noContent(status = 204, headers?: HeadersInit): Response {
  return new Response(null, { status, headers });
}

export function stream(
  body: ReadableStream<Uint8Array>,
  status = 200,
  headers?: HeadersInit,
): Response {
  return new Response(body, { status, headers });
}

export function sse(
  source: AsyncIterable<unknown>,
  options: {
    event?: (value: unknown) => string;
    id?: (value: unknown) => string;
    retry?: number;
    signal?: AbortSignal;
  } = {},
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const value of source) {
          if (options.signal?.aborted) {
            break;
          }

          const data = typeof value === 'string' ? value : JSON.stringify(value);
          let chunk = '';
          if (options.id) {
            chunk += `id: ${options.id(value)}\n`;
          }

          if (options.event) {
            chunk += `event: ${options.event(value)}\n`;
          }

          if (options.retry) {
            chunk += `retry: ${options.retry}\n`;
          }

          for (const line of data.split(/\r?\n/)) {
            chunk += `data: ${line}\n`;
          }

          chunk += '\n';
          controller.enqueue(encoder.encode(chunk));
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}
