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

import { BodyLimitError } from './errors.js';
import { parseCookies } from './cookies.js';
import type { ValidationTarget } from './types.js';
import type { RequestBodyOptions } from './interfaces/app.js';

export class BootRequest {
  readonly raw: Request;
  readonly params: Readonly<Record<string, string>>;
  private bodyCache = new Map<string, unknown>();
  private validated = new Map<ValidationTarget, unknown>();

  constructor(raw: Request, params: Record<string, string> = {}) {
    this.raw = raw;
    this.params = Object.freeze({ ...params });
  }

  get method(): string {
    return this.raw.method;
  }

  get url(): string {
    return this.raw.url;
  }

  get headers(): Headers {
    return this.raw.headers;
  }

  get path(): string {
    return new URL(this.raw.url).pathname;
  }

  get queryString(): string {
    return new URL(this.raw.url).search.slice(1);
  }

  header(name: string): string | undefined;
  header(): Record<string, string>;
  header(name?: string): string | Record<string, string> | undefined {
    if (name) {
      return this.raw.headers.get(name) ?? undefined;
    }

    return Object.fromEntries(this.raw.headers.entries());
  }

  param(name: string): string | undefined;
  param(): Readonly<Record<string, string>>;
  param(name?: string): string | Readonly<Record<string, string>> | undefined {
    return name ? this.params[name] : this.params;
  }

  query(name: string): string | undefined;
  query(): Record<string, string>;
  query(name?: string): string | Record<string, string> | undefined {
    const params = new URL(this.raw.url).searchParams;
    if (name) {
      return params.get(name) ?? undefined;
    }

    const out: Record<string, string> = {};
    for (const [k, v] of params) {
      if (!(k in out)) {
        out[k] = v;
      }
    }

    return out;
  }

  queries(name: string): string[];
  queries(): Record<string, string[]>;
  queries(name?: string): string[] | Record<string, string[]> {
    const params = new URL(this.raw.url).searchParams;
    if (name) {
      return params.getAll(name);
    }

    const out: Record<string, string[]> = {};
    for (const [k, v] of params) {
      (out[k] ??= []).push(v);
    }

    return out;
  }

  cookie(name: string): string | undefined;
  cookie(): Record<string, string>;
  cookie(name?: string): string | Record<string, string> | undefined {
    const cookies = parseCookies(this.raw.headers.get('cookie') ?? '');
    return name ? cookies[name] : cookies;
  }

  async arrayBuffer(options: RequestBodyOptions = {}): Promise<ArrayBuffer> {
    return this.readBody('arrayBuffer', options, (r) => r.arrayBuffer()) as Promise<ArrayBuffer>;
  }

  async text(options: RequestBodyOptions = {}): Promise<string> {
    return this.readBody('text', options, (r) => r.text()) as Promise<string>;
  }

  async json<T = unknown>(options: RequestBodyOptions = {}): Promise<T> {
    return this.readBody('json', options, (r) => r.json()) as Promise<T>;
  }

  async blob(options: RequestBodyOptions = {}): Promise<Blob> {
    return this.readBody('blob', options, (r) => r.blob()) as Promise<Blob>;
  }

  async formData(options: RequestBodyOptions = {}): Promise<FormData> {
    return this.readBody('formData', options, (r) => r.formData()) as Promise<FormData>;
  }

  async parseBody(options: RequestBodyOptions = {}): Promise<unknown> {
    const type = (this.raw.headers.get('content-type') ?? '').toLowerCase();
    if (type.includes('application/json')) {
      return this.json(options);
    }

    if (
      type.includes('application/x-www-form-urlencoded') ||
      type.includes('multipart/form-data')
    ) {
      const fd = await this.formData(options);
      const out: Record<string, unknown> = {};

      for (const [k, v] of fd.entries()) {
        const existing = out[k];
        if (existing === undefined) {
          out[k] = v;
        } else {
          out[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
        }
      }

      return out;
    }

    if (type.startsWith('text/')) {
      return this.text(options);
    }

    return this.arrayBuffer(options);
  }

  private async readBody(
    key: string,
    options: RequestBodyOptions,
    reader: (request: Request) => Promise<unknown>,
  ): Promise<unknown> {
    if (this.bodyCache.has(key)) {
      return this.bodyCache.get(key);
    }

    const length = Number(this.raw.headers.get('content-length') ?? 0);
    if (options.limit && length > options.limit) {
      throw new BodyLimitError(options.limit);
    }

    const clone = this.raw.clone();
    if (options.limit && !length) {
      const buffer = await clone.arrayBuffer();
      if (buffer.byteLength > options.limit) {
        throw new BodyLimitError(options.limit);
      }

      if (key === 'arrayBuffer') {
        this.bodyCache.set(key, buffer);
        return buffer;
      }

      const reconstructed = new Request(clone.url, {
        method: clone.method,
        headers: clone.headers,
        body: buffer,
      });
      const value = await reader(reconstructed);

      this.bodyCache.set(key, value);
      return value;
    }

    const value = await reader(clone);
    this.bodyCache.set(key, value);
    return value;
  }

  setValid(target: ValidationTarget, value: unknown): void {
    this.validated.set(target, value);
  }

  valid<T = unknown>(target: ValidationTarget): T {
    if (!this.validated.has(target)) {
      throw new Error(`No validated value for ${target}`);
    }

    return this.validated.get(target) as T;
  }
}
