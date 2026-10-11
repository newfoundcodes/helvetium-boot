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

declare module 'node:http' {
  export const createServer: unknown;
  export type IncomingMessage = unknown;
  export type ServerResponse = unknown;
  export type Server = unknown;
}

declare module 'node:https' {
  export const createServer: unknown;
}

declare module 'node:crypto' {
  export const createHash: unknown;
  export const randomBytes: unknown;
  export const timingSafeEqual: unknown;
}

declare module 'node:zlib' {
  export const gzipSync: unknown;
  export const brotliCompressSync: unknown;
  export const deflateSync: unknown;
}

declare module 'node:fs/promises' {
  export const readFile: unknown;
  export const stat: unknown;
  export const mkdir: unknown;
  export const writeFile: unknown;
}

declare module 'node:path' {
  export const resolve: unknown;
  export const join: unknown;
  export const extname: unknown;
  export const normalize: unknown;
  export const dirname: unknown;
  export const sep: string;
}

declare module 'node:url' {
  export const fileURLToPath: unknown;
}

declare module 'node:net' {
  export type Socket = unknown;
}

declare module 'node:async_hooks' {
  export class AsyncLocalStorage<T> {
    run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R;
    getStore(): T | undefined;
    enterWith(store: T): void;
    disable(): void;
  }
}
