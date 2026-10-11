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

export { LinearRouter } from './linear.js';
export { RegExpRouter } from './regexp.js';
export { TrieRouter } from './trie.js';
export { SmartRouter } from './smart.js';
export { compilePattern, normalizePath, matchPattern } from './pattern.js';
import { LinearRouter } from './linear.js';
import { RegExpRouter } from './regexp.js';
import { TrieRouter } from './trie.js';
import { SmartRouter } from './smart.js';
import type { RouterEngine } from '../interfaces/router.js';

export type RouterPreset = 'linear' | 'regexp' | 'trie' | 'smart' | 'minimal' | 'high-cardinality';

export function createRouter(preset: RouterPreset = 'smart'): RouterEngine {
  switch (preset) {
    case 'linear':
    case 'minimal':
      return new LinearRouter();
    case 'regexp':
      return new RegExpRouter();
    case 'trie':
    case 'high-cardinality':
      return new TrieRouter();
    default:
      return new SmartRouter();
  }
}
