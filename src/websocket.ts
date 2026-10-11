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

import type { WebSocketHandlers, WSRoute } from './interfaces/websocket.js';
import { compilePattern } from './router/pattern.js';

export type WebSocketData = string | Uint8Array | ArrayBuffer;

export class WebSocketRouter {
  private routes: WSRoute[] = [];

  route(path: string, handlers: WebSocketHandlers): this {
    const c = compilePattern(path);
    this.routes.push({
      path,
      expression: c.expression,
      keys: c.keys,
      handlers,
      order: this.routes.length,
    });
    return this;
  }

  match(pathname: string): { handlers: WebSocketHandlers; params: Record<string, string> } | null {
    for (const r of this.routes) {
      const m = r.expression.exec(pathname);
      if (!m) {
        continue;
      }

      const params: Record<string, string> = {};
      for (let i = 0; i < r.keys.length; i++) {
        const raw = m[i + 1];
        if (raw !== undefined) {
          try {
            params[r.keys[i]] = decodeURIComponent(raw);
          } catch {
            params[r.keys[i]] = raw;
          }
        }
      }

      return { handlers: r.handlers, params };
    }

    return null;
  }

  get size(): number {
    return this.routes.length;
  }
}

export const websocket = new WebSocketRouter();

export type {
  BootWebSocket,
  WebSocketHandlers,
  WebSocketHandlerContext,
} from './interfaces/websocket.js';
