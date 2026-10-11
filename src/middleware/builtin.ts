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

import { HTTPError, TimeoutError } from '../errors.js';
import { verifySignedCookie, serializeSignedCookie } from '../cookies.js';
import { verifyJWT, type JWTKey, type JWTAlgorithm } from '../security/jwt.js';
import { verifyWithJWKS, type BootJWK } from '../security/jwk.js';
import { markPreRouting } from './compose.js';
import type { Middleware } from '../types.js';
import type { BootContext } from '../context.js';
import type { CORSOptions } from '../interfaces/builtin.js';
import type { JWTVerifyOptions } from '../interfaces/jwt.js';
import type { JWKSOptions } from '../interfaces/jwk.js';
import type { CookieOptions } from '../interfaces/cookies.js';

function appendVary(headers: Headers, value: string): void {
  const current = headers.get('vary');
  const items = new Set(
    (current ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );

  items.add(value);
  headers.set('vary', [...items].join(', '));
}

function cloneResponse(response: Response, headers: Headers): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function logger(
  options: {
    log?: (
      message: string,
      details: { method: string; path: string; status: number; durationMs: number },
    ) => void;
    skip?: (path: string) => boolean;
  } = {},
): Middleware {
  return async (c, next) => {
    if (options.skip?.(c.req.path)) {
      return next();
    }

    const start = performance.now();
    await next();

    const d = {
      method: c.req.method,
      path: c.req.path,
      status: c.res?.status ?? 0,
      durationMs: performance.now() - start,
    };

    (options.log ?? ((m) => console.log(m)))(
      `${d.method} ${d.path} ${d.status} ${d.durationMs.toFixed(1)}ms`,
      d,
    );
  };
}

export function cors(options: CORSOptions = {}): Middleware {
  return async (c, next) => {
    const origin = c.req.header('origin');
    let allowed = '*';

    if (origin && options.origin) {
      const rule = options.origin;
      if (typeof rule === 'string') {
        allowed = rule;
      } else if (Array.isArray(rule)) {
        allowed = rule.includes(origin) ? origin : '';
      } else if (rule instanceof RegExp) {
        allowed = rule.test(origin) ? origin : '';
      } else {
        const x = await rule(origin, c);
        allowed = x === true ? origin : x === false ? '' : x;
      }
    }

    if (c.req.method === 'OPTIONS' && c.req.header('access-control-request-method')) {
      const h = new Headers();
      if (allowed) {
        h.set('access-control-allow-origin', allowed);
      }

      h.set(
        'access-control-allow-methods',
        (options.allowMethods ?? ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']).join(', '),
      );

      if (options.allowHeaders) {
        h.set('access-control-allow-headers', options.allowHeaders.join(', '));
      } else {
        const requested = c.req.header('access-control-request-headers');
        if (requested) {
          h.set('access-control-allow-headers', requested);
        }
      }

      if (options.credentials) {
        h.set('access-control-allow-credentials', 'true');
      }

      if (options.maxAge !== undefined) {
        h.set('access-control-max-age', String(options.maxAge));
      }

      return new Response(null, { status: 204, headers: h });
    }

    await next();
    if (c.res) {
      const h = new Headers(c.res.headers);
      if (allowed) {
        h.set('access-control-allow-origin', allowed);
      }

      if (options.credentials) {
        h.set('access-control-allow-credentials', 'true');
      }

      if (options.exposeHeaders) {
        h.set('access-control-expose-headers', options.exposeHeaders.join(', '));
      }

      if (origin) {
        appendVary(h, 'Origin');
      }

      c.res = cloneResponse(c.res, h);
    }
  };
}

export function secureHeaders(
  options: {
    contentSecurityPolicy?: string | false;
    hsts?: string | false;
    frameOptions?: string | false;
    referrerPolicy?: string | false;
    permissionsPolicy?: string | false;
    crossOriginOpenerPolicy?: string | false;
    crossOriginResourcePolicy?: string | false;
    crossOriginEmbedderPolicy?: string | false;
  } = {},
): Middleware {
  return async (c, next) => {
    await next();
    if (!c.res) {
      return;
    }

    const h = new Headers(c.res.headers);
    const set = (k: string, v: string | false | undefined, d: string) => {
      if (v !== false) {
        h.set(k, v ?? d);
      }
    };

    set('x-content-type-options', undefined, 'nosniff');
    set('x-frame-options', options.frameOptions, 'SAMEORIGIN');
    set('referrer-policy', options.referrerPolicy, 'strict-origin-when-cross-origin');
    set('strict-transport-security', options.hsts, 'max-age=15552000; includeSubDomains');
    set('cross-origin-opener-policy', options.crossOriginOpenerPolicy, 'same-origin');
    set('cross-origin-resource-policy', options.crossOriginResourcePolicy, 'same-origin');

    if (options.contentSecurityPolicy) {
      set('content-security-policy', options.contentSecurityPolicy, '');
    }

    if (options.permissionsPolicy) {
      set('permissions-policy', options.permissionsPolicy, '');
    }

    if (options.crossOriginEmbedderPolicy) {
      set('cross-origin-embedder-policy', options.crossOriginEmbedderPolicy, '');
    }

    h.delete('x-powered-by');
    c.res = cloneResponse(c.res, h);
  };
}

export function poweredBy(value = 'Helvetium Boot'): Middleware {
  return async (c, next) => {
    await next();
    if (c.res) {
      const h = new Headers(c.res.headers);
      h.set('x-powered-by', value);
      c.res = cloneResponse(c.res, h);
    }
  };
}

export function requestId(options: { header?: string; generator?: () => string } = {}): Middleware {
  return async (c, next) => {
    const header = options.header ?? 'x-request-id';
    const id = c.req.header(header) ?? options.generator?.() ?? crypto.randomUUID();

    c.set('requestId', id);
    await next();

    if (c.res) {
      const h = new Headers(c.res.headers);
      h.set(header, id);
      c.res = cloneResponse(c.res, h);
    }
  };
}

export function timing(options: { header?: string } = {}): Middleware {
  return async (c, next) => {
    const start = performance.now();
    await next();

    if (c.res) {
      const h = new Headers(c.res.headers);
      const value = `app;dur=${(performance.now() - start).toFixed(2)}`;

      h.append(options.header ?? 'server-timing', value);
      c.res = cloneResponse(c.res, h);
    }
  };
}

async function digest(body: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', body);
  let s = '';

  for (const b of new Uint8Array(hash)) {
    s += b.toString(16).padStart(2, '0');
  }

  return s;
}

export function etag(options: { weak?: boolean } = {}): Middleware {
  return async (c, next) => {
    await next();
    if (
      !c.res ||
      c.res.status < 200 ||
      c.res.status === 204 ||
      c.res.status === 304 ||
      c.res.headers.has('etag')
    ) {
      return;
    }

    const clone = c.res.clone();
    const body = await clone.arrayBuffer();
    const tag = `${options.weak ? 'W/' : ''}"${(await digest(body)).slice(0, 32)}-${body.byteLength}"`;
    const h = new Headers(c.res.headers);
    h.set('etag', tag);

    const inm = c.req.header('if-none-match');
    if (
      (c.req.method === 'GET' || c.req.method === 'HEAD') &&
      inm &&
      inm
        .split(',')
        .map((x) => x.trim())
        .includes(tag)
    ) {
      h.delete('content-length');
      c.res = new Response(null, { status: 304, headers: h });
    } else {
      c.res = cloneResponse(c.res, h);
    }
  };
}

export function bodyLimit(limit: number): Middleware {
  return async (c, next) => {
    const n = Number(c.req.header('content-length') ?? 0);
    if (n > limit) {
      throw new HTTPError(413, `Request body exceeds ${limit} bytes`);
    }

    c.set('bodyLimit', limit);
    return next();
  };
}

function unauthorized(realm = 'Restricted'): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'www-authenticate': `Basic realm="${realm.replace(/"/g, '')}"` },
  });
}

