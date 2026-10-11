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

import { HTTPError } from './errors.js';
import type { RegisteredServerAction, ServerActionOptions } from './interfaces/server-actions.js';
import type { Middleware } from './types.js';

export type ServerActionFunction = (...args: unknown[]) => unknown | Promise<unknown>;

function hasDirective(fn: Function): boolean {
  return /(?:^|\{)\s*['"]use server['"]\s*;?/.test(fn.toString());
}

function stableId(name: string): string {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return `a_${(h >>> 0).toString(36)}`;
}

export class ServerActionRegistry {
  private actions = new Map<string, RegisteredServerAction>();

  register<T extends ServerActionFunction>(fn: T, options: ServerActionOptions = {}): T {
    if (!hasDirective(fn)) {
      throw new TypeError('Server action function must start with a "use server" directive.');
    }

    const id = options.id ?? stableId(fn.name || fn.toString().slice(0, 120));
    if (this.actions.has(id)) {
      throw new Error(`Duplicate server action id: ${id}`);
    }

    this.actions.set(id, { id, fn, options });
    Object.defineProperty(fn, '__helvetiumServerAction', { value: id, enumerable: false });
    return fn;
  }

  get(id: string): RegisteredServerAction | undefined {
    return this.actions.get(id);
  }

  manifest(): Array<{ id: string; name: string }> {
    return [...this.actions.values()].map((a) => ({ id: a.id, name: a.fn.name || 'anonymous' }));
  }
}

export const defaultServerActionRegistry = new ServerActionRegistry();

export function serverAction<T extends ServerActionFunction>(
  fn: T,
  options: ServerActionOptions = {},
): T {
  return defaultServerActionRegistry.register(fn, options);
}

export function getServerActionId(fn: ServerActionFunction): string | undefined {
  return (fn as unknown as { __helvetiumServerAction?: string }).__helvetiumServerAction;
}

export function registerServerAction<T extends ServerActionFunction>(
  registry: ServerActionRegistry,
  fn: T,
  options: ServerActionOptions = {},
): T {
  return registry.register(fn, options);
}

export function serverActions(
  registry: ServerActionRegistry = defaultServerActionRegistry,
  options: { prefix?: string; allowedOrigins?: string[]; maxBodyBytes?: number } = {},
): Middleware {
  const prefix = options.prefix ?? '/__helvetium/actions';
  return async (c, next) => {
    const url = new URL(c.req.url);
    if (!url.pathname.startsWith(prefix + '/') || c.req.method !== 'POST') {
      return next();
    }

    const origin = c.req.header('origin');
    if (origin && options.allowedOrigins && !options.allowedOrigins.includes(origin)) {
      throw new HTTPError(403, 'Server action origin rejected');
    }

    const id = decodeURIComponent(url.pathname.slice(prefix.length + 1));
    const action = registry.get(id);

    if (!action) {
      throw new HTTPError(404, 'Server action not found');
    }

    if (action.options.auth && !(await action.options.auth(c))) {
      throw new HTTPError(403, 'Server action forbidden');
    }

    const body = await c.req.json<{ args?: unknown[] }>({
      limit: options.maxBodyBytes ?? 1_048_576,
    });
    const args = Array.isArray(body.args) ? body.args : [];

    try {
      const value = await action.fn(...args);
      return c.json({ ok: true, value });
    } catch (error) {
      if (error instanceof HTTPError) {
        throw error;
      }

      return c.json(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        500,
      );
    }
  };
}

export function createServerActionClient(
  options: { baseURL?: string; prefix?: string; fetch?: typeof fetch } = {},
): {
  call<T = unknown>(id: string, ...args: unknown[]): Promise<T>;
  bind<T extends ServerActionFunction>(
    id: string,
  ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
} {
  const base =
      options.baseURL ?? (typeof location !== 'undefined' ? location.origin : 'http://localhost'),
    prefix = options.prefix ?? '/__helvetium/actions',
    f = options.fetch ?? fetch;
  const call = async <T>(id: string, ...args: unknown[]): Promise<T> => {
    const res = await f(new URL(`${prefix}/${encodeURIComponent(id)}`, base), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ args }),
      credentials: 'same-origin',
    });
    const payload = (await res.json()) as Record<string, unknown>;

    if (!res.ok || !payload.ok) {
      throw new Error(
        (payload.error as string | undefined) ?? `Server action failed: ${res.status}`,
      );
    }

    return payload.value as T;
  };

  return {
    call,
    bind:
      (id: string) =>
      (...args: unknown[]) =>
        call(id, ...args),
  };
}
