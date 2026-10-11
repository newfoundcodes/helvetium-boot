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

import { ValidationError } from './errors.js';
import { annotateOpenAPIValidation, type OpenAPISchema } from './openapi.js';
import type { Middleware, ValidationTarget } from './types.js';
import type { BootRequest } from './request.js';
import type { OpenAPIValidationOptions } from './interfaces/openapi.js';
import type { StandardSchemaV1 } from './interfaces/app.js';

type ValidatorLike<T = unknown> =
  StandardSchemaV1<unknown, T> | ((value: unknown) => T | Promise<T>);

export interface ValidatorOptions<T = unknown> {
  hook?: (
    result: { success: true; data: T } | { success: false; error: unknown },
    context: unknown,
  ) => Response | void | Promise<Response | void>;

  openapi?: OpenAPIValidationOptions;
}

async function source(target: ValidationTarget, context: { req: BootRequest }): Promise<unknown> {
  switch (target) {
    case 'json':
      return context.req.json();
    case 'form': {
      const form = await context.req.formData();
      const output: Record<string, unknown> = {};

      for (const [key, value] of form) {
        const current = output[key];
        output[key] =
          current === undefined
            ? value
            : Array.isArray(current)
              ? [...current, value]
              : [current, value];
      }

      return output;
    }

    case 'query':
      return context.req.query();
    case 'queries':
      return context.req.queries();
    case 'header':
      return context.req.header();
    case 'cookie':
      return context.req.cookie();
    case 'param':
      return context.req.param();
    case 'body':
      return context.req.parseBody();
  }
}

export async function validateValue<T>(schema: ValidatorLike<T>, value: unknown): Promise<T> {
  if (typeof schema === 'function') {
    return schema(value);
  }

  const result = await schema['~standard'].validate(value);
  if ('issues' in result && result.issues) {
    throw new ValidationError('Validation failed', result.issues);
  }

  return (result as { value: T }).value;
}

export function validator<T>(
  target: ValidationTarget,
  validatorSchema: ValidatorLike<T>,
  options: ValidatorOptions<T> = {},
): Middleware {
  const middleware: Middleware = async (context, next) => {
    try {
      const data = await validateValue(
        validatorSchema,
        await source(target, context as { req: BootRequest }),
      );
      context.req.setValid(target, data);

      const hook = await options.hook?.({ success: true, data }, context);
      if (hook) {
        return hook;
      }

      return next();
    } catch (error) {
      const hook = await options.hook?.({ success: false, error }, context);
      if (hook) {
        return hook;
      }

      throw error;
    }
  };

  return annotateOpenAPIValidation(middleware, {
    target,
    sourceSchema: validatorSchema,
    options: options.openapi ?? {},
  });
}

function cloneSchema<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneSchema(item)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = cloneSchema(item);
    }

    return output as T;
  }

  return value;
}

function mergeSchema(base: OpenAPISchema, overlay: Record<string, unknown>): OpenAPISchema {
  if (typeof base === 'boolean') {
    return { ...overlay };
  }

  return { ...cloneSchema(base), ...cloneSchema(overlay) } as OpenAPISchema;
}

class Schema<T> implements StandardSchemaV1<unknown, T> {
  readonly '~standard';
  readonly isOptional: boolean;
  private readonly jsonSchema: OpenAPISchema;

  constructor(
    private readonly parser: (value: unknown, path: string) => T,
    jsonSchema: OpenAPISchema = {},
    optional = false,
  ) {
    this.jsonSchema = jsonSchema;
    this.isOptional = optional;
    this['~standard'] = {
      version: 1 as const,
      vendor: 'helvetium-boot',
      validate: (value: unknown) => {
        try {
          return { value: this.parser(value, '$') };
        } catch (error) {
          return { issues: [error instanceof Error ? error.message : String(error)] };
        }
      },
    };
  }

  parse(value: unknown): T {
    return this.parser(value, '$');
  }

  parseAt(value: unknown, path: string): T {
    return this.parser(value, path);
  }

