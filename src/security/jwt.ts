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
import type { JWTHeader, JWTPayload, JWTVerifyOptions } from '../interfaces/jwt.js';

export type JWTAlgorithm =
  | 'HS256'
  | 'HS384'
  | 'HS512'
  | 'RS256'
  | 'RS384'
  | 'RS512'
  | 'PS256'
  | 'PS384'
  | 'PS512'
  | 'ES256'
  | 'ES384'
  | 'ES512'
  | 'EdDSA';

export type JWTKey = string | Uint8Array | CryptoKey | JsonWebKey;

const enc = new TextEncoder(),
  dec = new TextDecoder();

function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) {
    s += String.fromCharCode(b);
  }

  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ub64(s: string): Uint8Array<ArrayBuffer> {
  const x = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(s.length / 4) * 4, '=');

  const bin = atob(x);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function ownedBytes(bytes: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out;
}

function hashFor(alg: JWTAlgorithm): string {
  if (alg.endsWith('256')) {
    return 'SHA-256';
  }

  if (alg.endsWith('384')) {
    return 'SHA-384';
  }

  if (alg.endsWith('512')) {
    return 'SHA-512';
  }

  return 'SHA-512';
}

function cryptoAlgorithm(
  alg: JWTAlgorithm,
  _: 'sign' | 'verify',
):
  | AlgorithmIdentifier
  | RsaHashedImportParams
  | EcKeyImportParams
  | HmacImportParams
  | RsaPssParams
  | EcdsaParams {
  const hash = hashFor(alg);

  if (alg.startsWith('HS')) {
    return { name: 'HMAC', hash };
  }

  if (alg.startsWith('RS')) {
    return { name: 'RSASSA-PKCS1-v1_5', hash };
  }

  if (alg.startsWith('PS')) {
    return { name: 'RSA-PSS', hash, saltLength: Number(alg.slice(2)) / 8 };
  }

  if (alg.startsWith('ES')) {
    const curve = alg === 'ES256' ? 'P-256' : alg === 'ES384' ? 'P-384' : 'P-521';
    return { name: 'ECDSA', namedCurve: curve, hash };
  }

  return { name: 'Ed25519' };
}

async function importJWTKey(
  key: JWTKey,
  alg: JWTAlgorithm,
  usage: 'sign' | 'verify',
): Promise<CryptoKey> {
  if (typeof CryptoKey !== 'undefined' && key instanceof CryptoKey) {
    return key;
  }

  const algorithm = cryptoAlgorithm(alg, usage) as unknown as AlgorithmIdentifier;
  if (typeof key === 'string' || key instanceof Uint8Array) {
    if (!alg.startsWith('HS')) {
      throw new TypeError(`${alg} requires CryptoKey or JWK`);
    }

    const raw = typeof key === 'string' ? enc.encode(key) : ownedBytes(key);
    return crypto.subtle.importKey('raw', raw, algorithm as unknown as AlgorithmIdentifier, false, [
      usage,
    ]);
  }

  return (crypto.subtle.importKey as unknown as Function)('jwk', key, algorithm, false, [usage]);
}

function signAlgorithm(alg: JWTAlgorithm): AlgorithmIdentifier | RsaPssParams | EcdsaParams {
  const base = cryptoAlgorithm(alg, 'sign') as unknown as
    AlgorithmIdentifier | RsaPssParams | EcdsaParams;

  if (alg.startsWith('PS')) {
    return { name: 'RSA-PSS', saltLength: Number(alg.slice(2)) / 8 };
  }

  if (alg.startsWith('ES')) {
    return { name: 'ECDSA', hash: hashFor(alg) };
  }

  return base;
}

export function decodeJWT(token: string): {
  header: JWTHeader;
  payload: JWTPayload;
  signature: Uint8Array<ArrayBuffer>;
  signingInput: string;
} {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new HTTPError(401, 'Malformed JWT');
  }

  try {
    return {
      header: JSON.parse(dec.decode(ub64(parts[0]))),
      payload: JSON.parse(dec.decode(ub64(parts[1]))),
      signature: ub64(parts[2]),
      signingInput: `${parts[0]}.${parts[1]}`,
    };
  } catch (error) {
    throw new HTTPError(401, 'Malformed JWT', { cause: error });
  }
}

export async function signJWT(
  payload: JWTPayload,
  key: JWTKey,
  alg: JWTAlgorithm = 'HS256',
  header: Partial<JWTHeader> = {},
): Promise<string> {
  const h: JWTHeader = { typ: 'JWT', ...header, alg };
  const a = b64u(enc.encode(JSON.stringify(h))),
    b = b64u(enc.encode(JSON.stringify(payload))),
    input = `${a}.${b}`,
    k = await importJWTKey(key, alg, 'sign');

  const sig = await crypto.subtle.sign(signAlgorithm(alg), k, enc.encode(input));
  return `${input}.${b64u(new Uint8Array(sig))}`;
}

function matchExpected(actual: unknown, expected: string | RegExp): boolean {
  return typeof expected === 'string'
    ? actual === expected
    : typeof actual === 'string' && expected.test(actual);
}

function audienceMatches(actual: unknown, expected: JWTVerifyOptions['audience']): boolean {
  if (expected === undefined) {
    return true;
  }

  const actuals = Array.isArray(actual) ? actual : [actual];
  const expectations = Array.isArray(expected) ? expected : [expected];
  return expectations.some((e) => actuals.some((a) => matchExpected(a, e as string)));
}

export async function verifyJWT(
  token: string,
  key: JWTKey,
  options: JWTVerifyOptions = {},
): Promise<JWTPayload> {
  const decoded = decodeJWT(token);
  const alg = decoded.header.alg;

  if (options.algorithms && !options.algorithms.includes(alg)) {
    throw new HTTPError(401, 'JWT algorithm is not allowed');
  }

  const k = await importJWTKey(key, alg, 'verify');
  const ok = await crypto.subtle.verify(
    signAlgorithm(alg),
    k,
    ownedBytes(decoded.signature),
    enc.encode(decoded.signingInput),
  );

  if (!ok) {
    throw new HTTPError(401, 'Invalid JWT signature');
  }

  const p = decoded.payload,
    now = options.now ?? Math.floor(Date.now() / 1000),
    tol = options.clockTolerance ?? 0;

  if (options.validateExp !== false && typeof p.exp === 'number' && now - tol >= p.exp) {
    throw new HTTPError(401, 'JWT expired');
  }

  if (options.validateNbf !== false && typeof p.nbf === 'number' && now + tol < p.nbf) {
    throw new HTTPError(401, 'JWT not active');
  }

  if (options.validateIat !== false && typeof p.iat === 'number' && p.iat > now + tol) {
    throw new HTTPError(401, 'JWT issued in the future');
  }

  if (options.issuer !== undefined && !matchExpected(p.iss, options.issuer)) {
    throw new HTTPError(401, 'Invalid JWT issuer');
  }

  if (!audienceMatches(p.aud, options.audience)) {
    throw new HTTPError(401, 'Invalid JWT audience');
  }

  return p;
}

export const jwt = { sign: signJWT, verify: verifyJWT, decode: decodeJWT };
