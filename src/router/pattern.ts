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

import type { CompiledPattern } from '../interfaces/router.js';
import type { RouteRecord, RouteMatch } from '../interfaces/router.js';

export function escapeRegExp(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizePath(path: string): string {
  if (path === '*' || path === '/*') {
    return '*';
  }

  if (!path) {
    return '/';
  }

  const x = (path.startsWith('/') ? path : `/${path}`).replace(/\/{2,}/g, '/');
  return x.length > 1 ? x.replace(/\/+$/, '') : x;
}

export function compilePattern(path: string, end = true, caseSensitive = false): CompiledPattern {
  const pattern = normalizePath(path),
    keys: string[] = [];

  if (pattern === '*') {
    return {
      expression: new RegExp('^/(.*)?/?$', caseSensitive ? '' : 'i'),
      keys: ['*'],
      score: -1000,
      staticPrefix: '/',
    };
  }

  if (pattern === '/') {
    return {
      expression: new RegExp(end ? '^/?$' : '^/(?:.*)?$', caseSensitive ? '' : 'i'),
      keys,
      score: end ? 100 : 1,
      staticPrefix: '/',
    };
  }

  const segments = pattern.slice(1).split('/');
  let source = '^',
    score = 0,
    prefix = '';

  let collectingPrefix = true;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment === '*' || segment.startsWith('*')) {
      if (i !== segments.length - 1) {
        throw new Error(`Splat must be final: ${path}`);
      }

      keys.push(segment.slice(1) || '*');
      source += '(?:/(.*))?';
      score += 1;

      collectingPrefix = false;
      continue;
    }

    if (segment.startsWith(':')) {
      const optional = segment.endsWith('?');
      const name = segment.slice(1, optional ? -1 : undefined);

      if (!name) {
        throw new Error(`Empty route parameter: ${path}`);
      }

      keys.push(name);
      source += optional ? '(?:/([^/]+))?' : '/([^/]+)';
      score += optional ? 4 : 6;

      collectingPrefix = false;
      continue;
    }

    source += `/${escapeRegExp(segment)}`;
    score += 10;

    if (collectingPrefix) {
      prefix += `/${segment}`;
    }
  }

  source += end ? '/?$' : '(?:/|$)';
  score += segments.length + (end ? 2 : 0);
  return {
    expression: new RegExp(source, caseSensitive ? '' : 'i'),
    keys,
    score,
    staticPrefix: prefix || '/',
  };
}

export function matchPattern(
  route: RouteRecord,
  pathname: string,
  caseSensitive = false,
  decode = true,
): RouteMatch | null {
  const compiled = compilePattern(route.path, true, caseSensitive);
  const m = compiled.expression.exec(pathname);

  if (!m) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < compiled.keys.length; i++) {
    const raw = m[i + 1];
    if (raw === undefined) {
      continue;
    }

    let value = raw;
    if (decode) {
      try {
        value = decodeURIComponent(raw);
      } catch {}
    }

    params[compiled.keys[i]] = value;
  }

  return { route, params, pathname };
}
