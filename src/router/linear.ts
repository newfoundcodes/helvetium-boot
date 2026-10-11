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

import type { Entry, RouteMatch, RouteRecord, RouterEngine } from '../interfaces/router.js';
import { compilePattern } from './pattern.js';

export class LinearRouter implements RouterEngine {
  readonly name: string = 'linear';
  private entries: Entry[] = [];

  constructor(
    private readonly caseSensitive = false,
    private readonly decodeParams = true,
  ) {}

  add(route: RouteRecord): void {
    const c = compilePattern(route.path, true, this.caseSensitive);

    this.entries.push({ route, expression: c.expression, keys: c.keys, score: c.score });
    this.entries.sort((a, b) => b.score - a.score || a.route.order - b.route.order);
  }

  match(method: string, pathname: string): RouteMatch[] {
    const out: RouteMatch[] = [];
    for (const e of this.entries) {
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
    this.entries = [];
  }

  clone(): RouterEngine {
    return new LinearRouter(this.caseSensitive, this.decodeParams);
  }
}
