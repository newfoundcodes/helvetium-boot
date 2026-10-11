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

import type { Bucket } from '../interfaces/router.js';
import type { RouterEngine, RouteRecord, RouteMatch } from '../interfaces/router.js';
import { compilePattern, normalizePath } from './pattern.js';

export class TrieRouter implements RouterEngine {
  readonly name = 'trie';
  private buckets = new Map<string, Bucket[]>();
  private fallback: Bucket[] = [];

  constructor(
    private readonly caseSensitive = false,
    private readonly decodeParams = true,
  ) {}

  add(route: RouteRecord): void {
    const c = compilePattern(route.path, true, this.caseSensitive);
    const b = { route, expression: c.expression, keys: c.keys, score: c.score };
    const normalized = normalizePath(route.path);
    const first = normalized === '*' ? '' : (normalized.split('/')[1] ?? '');
    const dynamic = !first || first.startsWith(':') || first.startsWith('*');
    const list = dynamic
      ? this.fallback
      : (this.buckets.get(this.caseSensitive ? first : first.toLowerCase()) ?? []);

    list.push(b);
    list.sort((a, b) => b.score - a.score || a.route.order - b.route.order);

    if (!dynamic) {
      this.buckets.set(this.caseSensitive ? first : first.toLowerCase(), list);
    }
  }

  match(method: string, pathname: string): RouteMatch[] {
    const first = pathname.split('/')[1] ?? '';
    const candidates = [
      ...(this.buckets.get(this.caseSensitive ? first : first.toLowerCase()) ?? []),
      ...this.fallback,
    ].sort((a, b) => b.score - a.score || a.route.order - b.route.order);
    const out: RouteMatch[] = [];

    for (const e of candidates) {
      if (e.route.method !== '*' && e.route.method !== method.toUpperCase()) {
        continue;
      }

      const m = e.expression.exec(pathname);
      if (!m) {
        continue;
      }

      const params: Record<string, string> = {};
      for (let i = 0; i < e.keys.length; i++) {
        const raw = m[i + 1];
        if (raw === undefined) {
          continue;
        }

        let v = raw;
        if (this.decodeParams) {
          try {
            v = decodeURIComponent(raw);
          } catch {}
        }

        params[e.keys[i]] = v;
      }

      out.push({ route: e.route, params, pathname });
    }

    return out;
  }

  clear(): void {
    this.buckets.clear();
    this.fallback = [];
  }

  clone(): RouterEngine {
    return new TrieRouter(this.caseSensitive, this.decodeParams);
  }
}