export function basicAuth(
  options:
    | { username: string; password: string; realm?: string }
    | {
        verify: (username: string, password: string, c: unknown) => boolean | Promise<boolean>;
        realm?: string;
      },
): Middleware {
  return async (c, next) => {
    const h = c.req.header('authorization');
    if (!h?.startsWith('Basic ')) {
      return unauthorized(options.realm);
    }

    let value = '';
    try {
      value = atob(h.slice(6));
    } catch {
      return unauthorized(options.realm);
    }

    const i = value.indexOf(':'),
      user = i >= 0 ? value.slice(0, i) : value,
      pass = i >= 0 ? value.slice(i + 1) : '';
    const ok =
      'verify' in options
        ? await options.verify(user, pass, c)
        : user === options.username && pass === options.password;
    if (!ok) {
      return unauthorized(options.realm);
    }

    c.set('auth', { type: 'basic', username: user });
    return next();
  };
}

export function bearerAuth(options: {
  token?: string;
  verify?: (token: string, c: unknown) => boolean | Promise<boolean>;
  realm?: string;
}): Middleware {
  return async (c, next) => {
    const h = c.req.header('authorization');
    const token = h?.match(/^Bearer\s+(.+)$/i)?.[1];
    const ok =
      !!token && (options.verify ? await options.verify(token, c) : token === options.token);

    if (!ok) {
      return new Response('Unauthorized', {
        status: 401,
        headers: { 'www-authenticate': `Bearer realm="${options.realm ?? 'API'}"` },
      });
    }

    c.set('auth', { type: 'bearer', token });
    return next();
  };
}

