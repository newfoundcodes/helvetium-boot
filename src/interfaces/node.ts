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

import type { WebSocketHandlers } from './websocket.js';

export interface NodeWebSocketRegistry {
  readonly size: number;
  match(pathname: string): { handlers: WebSocketHandlers; params: Record<string, string> } | null;
}

export interface NodeApplication {
  fetch(request: Request): Promise<Response> | Response;
  readonly websockets?: NodeWebSocketRegistry;
}

export interface NodeServeOptions {
  app: NodeApplication;
  port?: number;
  hostname?: string;
  maxBodyBytes?: number;
  trustProxy?: boolean;
  websocket?: boolean;
  requestTimeout?: number;
  headersTimeout?: number;
  keepAliveTimeout?: number;
  maxHeadersCount?: number;
  maxWebSocketPayload?: number;
}

export interface NodeServerHandle {
  server: unknown;
  readonly url: string;
  readonly ready: Promise<string>;

  close(): Promise<void>;
}

export interface NodeStaticContext {
  req: { method: string; url: string };
}
