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

import type { CookieOptions } from './interfaces/cookies.js';

export function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) {
      continue;
    }

    const k = part.slice(0, i).trim();
    if (!k) {
      continue;
    }

    const raw = part.slice(i + 1).trim();
    try {
      out[k] = decodeURIComponent(raw);
    } catch {
      out[k] = raw;
    }
  }

  return out;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) {
    throw new TypeError('Invalid cookie name');
  }

  let out = `${name}=${encodeURIComponent(value)}`;
  if (options.maxAge !== undefined) {
    out += `; Max-Age=${Math.trunc(options.maxAge)}`;
  }

  if (options.domain) {
    out += `; Domain=${options.domain}`;
  }

  if (options.path) {
    out += `; Path=${options.path}`;
  }

  if (options.expires) {
    out += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.httpOnly) {
    out += '; HttpOnly';
  }

  if (options.secure) {
    out += '; Secure';
  }

  if (options.sameSite) {
    out += `; SameSite=${options.sameSite[0].toUpperCase() + options.sameSite.slice(1).toLowerCase()}`;
  }

  if (options.partitioned) {
    out += '; Partitioned';
  }

  if (options.priority) {
    out += `; Priority=${options.priority}`;
  }

  return out;
}

export function deleteCookie(name: string, options: CookieOptions = {}): string {
  return serializeCookie(name, '', { ...options, expires: new Date(0), maxAge: 0 });
}

function b64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))),
  );
}

export async function serializeSignedCookie(
  name: string,
  value: string,
  secret: string,
  options: CookieOptions = {},
): Promise<string> {
  return serializeCookie(name, `${value}.${await hmac(value, secret)}`, options);
}

export async function verifySignedCookie(
  value: string,
  secret: string,
): Promise<string | undefined> {
  const i = value.lastIndexOf('.');
  if (i < 1) {
    return undefined;
  }

  const raw = value.slice(0, i),
    sig = value.slice(i + 1),
    expected = await hmac(raw, secret);

  if (sig.length !== expected.length) {
    return undefined;
  }

  let diff = 0;
  for (let j = 0; j < sig.length; j++) {
    diff |= sig.charCodeAt(j) ^ expected.charCodeAt(j);
  }

  return diff === 0 ? raw : undefined;
}