export function jwtAuth(options: {
  key: JWTKey;
  algorithms?: JWTAlgorithm[];
  cookie?: string;
  header?: string;
  verification?: JWTVerifyOptions;
}): Middleware {
  return async (c, next) => {
    let token: string | undefined;
    if (options.cookie) {
      token = c.req.cookie(options.cookie) as string | undefined;
    } else {
      token = c.req.header(options.header ?? 'authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    }

    if (!token) {
      throw new HTTPError(401, 'Missing JWT');
    }

    const payload = await verifyJWT(token, options.key, {
      ...options.verification,
      algorithms: options.algorithms ?? options.verification?.algorithms,
    });

    c.set('jwtPayload', payload);
    return next();
  };
}

export function jwkAuth(options: {
  source: string | BootJWK[] | (() => Promise<BootJWK[]>);
  cookie?: string;
  header?: string;
  verification: JWKSOptions;
}): Middleware {
  return async (c, next) => {
    const token = options.cookie
      ? (c.req.cookie(options.cookie) as string | undefined)
      : c.req.header(options.header ?? 'authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      throw new HTTPError(401, 'Missing JWT');
    }

    const payload = await verifyWithJWKS(token, options.source, options.verification);
    c.set('jwtPayload', payload);
    return next();
  };
}

export function rateLimit(options: {
  limit: number;
  windowMs: number;
  key?: (c: BootContext<Record<string, unknown>, Record<string, unknown>>) => string;
  status?: number;
}): Middleware {
  const store = new Map<string, { count: number; reset: number }>();
  return async (c, next) => {
    const key =
      options.key?.(c) ?? c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'global';
    const now = Date.now();

    let hit = store.get(key);
    if (!hit || hit.reset <= now) {
      hit = { count: 0, reset: now + options.windowMs };
      store.set(key, hit);
    }

    hit.count++;

    const remaining = Math.max(0, options.limit - hit.count);
    if (hit.count > options.limit) {
      return new Response('Too Many Requests', {
        status: options.status ?? 429,
        headers: {
          'retry-after': String(Math.ceil((hit.reset - now) / 1000)),
          'ratelimit-limit': String(options.limit),
          'ratelimit-remaining': '0',
          'ratelimit-reset': String(Math.ceil(hit.reset / 1000)),
        },
      });
    }

    await next();
    if (c.res) {
      const h = new Headers(c.res.headers);
      h.set('ratelimit-limit', String(options.limit));
      h.set('ratelimit-remaining', String(remaining));
      h.set('ratelimit-reset', String(Math.ceil(hit.reset / 1000)));

      c.res = cloneResponse(c.res, h);
    }
  };
}

export function csrf(
  options: {
    origin?: string | string[];
    header?: string;
    token?: string | ((c: unknown) => string | Promise<string>);
    safeMethods?: string[];
  } = {},
): Middleware {
  return async (c, next) => {
    const safe = options.safeMethods ?? ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
    if (safe.includes(c.req.method.toUpperCase())) {
      return next();
    }

    const origin = c.req.header('origin');
    const expected = options.origin ?? new URL(c.req.url).origin;

    if (origin) {
      const ok = Array.isArray(expected) ? expected.includes(origin) : origin === expected;
      if (!ok) {
        throw new HTTPError(403, 'CSRF origin rejected');
      }
    }

    if (options.token) {
      const expectedToken =
        typeof options.token === 'function' ? await options.token(c) : options.token;
      const supplied = c.req.header(options.header ?? 'x-csrf-token');

      if (!supplied || supplied !== expectedToken) {
        throw new HTTPError(403, 'Invalid CSRF token');
      }
    }

    return next();
  };
}

export function timeout(ms: number): Middleware {
  return async (c, next) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        next(),
        new Promise<Response>((_, reject) => {
          timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  };
}

export function cacheControl(value: string | ((c: unknown) => string)): Middleware {
  return async (c, next) => {
    await next();

    if (c.res) {
      const h = new Headers(c.res.headers);
      h.set('cache-control', typeof value === 'function' ? value(c) : value);
      c.res = cloneResponse(c.res, h);
    }
  };
}

export function prettyJSON(space = 2): Middleware {
  return async (c, next) => {
    await next();

    if (!c.res || !c.res.headers.get('content-type')?.includes('application/json')) {
      return;
    }

    const value = await c.res.clone().json();
    const h = new Headers(c.res.headers);

    h.delete('content-length');
    c.res = new Response(JSON.stringify(value, null, space), {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: h,
    });
  };
}

export function language(options: { supported: string[]; default: string }): Middleware {
  return async (c, next) => {
    const accept = c.req.header('accept-language') ?? '';
    const parts = accept
      .split(',')
      .map((x) => {
        const [a, ...rest] = x.trim().split(';');
        const q = Number(rest.find((r) => r.trim().startsWith('q='))?.split('=')[1] ?? 1);
        return { lang: a.toLowerCase(), q };
      })
      .sort((a, b) => b.q - a.q);
    const selected =
      parts
        .map((p) =>
          options.supported.find(
            (s) => p.lang === s.toLowerCase() || p.lang.startsWith(`${s.toLowerCase()}-`),
          ),
        )
        .find(Boolean) ?? options.default;

    c.set('language', selected);
    await next();

    if (c.res) {
      const h = new Headers(c.res.headers);
      h.set('content-language', selected);

      appendVary(h, 'Accept-Language');
      c.res = cloneResponse(c.res, h);
    }
  };
}

export function ipRestriction(options: {
  allow?: Array<string | RegExp>;
  deny?: Array<string | RegExp>;
  header?: string;
}): Middleware {
  return async (c, next) => {
    const ip = (c.req.header(options.header ?? 'x-forwarded-for') ?? '').split(',')[0].trim();
    const match = (rules: Array<string | RegExp> | undefined) =>
      rules?.some((r) => (typeof r === 'string' ? r === ip : r.test(ip))) ?? false;

    if (match(options.deny) || (options.allow && !match(options.allow))) {
      throw new HTTPError(403, 'IP address is not allowed');
    }

    return next();
  };
}

export function trailingSlash(mode: 'append' | 'remove'): Middleware {
  return async (c, next) => {
    const url = new URL(c.req.url),
      p = url.pathname;
    if (mode === 'append' && !p.endsWith('/') && p !== '') {
      url.pathname = p + '/';
      return c.redirect(url.pathname + url.search + url.hash, 308);
    }

    if (mode === 'remove' && p.length > 1 && p.endsWith('/')) {
      url.pathname = p.replace(/\/+$/, '');
      return c.redirect(url.pathname + url.search + url.hash, 308);
    }

    return next();
  };
}

export function compress(
  options: { encodings?: Array<'gzip' | 'deflate'>; threshold?: number } = {},
): Middleware {
  return async (c, next) => {
    await next();

    if (!c.res || !c.res.body || c.res.headers.has('content-encoding')) {
      return;
    }

    const length = Number(c.res.headers.get('content-length') ?? 0);
    if (length && length < (options.threshold ?? 1024)) {
      return;
    }

    const accept = c.req.header('accept-encoding') ?? '';
    const supported = options.encodings ?? ['gzip', 'deflate'];
    const encoding = supported.find((x) => accept.includes(x));

    if (!encoding || typeof CompressionStream === 'undefined') {
      return;
    }

    const h = new Headers(c.res.headers);
    h.set('content-encoding', encoding);
    h.delete('content-length');
    appendVary(h, 'Accept-Encoding');

    c.res = new Response(c.res.body.pipeThrough(new CompressionStream(encoding)), {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: h,
    });
  };
}

export function session(options: {
  secret: string;
  cookie?: string;
  cookieOptions?: CookieOptions;
  ttlMs?: number;
}): Middleware {
  const store = new Map<string, { value: Record<string, unknown>; expires: number }>();
  const cookieName = options.cookie ?? 'helvetium.sid';
  return async (c, next) => {
    const raw = c.req.cookie(cookieName) as string | undefined;
    let id = raw ? await verifySignedCookie(raw, options.secret) : undefined;

    const now = Date.now();
    let record = id ? store.get(id) : undefined;

    if (!record || record.expires < now) {
      id = crypto.randomUUID();
      record = { value: {}, expires: now + (options.ttlMs ?? 86_400_000) };

      store.set(id, record);
    }

    c.set('session', record.value);
    await next();

    if (c.res && id) {
      const signed = await serializeSignedCookie(cookieName, id, options.secret, {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        ...options.cookieOptions,
      });
      const h = new Headers(c.res.headers);

      h.append('set-cookie', signed);
      c.res = cloneResponse(c.res, h);
    }
  };
}

export function methodOverride(
  options: { header?: string; query?: string; allowed?: string[] } = {},
): Middleware {
  const noop: Middleware = (_c, next) => next();
  return markPreRouting(noop, (request) => {
    const url = new URL(request.url);
    const value =
      request.headers.get(options.header ?? 'x-http-method-override') ??
      url.searchParams.get(options.query ?? '_method');

    if (!value) {
      return request;
    }

    const method = value.toUpperCase();
    const allowed = options.allowed ?? ['PUT', 'PATCH', 'DELETE'];

    if (!allowed.includes(method)) {
      return request;
    }

    return new Request(request, { method });
  });
}