  toJSONSchema(): OpenAPISchema {
    return cloneSchema(this.jsonSchema);
  }

  optional(): Schema<T | undefined> {
    return new Schema(
      (value, path) => (value === undefined ? undefined : this.parser(value, path)),
      this.jsonSchema,
      true,
    );
  }

  nullable(): Schema<T | null> {
    const schema =
      typeof this.jsonSchema === 'boolean'
        ? this.jsonSchema
        : { anyOf: [cloneSchema(this.jsonSchema), { type: 'null' }] };
    return new Schema(
      (value, path) => (value === null ? null : this.parser(value, path)),
      schema,
      this.isOptional,
    );
  }

  refine(check: (value: T) => boolean, message = 'Refinement failed'): Schema<T> {
    return new Schema(
      (value, path) => {
        const parsed = this.parser(value, path);
        if (!check(parsed)) {
          throw new Error(`${path}: ${message}`);
        }

        return parsed;
      },
      this.jsonSchema,
      this.isOptional,
    );
  }

  transform<U>(transformer: (value: T) => U): Schema<U> {
    return new Schema(
      (value, path) => transformer(this.parser(value, path)),
      {
        ...(typeof this.jsonSchema === 'boolean' ? {} : cloneSchema(this.jsonSchema)),
        'x-helvetium-transform': true,
      },
      this.isOptional,
    );
  }

  openapi(metadata: Record<string, unknown>): Schema<T> {
    return new Schema(this.parser, mergeSchema(this.jsonSchema, metadata), this.isOptional);
  }

  describe(description: string): Schema<T> {
    return this.openapi({ description });
  }

  title(title: string): Schema<T> {
    return this.openapi({ title });
  }

  example(example: unknown): Schema<T> {
    return this.openapi({ examples: [example] });
  }
}

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

