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

import { HTTPError } from '../errors.js';
import type { BootContext } from '../context.js';
import type { Handler } from '../types.js';

export class RouteControl extends Error {
  constructor(readonly control: 'route' | 'router') {
    super(control);
  }
}

export type PreRoutingTransform = (request: Request) => Request | Promise<Request>;

function autoResponse<E, V extends Record<string, unknown>>(
  value: unknown,
  context: BootContext<E, V>,
): Response | undefined {
  if (value === undefined) {
    return context.res;
  }

  if (value instanceof Response) {
    return value;
  }

  if (value === null) {
    return context.body(null, 204);
  }

  if (typeof value === 'string') {
    return context.text(value);
  }

  if (value instanceof Uint8Array || value instanceof ArrayBuffer || value instanceof Blob) {
    return context.body(value as BodyInit);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return context.text(String(value));
  }

  if (typeof value === 'object') {
    return context.json(value);
  }

  return context.text(String(value));
}

export async function compose<E, V extends Record<string, unknown>>(
  handlers: readonly Handler<E, V>[],
  context: BootContext<E, V>,
): Promise<Response | undefined> {
  let index = -1;
  const dispatch = async (i: number): Promise<Response | void> => {
    if (i <= index) {
      throw new HTTPError(500, 'next() called more than once');
    }

    index = i;

    const handler = handlers[i];
    if (!handler) {
      return context.res;
    }

    let nextCalled = false;
    const result = await handler(context, async (signal?: unknown) => {
      nextCalled = true;

      if (signal === 'route' || signal === 'router') {
        throw new RouteControl(signal);
      }

      if (signal !== undefined) {
        throw signal;
      }

      return dispatch(i + 1);
    });

    const resolved = autoResponse(result, context);
    if (resolved) {
      context.res = resolved;
    } else if (nextCalled && context.res) {
      return context.res;
    }

    return context.res;
  };

  await dispatch(0);
  return context.res;
}

export const kPreRouting = Symbol.for('@newfoundcodes/helvetium-boot/pre-routing');

export function markPreRouting<T extends Handler>(
  middleware: T,
  transform: PreRoutingTransform,
): T {
  Object.defineProperty(middleware, kPreRouting, { value: transform, enumerable: false });
  return middleware;
}
