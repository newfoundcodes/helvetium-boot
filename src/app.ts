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

import { BootContext } from './context.js';
import { toHTTPError } from './errors.js';
import {
  compose,
  RouteControl,
  kPreRouting,
  type PreRoutingTransform,
} from './middleware/compose.js';
import { SmartRouter } from './router/smart.js';
import { WebSocketRouter } from './websocket.js';
import type {
  ErrorHandler,
  Handler,
  HTTPMethod,
  Middleware,
  NotFoundHandler,
  ParamHandler,
} from './types.js';
import type { BootOptions, RouteRegistrationOptions, UseRecord } from './interfaces/app.js';
import type { RouteMetadata, RouteRecord, RouterEngine } from './interfaces/router.js';
import type { WebSocketHandlers } from './interfaces/websocket.js';

const METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
  'CONNECT',
  'TRACE',
  'PURGE',
  'PROPFIND',
  'PROPPATCH',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
  'UNLOCK',
  'REPORT',
  'SEARCH',
  'CHECKOUT',
  'MERGE',
  'M-SEARCH',
  'NOTIFY',
  'SUBSCRIBE',
  'UNSUBSCRIBE',
];

function normalizePrefix(path: string): string {
  if (!path || path === '/') {
    return '/';
  }

  const p = path.startsWith('/') ? path : `/${path}`;
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return prefix === '/' || pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function joinPath(a: string, b: string): string {
  if (!a || a === '/') {
    return normalizePrefix(b);
  }

  if (!b || b === '/') {
    return normalizePrefix(a);
  }

  return `${normalizePrefix(a)}${normalizePrefix(b)}`.replace(/\/{2,}/g, '/');
}

function routeId(method: string, path: string, order: number): string {
  return `${method}:${path}:${order}`;
}

export class Boot<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly config: BootOptions<E>;
  readonly router: RouterEngine;
  readonly websockets = new WebSocketRouter();
  private middleware: UseRecord<E, V>[] = [];
  private preRouting: PreRoutingTransform[] = [];
  private records: RouteRecord[] = [];
  private paramHandlers = new Map<string, ParamHandler<E, V>[]>();
  private settings = new Map<string, unknown>();
  readonly locals: Record<string, unknown> = {};
  private order = 0;
  private base = '';
  private errorHandler: ErrorHandler<E, V> = async (error, _) => {
    const e = toHTTPError(error);
    const headers = new Headers(e.headers);

    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(
      JSON.stringify({
        error: e.expose ? e.message : 'Internal Server Error',
        status: e.status,
        details: e.expose ? e.details : undefined,
      }),
      { status: e.status, headers },
    );
  };
  private notFoundHandler: NotFoundHandler<E, V> = (c) =>
    c.json({ error: 'Not Found', path: c.req.path }, 404);

  constructor(options: BootOptions<E> = {}) {
    this.config = options;
    this.router = options.router ?? new SmartRouter(options.caseSensitive, options.decodeParams);
  }

  get routes(): readonly RouteRecord[] {
    return this.records;
  }

  ws(path: string, handlers: WebSocketHandlers): this {
    this.websockets.route(joinPath(this.base, path), handlers);
    return this;
  }

  param(name: string, ...handlers: ParamHandler<E, V>[]): this {
    if (!name || !handlers.length) {
      throw new TypeError('param() requires a name and handler');
    }

    const list = this.paramHandlers.get(name) ?? [];
    list.push(...handlers);

    this.paramHandlers.set(name, list);
    return this;
  }

  set(name: string, value: unknown): this {
    this.settings.set(name, value);
    return this;
  }

  setting<T = unknown>(name: string): T | undefined {
    return this.settings.get(name) as T | undefined;
  }

  enable(name: string): this {
    return this.set(name, true);
  }

  disable(name: string): this {
    return this.set(name, false);
  }

  enabled(name: string): boolean {
    return this.setting(name) === true;
  }

  disabled(name: string): boolean {
    return this.setting(name) === false;
  }

  use(...handlers: Middleware<E, V>[]): this;
  use(path: string, ...handlers: Middleware<E, V>[]): this;

  use(...args: unknown[]): this {
    let path = '/',
      handlers: Handler<E, V>[];

    if (typeof args[0] === 'string') {
      path = args[0];
      handlers = args.slice(1) as Handler<E, V>[];
    } else {
      handlers = args as Handler<E, V>[];
    }

    if (!handlers.length) {
      throw new TypeError('use() requires middleware');
    }

    for (const handler of handlers) {
      const transform = (handler as unknown as { [kPreRouting]?: PreRoutingTransform })[
        kPreRouting
      ];

      if (transform) {
        this.preRouting.push(transform);
      }
    }

    this.middleware.push({ path: joinPath(this.base, path), handlers, order: this.order++ });
    return this;
  }

  on(method: HTTPMethod | HTTPMethod[], path: string, ...handlers: Handler<E, V>[]): this;

  on(
    method: HTTPMethod | HTTPMethod[],
    path: string,
    options: RouteRegistrationOptions,
    ...handlers: Handler<E, V>[]
  ): this;

  on(method: HTTPMethod | HTTPMethod[], path: string, ...args: unknown[]): this {
    const methods = Array.isArray(method) ? method : [method];
    let metadata: RouteMetadata | undefined;
    let handlers: Handler<E, V>[];

    if (
      args.length &&
      typeof args[0] === 'object' &&
      typeof args[0] !== 'function' &&
      !(args[0] instanceof Response)
    ) {
      metadata = (args.shift() as RouteRegistrationOptions).metadata;
    }

    handlers = args as Handler<E, V>[];
    if (!handlers.length) {
      throw new TypeError('Route requires at least one handler');
    }

    for (const raw of methods) {
      const m = String(raw).toUpperCase();
      const full = joinPath(this.base, path);
      const record: RouteRecord = {
        method: m,
        path: full,
        handlers: handlers as unknown as Handler<unknown, Record<string, unknown>>[],
        metadata,
        id: routeId(m, full, this.order),
        order: this.order++,
      };

      this.records.push(record);
      this.router.add(record);
    }

    return this;
  }

  all(path: string, ...handlers: Handler<E, V>[]): this {
    return this.on('*', path, ...handlers);
  }

  get(path: string, ...handlers: Handler<E, V>[]): this;
  get(path: string, options: RouteRegistrationOptions, ...handlers: Handler<E, V>[]): this;
  get(path: string, ...args: unknown[]): this {
    return this.on('GET', path, ...(args as never[]));
  }

  post(path: string, ...handlers: Handler<E, V>[]): this;
  post(path: string, options: RouteRegistrationOptions, ...handlers: Handler<E, V>[]): this;
  post(path: string, ...args: unknown[]): this {
    return this.on('POST', path, ...(args as never[]));
  }

  put(path: string, ...handlers: Handler<E, V>[]): this;
  put(path: string, options: RouteRegistrationOptions, ...handlers: Handler<E, V>[]): this;
  put(path: string, ...args: unknown[]): this {
    return this.on('PUT', path, ...(args as never[]));
  }

  patch(path: string, ...handlers: Handler<E, V>[]): this;
  patch(path: string, options: RouteRegistrationOptions, ...handlers: Handler<E, V>[]): this;
  patch(path: string, ...args: unknown[]): this {
    return this.on('PATCH', path, ...(args as never[]));
  }

  delete(path: string, ...handlers: Handler<E, V>[]): this;
  delete(path: string, options: RouteRegistrationOptions, ...handlers: Handler<E, V>[]): this;
  delete(path: string, ...args: unknown[]): this {
    return this.on('DELETE', path, ...(args as never[]));
  }

  options(path: string, ...handlers: Handler<E, V>[]): this {
    return this.on('OPTIONS', path, ...handlers);
  }

  head(path: string, ...handlers: Handler<E, V>[]): this {
    return this.on('HEAD', path, ...handlers);
  }

  trace(path: string, ...handlers: Handler<E, V>[]): this {
    return this.on('TRACE', path, ...handlers);
  }

  connect(path: string, ...handlers: Handler<E, V>[]): this {
    return this.on('CONNECT', path, ...handlers);
  }

  route(path: string): RouteBuilder<E, V> {
    return new RouteBuilder(this, path);
  }

  basePath(prefix: string): Boot<E, V> {
    const child = new Boot<E, V>({ ...this.config, router: this.router.clone() });
    child.base = joinPath(this.base, prefix);
    return child;
  }

  mount(
    prefix: string,
    app: {
      fetch: (request: Request, env?: E, executionCtx?: unknown) => Promise<Response> | Response;
    },
    { stripPrefix = true }: { stripPrefix?: boolean } = {},
  ): this {
    const mountPath = joinPath(this.base, prefix);
    return this.use(mountPath, async (c: BootContext<E, V>) => {
      const url = new URL(c.request.url);
      if (stripPrefix) {
        url.pathname = url.pathname.slice(mountPath.length) || '/';
      }

      const req = new Request(url, c.request);
      return app.fetch(req, c.env, c.executionCtx);
    });
  }

  compose(prefix: string, child: Boot<E, V>): this {
    for (const mw of child.middleware) {
      this.middleware.push({
        path: joinPath(prefix, mw.path),
        handlers: mw.handlers,
        order: this.order++,
      });
    }

    for (const r of child.routes) {
      this.on(r.method, joinPath(prefix, r.path), { metadata: r.metadata }, ...r.handlers);
    }

    return this;
  }

  notFound(handler: NotFoundHandler<E, V>): this {
    this.notFoundHandler = handler;
    return this;
  }

  onError(handler: ErrorHandler<E, V>): this {
    this.errorHandler = handler;
    return this;
  }

  metadata(): Array<Pick<RouteRecord, 'id' | 'method' | 'path' | 'metadata' | 'order'>> {
    return this.records.map(({ id, method, path, metadata, order }) => ({
      id,
      method,
      path,
      metadata,
      order,
    }));
  }

  private handlersFor(match: {
    route: RouteRecord;
    params: Record<string, string>;
  }): Handler<E, V>[] {
    const out: Handler<E, V>[] = [];
    for (const [name, value] of Object.entries(match.params)) {
      for (const handler of this.paramHandlers.get(name) ?? []) {
        out.push((context, next) => handler(value, context, next));
      }
    }

    out.push(...(match.route.handlers as Handler<E, V>[]));
    return out;
  }

  async fetch(
    request: Request,
    env: E = this.config.env as E,
    executionCtx?: unknown,
  ): Promise<Response> {
    let activeRequest = request;
    try {
      for (const transform of this.preRouting) {
        activeRequest = await transform(activeRequest);
      }

      const url = new URL(activeRequest.url);
      let method = activeRequest.method.toUpperCase();
      let matches = this.router.match(method, url.pathname);

      if (method === 'HEAD' && !matches.length) {
        matches = this.router.match('GET', url.pathname);
      }

      if (method === 'OPTIONS' && !matches.length) {
        const allowed = [
          ...new Set(
            this.records
              .filter((r) =>
                this.router.match(String(r.method), url.pathname).some((m) => m.route.id === r.id),
              )
              .map((r) => String(r.method)),
          ),
        ];

        if (allowed.length) {
          return new Response(null, { status: 204, headers: { allow: allowed.join(', ') } });
        }
      }

      const match = matches[0] ?? null;
      const context = new BootContext<E, V>(activeRequest, {
        env,
        params: match?.params,
        route: match,
        executionCtx: executionCtx as BootContext<E, V>['executionCtx'],
      });

      const getHandlers = (m: { route: RouteRecord; params: Record<string, string> } | null) => {
        const active: { order: number; handlers: Handler<E, V>[] }[] = this.middleware
          .filter((mw) => pathMatchesPrefix(url.pathname, mw.path))
          .map((mw) => ({ order: mw.order, handlers: mw.handlers }));

        if (m) {
          active.push({ order: m.route.order, handlers: this.handlersFor(m) });
        }

        return active.sort((a, b) => a.order - b.order).flatMap((x) => x.handlers);
      };

      if (!match) {
        const response = await compose(getHandlers(null), context);
        return response ?? (await this.notFoundHandler(context));
      }

      let response: Response | undefined;
      try {
        response = await compose(getHandlers(match), context);
      } catch (error) {
        if (error instanceof RouteControl && error.control === 'route') {
          const next = matches[1];
          if (next) {
            const c2 = new BootContext<E, V>(activeRequest, {
              env,
              params: next.params,
              route: next,
              executionCtx: executionCtx as BootContext<E, V>['executionCtx'],
            });
            response = await compose(getHandlers(next), c2);
          } else {
            response = await this.notFoundHandler(context);
          }
        } else {
          throw error;
        }
      }

      if (!response) {
        response = await this.notFoundHandler(context);
      }

      if (method === 'HEAD') {
        return new Response(null, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      return response;
    } catch (error) {
      const fallbackContext = new BootContext<E, V>(activeRequest, {
        env,
        executionCtx: executionCtx as BootContext<E, V>['executionCtx'],
      });
      return this.errorHandler(error, fallbackContext);
    }
  }

  request(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const req =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), 'http://localhost'), init);
    return this.fetch(req);
  }

  clone(): Boot<E, V> {
    const copy = new Boot<E, V>({ ...this.config, router: this.router.clone() });
    for (const mw of this.middleware) {
      copy.use(mw.path, ...mw.handlers);
    }

    for (const r of this.records) {
      copy.on(r.method, r.path, { metadata: r.metadata }, ...r.handlers);
    }

    for (const [name, handlers] of this.paramHandlers) {
      copy.param(name, ...handlers);
    }

    for (const [name, value] of this.settings) {
      copy.set(name, value);
    }

    Object.assign(copy.locals, this.locals);
    copy.errorHandler = this.errorHandler;
    copy.notFoundHandler = this.notFoundHandler;
    return copy;
  }
}

export class RouteBuilder<E, V extends Record<string, unknown>> {
  constructor(
    private app: Boot<E, V>,
    private path: string,
  ) {}

  get(...h: Handler<E, V>[]): this {
    this.app.get(this.path, ...h);
    return this;
  }

  post(...h: Handler<E, V>[]): this {
    this.app.post(this.path, ...h);
    return this;
  }

  put(...h: Handler<E, V>[]): this {
    this.app.put(this.path, ...h);
    return this;
  }

  patch(...h: Handler<E, V>[]): this {
    this.app.patch(this.path, ...h);
    return this;
  }

  delete(...h: Handler<E, V>[]): this {
    this.app.delete(this.path, ...h);
    return this;
  }

  options(...h: Handler<E, V>[]): this {
    this.app.options(this.path, ...h);
    return this;
  }

  head(...h: Handler<E, V>[]): this {
    this.app.head(this.path, ...h);
    return this;
  }

  all(...h: Handler<E, V>[]): this {
    this.app.all(this.path, ...h);
    return this;
  }
}

export function createApp<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
>(options: BootOptions<E> = {}): Boot<E, V> {
  return new Boot<E, V>(options);
}

export { METHODS as HTTP_METHODS };
