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

import type { WebSocketData } from '../websocket.js';

export interface WebSocketMessageEvent {
  data: WebSocketData;
  binary: boolean;
}

export interface WebSocketCloseEvent {
  code: number;
  reason: string;
  wasClean: boolean;
}

export interface WebSocketHandlerContext {
  request: Request;
  params: Record<string, string>;
}

export interface WebSocketHandlers {
  open?(socket: BootWebSocket, context: WebSocketHandlerContext): void | Promise<void>;

  message?(
    event: WebSocketMessageEvent,
    socket: BootWebSocket,
    context: WebSocketHandlerContext,
  ): void | Promise<void>;

  close?(
    event: WebSocketCloseEvent,
    socket: BootWebSocket,
    context: WebSocketHandlerContext,
  ): void | Promise<void>;

  error?(
    error: unknown,
    socket: BootWebSocket,
    context: WebSocketHandlerContext,
  ): void | Promise<void>;
}

export interface WSRoute {
  path: string;
  expression: RegExp;
  keys: string[];
  handlers: WebSocketHandlers;
  order: number;
}

export interface BootWebSocket {
  readonly readyState: 0 | 1 | 2 | 3;
  readonly protocol: string;

  send(data: WebSocketData): void;
  ping(data?: WebSocketData): void;
  close(code?: number, reason?: string): void;
}
