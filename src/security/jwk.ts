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

import { HTTPError } from '../errors.js';
import type { CacheEntry, JWKS, JWKSOptions } from '../interfaces/jwk.js';
import type { JWTPayload } from '../interfaces/jwt.js';
import { decodeJWT, verifyJWT } from './jwt.js';

export type BootJWK = JsonWebKey & { kid?: string; alg?: string; use?: string };

const cache = new Map<string, CacheEntry>();

export async function fetchJWKS(
  uri: string,
  options: Pick<JWKSOptions, 'cacheTtlMs' | 'fetch' | 'headers'> = {},
): Promise<BootJWK[]> {
  const now = Date.now(),
    hit = cache.get(uri);

  if (hit && hit.expires > now) {
    return hit.keys;
  }

  const f = options.fetch ?? globalThis.fetch;
  const res = await f(uri, { headers: options.headers });

  if (!res.ok) {
    throw new HTTPError(503, `Unable to fetch JWKS: ${res.status}`, { expose: true });
  }

  const body = (await res.json()) as JWKS;
  if (!body || !Array.isArray(body.keys)) {
    throw new HTTPError(503, 'Invalid JWKS response', { expose: true });
  }

  cache.set(uri, { keys: body.keys, expires: now + (options.cacheTtlMs ?? 300_000) });
  return body.keys;
}

export function clearJWKSCache(uri?: string): void {
  if (uri) {
    cache.delete(uri);
  } else {
    cache.clear();
  }
}

export async function verifyWithJWKS(
  token: string,
  source: string | BootJWK[] | (() => Promise<BootJWK[]>),
  options: JWKSOptions,
): Promise<JWTPayload> {
  const { header } = decodeJWT(token);
  if (!header.kid) {
    throw new HTTPError(401, 'JWT kid header is required for JWKS verification');
  }

  if (!options.algorithms.includes(header.alg)) {
    throw new HTTPError(401, 'JWT algorithm is not allowed');
  }

  if (header.alg.startsWith('HS')) {
    throw new HTTPError(401, 'Symmetric algorithms are not allowed with JWKS');
  }

  const keys =
    typeof source === 'string'
      ? await fetchJWKS(source, options)
      : typeof source === 'function'
        ? await source()
        : source;
  const key = keys.find((k) => k.kid === header.kid);

  if (!key) {
    throw new HTTPError(401, 'No matching JWK');
  }

  if (key.alg && key.alg !== header.alg) {
    throw new HTTPError(401, 'JWK algorithm mismatch');
  }

  return verifyJWT(token, key, { ...options, algorithms: options.algorithms });
}
