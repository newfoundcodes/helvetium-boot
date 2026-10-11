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

export class HTTPError extends Error {
  readonly status: number;
  readonly headers?: HeadersInit;
  readonly expose: boolean;
  readonly details?: unknown;

  constructor(
    status: number,
    message?: string,
    options: { headers?: HeadersInit; expose?: boolean; cause?: unknown; details?: unknown } = {},
  ) {
    super(message ?? `HTTP ${status}`, { cause: options.cause });
    this.name = 'HTTPError';

    this.status = status;
    this.headers = options.headers;
    this.expose = options.expose ?? status < 500;
    this.details = options.details;
  }
}

export class ValidationError extends HTTPError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, message, { expose: true, details });
    this.name = 'ValidationError';
  }
}

export class BodyLimitError extends HTTPError {
  constructor(limit: number) {
    super(413, `Request body exceeds ${limit} bytes`, { expose: true });
    this.name = 'BodyLimitError';
  }
}

export class TimeoutError extends HTTPError {
  constructor(ms: number) {
    super(504, `Request exceeded ${ms} ms timeout`, { expose: true });
    this.name = 'TimeoutError';
  }
}

export function toHTTPError(error: unknown): HTTPError {
  if (error instanceof HTTPError) {
    return error;
  }

  if (error instanceof Error) {
    return new HTTPError(500, error.message, { cause: error, expose: false });
  }

  return new HTTPError(500, 'Internal Server Error', { details: error, expose: false });
}