export const schema = {
  unknown: () => new Schema<unknown>((value) => value, {}),
  any: () => new Schema<unknown>((value) => value, {}),

  string: (
    options: { min?: number; max?: number; pattern?: RegExp; trim?: boolean; format?: string } = {},
  ) =>
    new Schema<string>(
      (value, path) => {
        if (typeof value !== 'string') {
          fail(path, 'expected string');
        }

        const parsed = options.trim ? value.trim() : value;
        if (options.min !== undefined && parsed.length < options.min) {
          fail(path, `minimum length ${options.min}`);
        }

        if (options.max !== undefined && parsed.length > options.max) {
          fail(path, `maximum length ${options.max}`);
        }

        if (options.pattern && !options.pattern.test(parsed)) {
          fail(path, 'pattern mismatch');
        }

        return parsed;
      },
      {
        type: 'string',
        ...(options.min !== undefined ? { minLength: options.min } : {}),
        ...(options.max !== undefined ? { maxLength: options.max } : {}),
        ...(options.pattern ? { pattern: options.pattern.source } : {}),
        ...(options.format ? { format: options.format } : {}),
      },
    ),

  number: (options: { min?: number; max?: number; integer?: boolean; coerce?: boolean } = {}) =>
    new Schema<number>(
      (value, path) => {
        const parsed =
          options.coerce && typeof value === 'string' && value.trim() !== ''
            ? Number(value)
            : value;
        if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
          fail(path, 'expected finite number');
        }

        if (options.integer && !Number.isInteger(parsed)) {
          fail(path, 'expected integer');
        }

        if (options.min !== undefined && parsed < options.min) {
          fail(path, `minimum ${options.min}`);
        }

        if (options.max !== undefined && parsed > options.max) {
          fail(path, `maximum ${options.max}`);
        }

        return parsed;
      },
      {
        type: options.integer ? 'integer' : 'number',
        ...(options.min !== undefined ? { minimum: options.min } : {}),
        ...(options.max !== undefined ? { maximum: options.max } : {}),
      },
    ),

  boolean: (options: { coerce?: boolean } = {}) =>
    new Schema<boolean>(
      (value, path) => {
        if (options.coerce && typeof value === 'string') {
          if (value === 'true' || value === '1') {
            return true;
          }

          if (value === 'false' || value === '0') {
            return false;
          }
        }

        if (typeof value !== 'boolean') {
          fail(path, 'expected boolean');
        }

        return value;
      },
      { type: 'boolean' },
    ),

  bigint: () =>
    new Schema<bigint>(
      (value, path) => {
        if (typeof value !== 'bigint') {
          fail(path, 'expected bigint');
        }

        return value;
      },
      { type: 'integer', format: 'int64', 'x-helvetium-runtime-type': 'bigint' },
    ),

  literal: <T extends string | number | boolean | null>(expected: T) =>
    new Schema<T>(
      (value, path) =>
        value === expected ? expected : fail(path, `expected literal ${String(expected)}`),
      { ...(expected === null ? { type: 'null' } : { type: typeof expected }), const: expected },
    ),

  enum: <T extends readonly string[]>(values: T) =>
    new Schema<T[number]>(
      (value, path) =>
        typeof value === 'string' && (values as readonly string[]).includes(value)
          ? (value as T[number])
          : fail(path, `expected one of ${values.join(', ')}`),
      { type: 'string', enum: [...values] },
    ),

  array: <T>(item: Schema<T>, options: { min?: number; max?: number } = {}) =>
    new Schema<T[]>(
      (value, path) => {
        if (!Array.isArray(value)) {
          fail(path, 'expected array');
        }

        if (options.min !== undefined && value.length < options.min) {
          fail(path, `minimum items ${options.min}`);
        }

        if (options.max !== undefined && value.length > options.max) {
          fail(path, `maximum items ${options.max}`);
        }

        return value.map((entry, index) => item.parseAt(entry, `${path}[${index}]`));
      },
      {
        type: 'array',
        items: item.toJSONSchema(),
        ...(options.min !== undefined ? { minItems: options.min } : {}),
        ...(options.max !== undefined ? { maxItems: options.max } : {}),
      },
    ),

  object: <S extends Record<string, Schema<unknown>>>(shape: S) => {
    const properties: Record<string, OpenAPISchema> = {};
    const required: string[] = [];

    for (const [key, item] of Object.entries(shape)) {
      properties[key] = item.toJSONSchema();
      if (!item.isOptional) {
        required.push(key);
      }
    }

    return new Schema<{ [K in keyof S]: ReturnType<S[K]['parse']> }>(
      (value, path) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          fail(path, 'expected object');
        }

        const output: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(shape)) {
          output[key] = item.parseAt((value as Record<string, unknown>)[key], `${path}.${key}`);
        }

        return output as { [K in keyof S]: ReturnType<S[K]['parse']> };
      },
      { type: 'object', properties, ...(required.length ? { required } : {}) },
    );
  },

  record: <T>(valueSchema: Schema<T>) =>
    new Schema<Record<string, T>>(
      (value, path) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          fail(path, 'expected record');
        }

        const output: Record<string, T> = {};
        for (const [key, entry] of Object.entries(value)) {
          output[key] = valueSchema.parseAt(entry, `${path}.${key}`);
        }

        return output;
      },
      { type: 'object', additionalProperties: valueSchema.toJSONSchema() },
    ),

  union: <T extends readonly Schema<unknown>[]>(items: T) =>
    new Schema<unknown>(
      (value, path) => {
        const errors: string[] = [];
        for (const item of items) {
          try {
            return item.parseAt(value, path);
          } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
          }
        }

        fail(path, `no union variant matched: ${errors.join('; ')}`);
      },
      { anyOf: items.map((item) => item.toJSONSchema()) },
    ),

  date: (options: { coerce?: boolean } = {}) =>
    new Schema<Date>(
      (value, path) => {
        const date =
          value instanceof Date
            ? value
            : options.coerce && (typeof value === 'string' || typeof value === 'number')
              ? new Date(value)
              : null;
        if (!date || Number.isNaN(date.getTime())) {
          fail(path, 'expected valid Date');
        }

        return date;
      },
      { type: 'string', format: 'date-time', 'x-helvetium-runtime-type': 'Date' },
    ),
};

export type { Schema };
