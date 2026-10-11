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

import type { RouteMetadata } from '@newfoundcodes/helvetium-dom';
import type { Handler, MaybePromise } from '../types.js';
import type { RouterEngine } from './router.js';

export interface UseRecord<E, V extends Record<string, unknown>> {
  path: string;
  handlers: Handler<E, V>[];
  order: number;
}

export interface RouteRegistrationOptions {
  metadata?: RouteMetadata;
}

export interface BootOptions<E = Record<string, unknown>> {
  env?: E;
  router?: RouterEngine;
  strictRouting?: boolean;
  caseSensitive?: boolean;
  decodeParams?: boolean;
  requestIdHeader?: string;
}

export interface RequestBodyOptions {
  limit?: number;
}

export interface ResponseInitLike {
  status?: number;
  headers?: HeadersInit;
}

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    validate(
      value: unknown,
    ): MaybePromise<{ value: Output; issues?: undefined } | { issues: readonly unknown[] }>;
  };
}
