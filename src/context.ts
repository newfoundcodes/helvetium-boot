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

import { BootRequest } from './request.js';
import {
  json as jsonResponse,
  text as textResponse,
  html as htmlResponse,
  redirect as redirectResponse,
  stream as streamResponse,
  sse as sseResponse,
} from './response.js';
import { serializeCookie, deleteCookie } from './cookies.js';
import type { CookieOptions } from './interfaces/cookies.js';
import type { RouteMatch } from './interfaces/router.js';

export class BootContext<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly request: Request;
  readonly req: BootRequest;
  readonly env: E;
  readonly executionCtx?: {
    waitUntil?(promise: Promise<unknown>): void;
    passThroughOnException?(): void;
  };
  readonly route: RouteMatch | null;
  private variables = new Map<string, unknown>();
  private responseHeaders = new Headers();
  private responseStatus = 200;
  private responseValue?: Response;

  constructor(
    request: Request,
    options: {
      env: E;
      params?: Record<string, string>;
      route?: RouteMatch | null;
      executionCtx?: BootContext<E, V>['executionCtx'];
    },
  ) {
    this.request = request;
    this.req = new BootRequest(request, options.params);
    this.env = options.env;
    this.route = options.route ?? null;
    this.executionCtx = options.executionCtx;
  }

  get res(): Response | undefined {
    return this.responseValue;
  }

  set res(value: Response | undefined) {
    this.responseValue = value;
  }

  get var(): V {
    return Object.fromEntries(this.variables) as V;
  }

  set<K extends keyof V & string>(key: K, value: V[K]): void;
  set(key: string, value: unknown): void {
    this.variables.set(key, value);
  }

  get<K extends keyof V & string>(key: K): V[K];
  get<T = unknown>(key: string): T;
  get(key: string): unknown {
    return this.variables.get(key);
  }

  has(key: string): boolean {
    return this.variables.has(key);
  }

  status(code: number): this {
    this.responseStatus = code;
    return this;
  }

  header(name: string, value: string | undefined, options: { append?: boolean } = {}): this {
    if (value === undefined) {
      this.responseHeaders.delete(name);
    } else if (options.append) {
      this.responseHeaders.append(name, value);
    } else {
      this.responseHeaders.set(name, value);
    }

    return this;
  }

  cookie(name: string, value: string, options: CookieOptions = {}): this {
    this.responseHeaders.append('set-cookie', serializeCookie(name, value, options));
    return this;
  }

  deleteCookie(name: string, options: CookieOptions = {}): this {
    this.responseHeaders.append('set-cookie', deleteCookie(name, options));
    return this;
  }

  body(body: BodyInit | null, status = this.responseStatus, headers?: HeadersInit): Response {
    return this.commit(new Response(body, { status, headers: this.headers(headers) }));
  }

  text(value: string, status = this.responseStatus, headers?: HeadersInit): Response {
    return this.commit(textResponse(value, status, this.headers(headers)));
  }

  html(value: string, status = this.responseStatus, headers?: HeadersInit): Response {
    return this.commit(htmlResponse(value, status, this.headers(headers)));
  }

  json<T>(value: T, status = this.responseStatus, headers?: HeadersInit): Response {
    return this.commit(jsonResponse(value, status, this.headers(headers)));
  }

  redirect(location: string, status = 302): Response {
    return this.commit(redirectResponse(location, status, this.responseHeaders));
  }

  stream(
    value: ReadableStream<Uint8Array>,
    status = this.responseStatus,
    headers?: HeadersInit,
  ): Response {
    return this.commit(streamResponse(value, status, this.headers(headers)));
  }

  sse(source: AsyncIterable<unknown>): Response {
    return this.commit(sseResponse(source, { signal: this.request.signal }));
  }

  notFound(message = 'Not Found'): Response {
    return this.text(message, 404);
  }

  newResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
    return new Response(body, { ...init, headers: this.headers(init.headers) });
  }

  private headers(extra?: HeadersInit): Headers {
    const h = new Headers(this.responseHeaders);
    if (extra) {
      new Headers(extra).forEach((v, k) => h.set(k, v));
    }

    return h;
  }

  private commit(response: Response): Response {
    this.responseValue = response;
    return response;
  }
}
