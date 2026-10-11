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

import type { Handler, HTTPMethod } from '../types.js';

export interface Entry {
  route: RouteRecord;
  expression: RegExp;
  keys: string[];
  score: number;
}

export interface CompiledPattern {
  expression: RegExp;
  keys: string[];
  score: number;
  staticPrefix: string;
}

export interface Bucket {
  route: RouteRecord;
  expression: RegExp;
  keys: string[];
  score: number;
}

export interface RouteMetadata {
  name?: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  security?: string[];
  consumes?: string[];
  produces?: string[];
  [key: string]: unknown;
}

export interface RouteRecord {
  method: HTTPMethod | '*';
  path: string;
  handlers: Handler<unknown, Record<string, unknown>>[];
  metadata?: RouteMetadata;
  id: string;
  order: number;
}

export interface RouteMatch {
  route: RouteRecord;
  params: Record<string, string>;
  pathname: string;
}

export interface RouterEngine {
  readonly name: string;
  add(route: RouteRecord): void;
  match(method: string, pathname: string): RouteMatch[];
  clear(): void;
  clone(): RouterEngine;
}
