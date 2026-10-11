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

import type { RPCEndpoint } from './interfaces/rpc.js';

export type { RPCEndpoint };

export type RPCInput = {
  param?: Record<string, string | number | boolean>;
  query?: Record<string, string | number | boolean | Array<string | number | boolean> | undefined>;
  json?: unknown;
  form?: Record<string, unknown> | FormData;
  headers?: HeadersInit;
  init?: RequestInit;
};

export type RPCSchema = Record<string, RPCEndpoint<unknown, unknown>>;
export type RPCResult<T> = { response: Response; data: T };

function interpolate(path: string, param: Record<string, string | number | boolean> = {}): string {
  return path
    .replace(/:([A-Za-z0-9_]+)\??/g, (_, k) => {
      if (!(k in param)) {
        throw new Error(`Missing RPC path parameter: ${k}`);
      }

      return encodeURIComponent(String(param[k]));
    })
    .replace(/\/\*([A-Za-z0-9_]*)/g, (_, k) => (k && k in param ? `/${String(param[k])}` : ''));
}

function endpoint(value: string): { method: string; path: string } {
  const i = value.indexOf(' ');
  if (i < 1) {
    throw new Error(`RPC endpoint must be "METHOD /path": ${value}`);
  }

  return { method: value.slice(0, i).toUpperCase(), path: value.slice(i + 1) };
}

export function createRPCClient<S extends RPCSchema = RPCSchema>(
  baseURL: string,
  defaults: RequestInit = {},
): {
  call<K extends keyof S & string>(
    name: K,
    input: S[K]['input'],
  ): Promise<RPCResult<S[K]['output']>>;
  request(name: string, input?: RPCInput): Promise<Response>;
} {
  const request = async (name: string, input: RPCInput = {}): Promise<Response> => {
    const { method, path } = endpoint(name);
    const url = new URL(interpolate(path, input.param), baseURL);

    for (const [k, v] of Object.entries(input.query ?? {})) {
      if (v === undefined) {
        continue;
      }

      for (const x of Array.isArray(v) ? v : [v]) {
        url.searchParams.append(k, String(x));
      }
    }

    const headers = new Headers(defaults.headers);
    new Headers(input.headers).forEach((v, k) => headers.set(k, v));

    let body: BodyInit | undefined;
    if (input.json !== undefined) {
      body = JSON.stringify(input.json);
      headers.set('content-type', 'application/json');
    } else if (input.form instanceof FormData) {
      body = input.form;
    } else if (input.form) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(input.form)) {
        fd.append(k, v instanceof Blob ? v : String(v));
      }

      body = fd;
    }

    return fetch(url, { ...defaults, ...input.init, method, headers, body });
  };

  return {
    request,
    async call(name, input) {
      const response = await request(name, input as RPCInput);
      const type = response.headers.get('content-type') ?? '';
      const data = type.includes('json') ? await response.json() : await response.text();
      return { response, data } as RPCResult<unknown>;
    },
  };
}

export function hc<T = unknown>(baseURL: string, defaults: RequestInit = {}): T {
  const make = (segments: string[]): unknown =>
    new Proxy(() => {}, {
      get(_t, key) {
        if (typeof key !== 'string') {
          return undefined;
        }

        if (key.startsWith('$')) {
          const method = key.slice(1).toUpperCase();
          return async (input: RPCInput = {}) =>
            createRPCClient(baseURL, defaults).request(`${method} /${segments.join('/')}`, input);
        }

        return make([...segments, key]);
      },
    });
  return make([]) as T;
}
