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

import type { RouterEngine, RouteRecord, RouteMatch } from '../interfaces/router.js';
import { TrieRouter } from './trie.js';

export class SmartRouter implements RouterEngine {
  readonly name = 'smart';
  private inner: TrieRouter;

  constructor(caseSensitive = false, decodeParams = true) {
    this.inner = new TrieRouter(caseSensitive, decodeParams);
  }

  add(r: RouteRecord): void {
    this.inner.add(r);
  }

  match(m: string, p: string): RouteMatch[] {
    return this.inner.match(m, p);
  }

  clear(): void {
    this.inner.clear();
  }

  clone(): RouterEngine {
    return new SmartRouter();
  }
}
