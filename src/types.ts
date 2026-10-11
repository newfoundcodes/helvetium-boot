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

import type { BootContext } from './context.js';

export type MaybePromise<T> = T | Promise<T>;
export type HTTPMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD'
  | 'CONNECT'
  | 'TRACE'
  | 'PURGE'
  | 'PROPFIND'
  | 'PROPPATCH'
  | 'MKCOL'
  | 'COPY'
  | 'MOVE'
  | 'LOCK'
  | 'UNLOCK'
  | 'REPORT'
  | 'SEARCH'
  | 'CHECKOUT'
  | 'MERGE'
  | 'M-SEARCH'
  | 'NOTIFY'
  | 'SUBSCRIBE'
  | 'UNSUBSCRIBE'
  | string;

export type Next = (signal?: 'route' | 'router' | unknown) => Promise<Response | void>;

export type Handler<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
> = (context: BootContext<E, V>, next: Next) => MaybePromise<Response | void | unknown>;

export type Middleware<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
> = Handler<E, V>;

export type ParamHandler<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
> = (
  value: string,
  context: BootContext<E, V>,
  next: Next,
) => MaybePromise<Response | void | unknown>;

export type ErrorHandler<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
> = (error: unknown, context: BootContext<E, V>) => MaybePromise<Response>;

export type NotFoundHandler<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
> = (context: BootContext<E, V>) => MaybePromise<Response>;

export type ValidationTarget =
  'json' | 'form' | 'query' | 'queries' | 'header' | 'cookie' | 'param' | 'body';
export type ValidationResult<T = unknown> =
  { success: true; data: T } | { success: false; error: unknown };
