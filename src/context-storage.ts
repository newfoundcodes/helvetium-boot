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

import { AsyncLocalStorage } from 'node:async_hooks';
import type { BootContext } from './context.js';

const storage = new AsyncLocalStorage<BootContext<unknown, Record<string, unknown>>>();

export type ContextStorageMiddleware = (
  context: object,
  next: () => Promise<Response | void>,
) => Promise<Response | void>;

export function contextStorage(): ContextStorageMiddleware {
  return async (context, next) =>
    storage.run(context as BootContext<unknown, Record<string, unknown>>, () => next());
}

export function getContext<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
>(): BootContext<E, V> {
  const context = storage.getStore();
  if (!context) {
    throw new Error(
      'No Helvetium Boot context is active. Install contextStorage() before calling getContext().',
    );
  }

  return context as BootContext<E, V>;
}

export function tryGetContext<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
>(): BootContext<E, V> | undefined {
  return storage.getStore() as BootContext<E, V> | undefined;
}
