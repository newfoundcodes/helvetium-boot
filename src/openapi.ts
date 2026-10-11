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

import type { Boot } from './app.js';
import type { StandardSchemaV1 } from './interfaces/app.js';
import type {
  ComponentSchemaReference,
  ExpandedPath,
  ExpandedPathParameter,
  OpenAPIAnnotatedHandler,
  OpenAPIComponentsObject,
  OpenAPIDocument,
  OpenAPIExampleObject,
  OpenAPIGenerationOptions,
  OpenAPIHeaderObject,
  OpenAPIInfoObject,
  OpenAPILinkObject,
  OpenAPIMediaTypeObject,
  OpenAPIOAuthFlowsObject,
  OpenAPIOperationObject,
  OpenAPIParameterObject,
  OpenAPIPathItemObject,
  OpenAPIReferenceObject,
  OpenAPIRequestBodyObject,
  OpenAPIResponseObject,
  OpenAPIRouteDescription,
  OpenAPIRouteHandlerOptions,
  OpenAPISchemaObject,
  OpenAPIValidationDescriptor,
  OpenAPIValidationIssue,
  SchemaResolverOptions,
} from './interfaces/openapi.js';
import type { RouteMetadata, RouteRecord } from './interfaces/router.js';
import type { Handler, Middleware } from './types.js';

export type OpenAPISchema = OpenAPISchemaObject | OpenAPIReferenceObject | boolean;
export type OpenAPIResponsesObject = Record<string, OpenAPIResponseObject | OpenAPIReferenceObject>;
export type OpenAPICallbackObject = Record<string, OpenAPIPathItemObject | OpenAPIReferenceObject>;
export type OpenAPISecurityRequirementObject = Record<string, string[]>;

export type OpenAPISecuritySchemeBase = {
  description?: string;
  [extension: `x-${string}`]: unknown;
};

export type OpenAPISecuritySchemeObject = OpenAPISecuritySchemeBase &
  (
    | { type: 'apiKey'; name: string; in: 'query' | 'header' | 'cookie' }
    | { type: 'http'; scheme: string; bearerFormat?: string }
    | { type: 'mutualTLS' }
    | { type: 'oauth2'; flows: OpenAPIOAuthFlowsObject }
    | { type: 'openIdConnect'; openIdConnectUrl: string }
  );

export type APIInfo = OpenAPIInfoObject;
export type OpenAPISchemaResolver = (schema: unknown) => OpenAPISchema | undefined;

export class OpenAPIValidationError extends Error {
  readonly issues: readonly OpenAPIValidationIssue[];

  constructor(issues: readonly OpenAPIValidationIssue[]) {
    super(
      `OpenAPI document validation failed with ${issues.filter((issue) => issue.severity === 'error').length} error(s)`,
    );

    this.name = 'OpenAPIValidationError';
    this.issues = issues;
  }
}

export const kOpenAPIRoute = Symbol.for('@newfoundcodes/helvetium-boot/openapi/route');
export const kOpenAPIValidation = Symbol.for('@newfoundcodes/helvetium-boot/openapi/validation');
export const kOpenAPIComponent = Symbol.for(
  '@newfoundcodes/helvetium-boot/openapi/component-schema',
);

const schemaResolvers = new Map<string, OpenAPISchemaResolver>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isReference(value: unknown): value is OpenAPIReferenceObject {
  return isRecord(value) && typeof value.$ref === 'string';
}

function isStandardSchema(value: unknown): value is StandardSchemaV1<unknown, unknown> {
  return isRecord(value) && isRecord(value['~standard']) && value['~standard'].version === 1;
}

function hasJSONSchemaMethod(value: unknown): value is { toJSONSchema(): OpenAPISchema } {
  return isRecord(value) && typeof value.toJSONSchema === 'function';
}

function deepMerge<T>(base: T, overlay: unknown): T {
  if (!isRecord(base) || !isRecord(overlay)) {
    return overlay as T;
  }

  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const previous = out[key];
    out[key] = isRecord(previous) && isRecord(value) ? deepMerge(previous, value) : value;
  }

  return out as T;
}

function cloneSchema<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneSchema(item)) as T;
  }

  if (!isRecord(value)) {
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = cloneSchema(item);
  }

  const component = (value as unknown as ComponentSchemaReference)[kOpenAPIComponent];
  if (component) {
    Object.defineProperty(out, kOpenAPIComponent, { value: component, enumerable: false });
  }

  return out as T;
}

export function registerOpenAPISchemaResolver(
  vendor: string,
  resolverFn: OpenAPISchemaResolver,
): () => void {
  if (!vendor) {
    throw new TypeError('OpenAPI schema resolver vendor is required');
  }

  schemaResolvers.set(vendor, resolverFn);
  return () => {
    if (schemaResolvers.get(vendor) === resolverFn) {
      schemaResolvers.delete(vendor);
    }
  };
}

export function resolveOpenAPISchema(
  source: unknown,
  options: SchemaResolverOptions = {},
): OpenAPISchema {
  let resolved: OpenAPISchema | undefined = options.schema;
  if (resolved === undefined) {
    if (typeof source === 'boolean') {
      resolved = source;
    } else if (hasJSONSchemaMethod(source)) {
      resolved = source.toJSONSchema();
    } else if (isReference(source)) {
      resolved = source;
    } else if (isStandardSchema(source)) {
      const vendor = String(source['~standard'].vendor ?? '');
      resolved = schemaResolvers.get(vendor)?.(source);
    } else if (isRecord(source)) {
      resolved = source as OpenAPISchemaObject;
    }
  }

  if (resolved === undefined) {
    throw new TypeError(
      'Schema cannot be converted to OpenAPI/JSON Schema. Supply resolver(..., { schema }) or registerOpenAPISchemaResolver().',
    );
  }

  let output = cloneSchema(resolved);
  if (options.overlay && isRecord(output)) {
    output = deepMerge(output, options.overlay);
  }

  if (options.ref) {
    return componentSchema(options.ref, output);
  }

  return output;
}

export function resolver(source: unknown, options: SchemaResolverOptions = {}): OpenAPISchema {
  return resolveOpenAPISchema(source, options);
}

export function componentSchema(
  name: string,
  schema: unknown,
  options: Omit<SchemaResolverOptions, 'ref'> = {},
): OpenAPIReferenceObject {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new TypeError(`Invalid OpenAPI component name: ${name}`);
  }

  const definition = resolveOpenAPISchema(schema, options);
  const ref: ComponentSchemaReference = { $ref: `#/components/schemas/${name}` };

  Object.defineProperty(ref, kOpenAPIComponent, {
    value: { name, schema: definition },
    enumerable: false,
  });
  return ref;
}

export function describeRoute(description: OpenAPIRouteDescription): Middleware {
  if (!description || typeof description !== 'object') {
    throw new TypeError('describeRoute() requires a description object');
  }

  const middleware: OpenAPIAnnotatedHandler = (_context, next) => next();
  Object.defineProperty(middleware, kOpenAPIRoute, {
    value: cloneSchema(description),
    enumerable: false,
  });
  return middleware;
}

export function describeResponse<
  E = Record<string, unknown>,
  V extends Record<string, unknown> = Record<string, unknown>,
>(handler: Handler<E, V>, responses: OpenAPIResponsesObject): Handler<E, V> {
  const annotated = handler as OpenAPIAnnotatedHandler;
  const previous = annotated[kOpenAPIRoute];

  Object.defineProperty(annotated, kOpenAPIRoute, {
    value: mergeRouteDescriptions(previous ? [previous, { responses }] : [{ responses }]),
    configurable: true,
    enumerable: false,
  });
  return handler;
}

export function annotateOpenAPIValidation<T extends Function>(
  handler: T,
  descriptor: OpenAPIValidationDescriptor,
): T {
  Object.defineProperty(handler, kOpenAPIValidation, { value: descriptor, enumerable: false });
  return handler;
}

export function getOpenAPIRouteDescription(handler: unknown): OpenAPIRouteDescription | undefined {
  return typeof handler === 'function'
    ? (handler as OpenAPIAnnotatedHandler)[kOpenAPIRoute]
    : undefined;
}

export function getOpenAPIValidationDescriptor(
  handler: unknown,
): OpenAPIValidationDescriptor | undefined {
  return typeof handler === 'function'
    ? (handler as OpenAPIAnnotatedHandler)[kOpenAPIValidation]
    : undefined;
}

function mergeParameters(
  left: Array<OpenAPIParameterObject | OpenAPIReferenceObject> = [],
  right: Array<OpenAPIParameterObject | OpenAPIReferenceObject> = [],
): Array<OpenAPIParameterObject | OpenAPIReferenceObject> {
  const map = new Map<string, OpenAPIParameterObject | OpenAPIReferenceObject>();
  for (const parameter of [...left, ...right]) {
    const key = isReference(parameter)
      ? `$ref:${parameter.$ref}`
      : `${parameter.in}:${parameter.in === 'header' ? parameter.name.toLowerCase() : parameter.name}`;
    map.set(key, parameter);
  }

  return [...map.values()];
}

export function mergeRouteDescriptions(
  descriptions: readonly OpenAPIRouteDescription[],
): OpenAPIRouteDescription {
  const out: OpenAPIRouteDescription = {};
  for (const description of descriptions) {
    for (const [key, value] of Object.entries(description)) {
      if (value === undefined) {
        continue;
      }

      if (key === 'tags') {
        out.tags = [...new Set([...(out.tags ?? []), ...(value as string[])])];
      } else if (key === 'parameters') {
        out.parameters = mergeParameters(
          out.parameters,
          value as Array<OpenAPIParameterObject | OpenAPIReferenceObject>,
        );
      } else if (key === 'responses') {
        out.responses = { ...(out.responses ?? {}), ...(value as OpenAPIResponsesObject) };
      } else if (key === 'callbacks') {
        out.callbacks = {
          ...(out.callbacks ?? {}),
          ...(value as Record<string, OpenAPICallbackObject | OpenAPIReferenceObject>),
        };
      } else if (key === 'pathItem') {
        out.pathItem = deepMerge(out.pathItem ?? {}, value) as OpenAPIRouteDescription['pathItem'];
      } else {
        (out as Record<string, unknown>)[key] = cloneSchema(value);
      }
    }
  }

  return out;
}

function legacyDescription(metadata?: RouteMetadata): OpenAPIRouteDescription | undefined {
  if (!metadata) {
    return undefined;
  }

  const hasLegacy = [
    'name',
    'operationId',
    'summary',
    'description',
    'tags',
    'deprecated',
    'security',
    'consumes',
    'produces',
  ].some((key) => metadata[key] !== undefined);
  const embedded = isRecord(metadata.openapi)
    ? (metadata.openapi as OpenAPIRouteDescription)
    : undefined;

  if (!hasLegacy) {
    return embedded;
  }

  const security = Array.isArray(metadata.security)
    ? metadata.security.map((name) => ({ [String(name)]: [] }))
    : undefined;
  return mergeRouteDescriptions([
    {
      operationId:
        typeof metadata.operationId === 'string'
          ? metadata.operationId
          : typeof metadata.name === 'string'
            ? metadata.name
            : undefined,
      summary: typeof metadata.summary === 'string' ? metadata.summary : undefined,
      description: typeof metadata.description === 'string' ? metadata.description : undefined,
      tags: Array.isArray(metadata.tags) ? metadata.tags.map(String) : undefined,
      deprecated: typeof metadata.deprecated === 'boolean' ? metadata.deprecated : undefined,
      security,
    },
    ...(embedded ? [embedded] : []),
  ]);
}

export function routeOpenAPIDescription(route: RouteRecord): OpenAPIRouteDescription | undefined {
  const pieces: OpenAPIRouteDescription[] = [];
  const legacy = legacyDescription(route.metadata);

  if (legacy) {
    pieces.push(legacy);
  }

  for (const handler of route.handlers) {
    const description = getOpenAPIRouteDescription(handler);
    if (description) {
      pieces.push(description);
    }
  }

  return pieces.length ? mergeRouteDescriptions(pieces) : undefined;
}

export function routeOpenAPIValidations(route: RouteRecord): OpenAPIValidationDescriptor[] {
  const out: OpenAPIValidationDescriptor[] = [];
  for (const handler of route.handlers) {
    const descriptor = getOpenAPIValidationDescriptor(handler);
    if (descriptor) {
      out.push(descriptor);
    }
  }

  return out;
}

export function expandOpenAPIPaths(path: string): ExpandedPath[] {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/') {
    return [{ path: '/', parameters: [] }];
  }

  const segments = normalized.split('/').slice(1);
  let variants: Array<{ segments: string[]; parameters: ExpandedPathParameter[] }> = [
    { segments: [], parameters: [] },
  ];

  for (const segment of segments) {
    const optional = /^:([A-Za-z0-9_]+)\?$/.exec(segment);
    if (optional) {
      const name = optional[1];
      const next: typeof variants = [];

      for (const variant of variants) {
        next.push({ segments: [...variant.segments], parameters: [...variant.parameters] });
        next.push({
          segments: [...variant.segments, `{${name}}`],
          parameters: [...variant.parameters, { name, optional: true, splat: false }],
        });
      }

      variants = next;
      continue;
    }

    const dynamic = /^:([A-Za-z0-9_]+)$/.exec(segment);
    if (dynamic) {
      const name = dynamic[1];
      variants = variants.map((variant) => ({
        segments: [...variant.segments, `{${name}}`],
        parameters: [...variant.parameters, { name, optional: false, splat: false }],
      }));
      continue;
    }

    const splat = /^\*([A-Za-z0-9_]*)$/.exec(segment);
    if (splat) {
      const name = splat[1] || 'splat';
      variants = variants.map((variant) => ({
        segments: [...variant.segments, `{${name}}`],
        parameters: [...variant.parameters, { name, optional: false, splat: true }],
      }));
      continue;
    }

    variants = variants.map((variant) => ({
      segments: [...variant.segments, segment],
      parameters: variant.parameters,
    }));
  }

  return variants.map((variant) => ({
    path: `/${variant.segments.join('/')}`,
    parameters: variant.parameters,
  }));
}

function safeResolveSchema(
  descriptor: OpenAPIValidationDescriptor,
  strict: boolean,
): OpenAPISchema {
  if (descriptor.options.schema !== undefined) {
    return cloneSchema(descriptor.options.schema);
  }

  try {
    return resolveOpenAPISchema(descriptor.sourceSchema);
  } catch (error) {
    if (strict) {
      throw error;
    }

    const vendor = isStandardSchema(descriptor.sourceSchema)
      ? String(descriptor.sourceSchema['~standard'].vendor)
      : 'unknown';
    return { 'x-helvetium-unresolved-schema': true, 'x-helvetium-schema-vendor': vendor };
  }
}

function objectProperties(
  schema: OpenAPISchema,
): { properties: Record<string, OpenAPISchema>; required: Set<string> } | undefined {
  if (
    !isRecord(schema) ||
    isReference(schema) ||
    schema.type !== 'object' ||
    !isRecord(schema.properties)
  ) {
    return undefined;
  }

  const properties: Record<string, OpenAPISchema> = {};
  for (const [name, value] of Object.entries(schema.properties)) {
    properties[name] = value as OpenAPISchema;
  }

  return {
    properties,
    required: new Set(Array.isArray(schema.required) ? schema.required.map(String) : []),
  };
}

function inferParametersFromValidator(
  descriptor: OpenAPIValidationDescriptor,
  strict: boolean,
): OpenAPIParameterObject[] {
  if (descriptor.options.hide) {
    return [];
  }

  if (!['query', 'queries', 'header', 'cookie', 'param'].includes(descriptor.target)) {
    return [];
  }

  const resolved = safeResolveSchema(descriptor, strict);
  const object = objectProperties(resolved);

  if (!object) {
    return [];
  }

  const location: OpenAPIParameterObject['in'] =
    descriptor.target === 'param'
      ? 'path'
      : descriptor.target === 'queries'
        ? 'query'
        : (descriptor.target as OpenAPIParameterObject['in']);
  return Object.entries(object.properties).map(([name, propertySchema]) => {
    const overlay = descriptor.options.parameters?.[name] ?? {};
    return {
      name,
      in: location,
      required: location === 'path' ? true : object.required.has(name),
      schema: propertySchema,
      ...overlay,
      ...(location === 'path' ? { required: true } : {}),
    };
  });
}

function inferRequestBody(
  validations: OpenAPIValidationDescriptor[],
  strict: boolean,
): OpenAPIRequestBodyObject | undefined {
  const content: Record<string, OpenAPIMediaTypeObject> = {};
  let required = false;
  let description: string | undefined;

  for (const descriptor of validations) {
    if (descriptor.options.hide || !['json', 'form', 'body'].includes(descriptor.target)) {
      continue;
    }

    const mediaType =
      descriptor.options.mediaType ??
      (descriptor.target === 'json'
        ? 'application/json'
        : descriptor.target === 'form'
          ? 'application/x-www-form-urlencoded'
          : 'application/octet-stream');
    content[mediaType] = { schema: safeResolveSchema(descriptor, strict) };

    required ||= descriptor.options.required ?? true;
    description ??= descriptor.options.description;
  }

  return Object.keys(content).length
    ? { content, required, ...(description ? { description } : {}) }
    : undefined;
}

function parameterKey(parameter: OpenAPIParameterObject | OpenAPIReferenceObject): string {
  return isReference(parameter)
    ? `$ref:${parameter.$ref}`
    : `${parameter.in}:${parameter.name.toLowerCase()}`;
}

function mergeInferredAndManualParameters(
  inferred: OpenAPIParameterObject[],
  manual: Array<OpenAPIParameterObject | OpenAPIReferenceObject> = [],
): Array<OpenAPIParameterObject | OpenAPIReferenceObject> {
  const map = new Map<string, OpenAPIParameterObject | OpenAPIReferenceObject>();
  for (const parameter of inferred) {
    map.set(parameterKey(parameter), parameter);
  }

  for (const parameter of manual) {
    map.set(parameterKey(parameter), cloneSchema(parameter));
  }

  return [...map.values()];
}

function mergeRequestBody(
  inferred: OpenAPIRequestBodyObject | undefined,
  manual: OpenAPIRequestBodyObject | OpenAPIReferenceObject | undefined,
): OpenAPIRequestBodyObject | OpenAPIReferenceObject | undefined {
  if (!manual) {
    return inferred;
  }

  if (!inferred || isReference(manual)) {
    return cloneSchema(manual);
  }

  return {
    ...inferred,
    ...cloneSchema(manual),
    content: { ...inferred.content, ...manual.content },
  };
}

function stableSchemaString(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSchemaString).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableSchemaString((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function materializeComponents(value: unknown, components: OpenAPIComponentsObject): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => materializeComponents(item, components));
  }

  if (!isRecord(value)) {
    return value;
  }

  const component = (value as unknown as ComponentSchemaReference)[kOpenAPIComponent];
  if (component) {
    components.schemas ??= {};
    const existing = components.schemas[component.name];
    if (existing && stableSchemaString(existing) !== stableSchemaString(component.schema)) {
      throw new TypeError(
        `OpenAPI schema component '${component.name}' was declared with conflicting definitions`,
      );
    }

    components.schemas[component.name] = materializeComponents(
      component.schema,
      components,
    ) as OpenAPISchema;
    return { $ref: `#/components/schemas/${component.name}` };
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = materializeComponents(item, components);
  }

  return out;
}

function normalizeOperationId(method: string, path: string): string {
  const parts = path
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[{}*?:]/g, ''))
    .filter(Boolean);
  return (
    [method.toLowerCase(), ...parts].join('_').replace(/[^A-Za-z0-9_]/g, '_') ||
    `${method.toLowerCase()}_root`
  );
}

function operationMethod(method: string): keyof OpenAPIPathItemObject | undefined {
  const normalized = method.toLowerCase();
  return ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'].includes(normalized)
    ? (normalized as keyof OpenAPIPathItemObject)
    : undefined;
}

function pathParameterFallbacks(expanded: ExpandedPath): OpenAPIParameterObject[] {
  return expanded.parameters.map(({ name, splat }) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
    ...(splat
      ? {
          description:
            'Helvetium Boot splat parameter. Runtime values may contain slash-separated path segments.',
          'x-helvetium-splat': true,
        }
      : {}),
  }));
}

function adjustParametersForExpandedPath(
  parameters: Array<OpenAPIParameterObject | OpenAPIReferenceObject>,
  expanded: ExpandedPath,
): Array<OpenAPIParameterObject | OpenAPIReferenceObject> {
  const presentPathNames = new Set(expanded.parameters.map((parameter) => parameter.name));
  const out = parameters.filter(
    (parameter) =>
      isReference(parameter) || parameter.in !== 'path' || presentPathNames.has(parameter.name),
  );

  for (const fallback of pathParameterFallbacks(expanded)) {
    const key = parameterKey(fallback);
    const index = out.findIndex((parameter) => parameterKey(parameter) === key);

    if (index === -1) {
      out.push(fallback);
    } else if (!isReference(out[index])) {
      out[index] = { ...fallback, ...(out[index] as OpenAPIParameterObject), required: true };
    }
  }

  return out;
}

function normalizeOptions(input?: APIInfo | OpenAPIGenerationOptions): OpenAPIGenerationOptions {
  if (!input) {
    return {};
  }

  if ('title' in input && 'version' in input && !('info' in input) && !('documentation' in input)) {
    return { info: input as APIInfo };
  }

  return input as OpenAPIGenerationOptions;
}

export function generateOpenAPI(
  app: Boot<Record<string, unknown>, Record<string, unknown>>,
  input: APIInfo | OpenAPIGenerationOptions = {},
): OpenAPIDocument {
  const options = normalizeOptions(input);
  const documentation = cloneSchema(options.documentation ?? {});
  const info: OpenAPIInfoObject = options.info ??
    documentation.info ?? { title: 'Helvetium Boot API', version: '1.0.0' };
  const components: OpenAPIComponentsObject = cloneSchema(documentation.components ?? {});
  const paths: Record<string, OpenAPIPathItemObject> = {};
  const operationIds = new Set<string>();
  const defaultResponse =
    options.defaultResponse === false
      ? undefined
      : (options.defaultResponse ?? { description: 'Successful response' });
  const includeEmptyPaths = options.includeEmptyPaths ?? true;
  const includeHidden = options.includeHidden ?? false;
  const strictSchemaResolution = options.strictSchemaResolution ?? false;
  const autoOperationIds = options.autoOperationIds ?? true;

  for (const route of app.routes) {
    if (route.method === '*' || options.filter?.(route) === false) {
      continue;
    }

    const method = operationMethod(String(route.method));
    if (!method) {
      continue;
    }

    const description = routeOpenAPIDescription(route);
    if (!description && !includeEmptyPaths) {
      continue;
    }

    if (description?.hide && !includeHidden) {
      continue;
    }

    const validations = routeOpenAPIValidations(route);
    const inferredParameters = validations.flatMap((descriptor) =>
      inferParametersFromValidator(descriptor, strictSchemaResolution),
    );
    const allParameters = mergeInferredAndManualParameters(
      inferredParameters,
      description?.parameters,
    );
    const inferredRequestBody = inferRequestBody(validations, strictSchemaResolution);
    const requestBody = mergeRequestBody(inferredRequestBody, description?.requestBody);

    const expandedPaths = expandOpenAPIPaths(route.path);
    for (const [variantIndex, expanded] of expandedPaths.entries()) {
      const operationParameters = adjustParametersForExpandedPath(allParameters, expanded);
      const responses =
        description?.responses ?? (defaultResponse ? { '200': defaultResponse } : {});
      const explicitOperationId = description?.operationId
        ? expandedPaths.length === 1 || variantIndex === expandedPaths.length - 1
          ? description.operationId
          : `${description.operationId}__variant_${variantIndex + 1}`
        : undefined;
      const operationId =
        explicitOperationId ??
        (autoOperationIds ? normalizeOperationId(String(route.method), expanded.path) : undefined);

      if (operationId) {
        if (
          operationIds.has(operationId) &&
          (options.duplicateOperationId ?? 'error') === 'error'
        ) {
          throw new TypeError(`Duplicate OpenAPI operationId: ${operationId}`);
        }

        operationIds.add(operationId);
      }

      const operation: OpenAPIOperationObject = {
        ...(description?.tags ? { tags: description.tags } : {}),
        ...(description?.summary ? { summary: description.summary } : {}),
        ...(description?.description ? { description: description.description } : {}),
        ...(description?.externalDocs ? { externalDocs: description.externalDocs } : {}),
        ...(operationId ? { operationId } : {}),
        ...(operationParameters.length ? { parameters: operationParameters } : {}),
        ...(requestBody ? { requestBody } : {}),
        responses,
        ...(description?.callbacks ? { callbacks: description.callbacks } : {}),
        ...(description?.deprecated !== undefined ? { deprecated: description.deprecated } : {}),
        ...(description?.security ? { security: description.security } : {}),
        ...(description?.servers ? { servers: description.servers } : {}),
      };

      for (const [key, value] of Object.entries(description ?? {})) {
        if (key.startsWith('x-')) {
          (operation as unknown as Record<string, unknown>)[key] = value;
        }
      }

      const pathItem = paths[expanded.path] ?? {};
      if (description?.pathItem) {
        const pathMetadata = cloneSchema(description.pathItem) as Record<string, unknown>;
        for (const [key, value] of Object.entries(pathMetadata)) {
          if (key === 'parameters') {
            pathItem.parameters = mergeParameters(
              pathItem.parameters,
              value as Array<OpenAPIParameterObject | OpenAPIReferenceObject>,
            );
          } else {
            (pathItem as Record<string, unknown>)[key] = value;
          }
        }
      }

      (pathItem as Record<string, unknown>)[method as string] = materializeComponents(
        operation,
        components,
      );
      paths[expanded.path] = pathItem;
    }
  }

  const document: OpenAPIDocument = {
    ...documentation,
    openapi: options.openapi ?? documentation.openapi ?? '3.1.2',
    info,
    paths,
    ...(Object.keys(components).length
      ? { components: materializeComponents(components, components) as OpenAPIComponentsObject }
      : {}),
  };

  if (options.validate ?? true) {
    assertOpenAPIDocument(document);
  }

  return document;
}

export const createOpenAPIDocument = generateOpenAPI;

export function openAPIRouteHandler(
  app: Boot<Record<string, unknown>, Record<string, unknown>>,
  options: OpenAPIRouteHandlerOptions = {},
): Handler {
  return (_) => {
    const document = generateOpenAPI(app, options);
    const headers = new Headers(options.headers);
    headers.set('content-type', 'application/json; charset=utf-8');

    if (options.cacheControl) {
      headers.set('cache-control', options.cacheControl);
    }

    return new Response(JSON.stringify(document, null, options.pretty ?? 0), {
      status: 200,
      headers,
    });
  };
}

export const openAPISpecs = openAPIRouteHandler;

export function validateOpenAPIDocument(document: OpenAPIDocument): OpenAPIValidationIssue[] {
  const issues: OpenAPIValidationIssue[] = [];
  const error = (path: string, message: string) =>
    issues.push({ path, message, severity: 'error' as const });
  const warning = (path: string, message: string) =>
    issues.push({ path, message, severity: 'warning' as const });
  const operationIds = new Map<string, string>();
  const visitedPathItems = new WeakSet<object>();

  const validateExample = (value: OpenAPIExampleObject | OpenAPIReferenceObject, locus: string) => {
    if (isReference(value)) {
      return;
    }

    if ('value' in value && value.externalValue !== undefined) {
      error(locus, 'Example Object cannot define both value and externalValue');
    }
  };

  const validateMediaType = (value: OpenAPIMediaTypeObject, locus: string) => {
    if (value.example !== undefined && value.examples !== undefined) {
      error(locus, 'Media Type Object cannot define both example and examples');
    }

    for (const [name, example] of Object.entries(value.examples ?? {})) {
      validateExample(example, `${locus}.examples.${name}`);
    }
  };

  const validateHeader = (value: OpenAPIHeaderObject | OpenAPIReferenceObject, locus: string) => {
    if (isReference(value)) {
      return;
    }

    const hasSchema = value.schema !== undefined;
    const hasContent = value.content !== undefined;

    if (hasSchema === hasContent) {
      error(locus, 'Header Object must define exactly one of schema or content');
    }

    if (value.content && Object.keys(value.content).length !== 1) {
      error(`${locus}.content`, 'Header Object content must contain exactly one media type');
    }

    if (value.example !== undefined && value.examples !== undefined) {
      error(locus, 'Header Object cannot define both example and examples');
    }

    for (const [name, example] of Object.entries(value.examples ?? {})) {
      validateExample(example, `${locus}.examples.${name}`);
    }

    for (const [mediaType, media] of Object.entries(value.content ?? {})) {
      validateMediaType(media, `${locus}.content.${mediaType}`);
    }
  };

  const validateParameter = (
    parameter: OpenAPIParameterObject | OpenAPIReferenceObject,
    locus: string,
  ) => {
    if (isReference(parameter)) {
      return;
    }

    const hasSchema = parameter.schema !== undefined;
    const hasContent = parameter.content !== undefined;

    if (hasSchema === hasContent) {
      error(locus, 'Parameter Object must define exactly one of schema or content');
    }

    if (parameter.content && Object.keys(parameter.content).length !== 1) {
      error(`${locus}.content`, 'Parameter Object content must contain exactly one media type');
    }

    if (parameter.in === 'path' && parameter.required !== true) {
      error(locus, 'Path parameters must set required: true');
    }

    if (parameter.example !== undefined && parameter.examples !== undefined) {
      error(locus, 'Parameter Object cannot define both example and examples');
    }

    for (const [name, example] of Object.entries(parameter.examples ?? {})) {
      validateExample(example, `${locus}.examples.${name}`);
    }

    for (const [mediaType, media] of Object.entries(parameter.content ?? {})) {
      validateMediaType(media, `${locus}.content.${mediaType}`);
    }
  };

  const validateLink = (link: OpenAPILinkObject | OpenAPIReferenceObject, locus: string) => {
    if (isReference(link)) {
      return;
    }

    const count = Number(link.operationRef !== undefined) + Number(link.operationId !== undefined);
    if (count !== 1) {
      error(locus, 'Link Object must define exactly one of operationRef or operationId');
    }
  };

  const validateResponse = (
    response: OpenAPIResponseObject | OpenAPIReferenceObject,
    locus: string,
  ) => {
    if (isReference(response)) {
      return;
    }

    if (typeof response.description !== 'string') {
      error(`${locus}.description`, 'Response Object description is required');
    }

    for (const [name, header] of Object.entries(response.headers ?? {})) {
      validateHeader(header, `${locus}.headers.${name}`);
    }

    for (const [mediaType, media] of Object.entries(response.content ?? {})) {
      validateMediaType(media, `${locus}.content.${mediaType}`);
    }

    for (const [name, link] of Object.entries(response.links ?? {})) {
      validateLink(link, `${locus}.links.${name}`);
    }
  };

  const validateRequestBody = (
    body: OpenAPIRequestBodyObject | OpenAPIReferenceObject | undefined,
    locus: string,
  ) => {
    if (!body || isReference(body)) {
      return;
    }

    const entries = Object.entries(body.content ?? {});
    if (entries.length === 0) {
      error(`${locus}.content`, 'Request Body Object content must contain at least one media type');
    }

    for (const [mediaType, media] of entries) {
      validateMediaType(media, `${locus}.content.${mediaType}`);
    }
  };

  const parameterIdentity = (
    parameter: OpenAPIParameterObject | OpenAPIReferenceObject,
  ): string | undefined => {
    if (isReference(parameter)) {
      return undefined;
    }

    const name = parameter.in === 'header' ? parameter.name.toLowerCase() : parameter.name;
    return `${parameter.in}:${name}`;
  };

  const validateParameterList = (
    parameters: Array<OpenAPIParameterObject | OpenAPIReferenceObject>,
    locus: string,
  ) => {
    const seen = new Set<string>();
    parameters.forEach((parameter, index) => {
      validateParameter(parameter, `${locus}.${index}`);

      const identity = parameterIdentity(parameter);
      if (identity && seen.has(identity)) {
        error(`${locus}.${index}`, `Duplicate parameter '${identity}'`);
      }

      if (identity) {
        seen.add(identity);
      }
    });
  };

  const validateOperation = (
    operation: OpenAPIOperationObject,
    locus: string,
    pathItemParameters: Array<OpenAPIParameterObject | OpenAPIReferenceObject>,
    templatePath?: string,
  ) => {
    const operationParameters = operation.parameters ?? [];
    validateParameterList(operationParameters, `${locus}.parameters`);

    const effectiveParameters = [...pathItemParameters, ...operationParameters];
    const effectiveSeen = new Set<string>();

    for (const parameter of effectiveParameters) {
      const identity = parameterIdentity(parameter);
      if (identity && effectiveSeen.has(identity)) {
        continue;
      }

      if (identity) {
        effectiveSeen.add(identity);
      }
    }

    if (templatePath !== undefined) {
      const templates = [...templatePath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      const templateSet = new Set(templates);

      for (const name of templates) {
        const parameter = [...effectiveParameters]
          .reverse()
          .find(
            (candidate) =>
              !isReference(candidate) && candidate.in === 'path' && candidate.name === name,
          ) as OpenAPIParameterObject | undefined;

        if (!parameter) {
          error(`${locus}.parameters`, `Missing required path parameter '${name}'`);
        } else if (parameter.required !== true) {
          error(`${locus}.parameters.${name}`, 'Path parameters must set required: true');
        }
      }

      for (const parameter of effectiveParameters) {
        if (
          !isReference(parameter) &&
          parameter.in === 'path' &&
          !templateSet.has(parameter.name)
        ) {
          error(
            `${locus}.parameters.${parameter.name}`,
            `Path parameter '${parameter.name}' has no matching {${parameter.name}} template`,
          );
        }
      }
    }

    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      error(`${locus}.responses`, 'Operation responses must contain at least one response');
    }

    for (const [status, response] of Object.entries(operation.responses ?? {})) {
      if (!status.startsWith('x-') && !/^(?:default|[1-5](?:[0-9]{2}|XX))$/.test(status)) {
        error(
          `${locus}.responses.${status}`,
          'Response key must be default, a 100-599 status code, or a 1XX-5XX range',
        );
      }

      if (!status.startsWith('x-')) {
        validateResponse(response, `${locus}.responses.${status}`);
      }
    }

    validateRequestBody(operation.requestBody, `${locus}.requestBody`);

    if (operation.operationId) {
      const previous = operationIds.get(operation.operationId);
      if (previous) {
        error(
          `${locus}.operationId`,
          `Duplicate operationId '${operation.operationId}' also used by ${previous}`,
        );
      } else {
        operationIds.set(operation.operationId, locus);
      }
    }

    for (const [name, callback] of Object.entries(operation.callbacks ?? {})) {
      if (isReference(callback)) {
        continue;
      }

      for (const [expression, callbackPathItem] of Object.entries(callback)) {
        if (isReference(callbackPathItem)) {
          continue;
        }

        validatePathItem(callbackPathItem, `${locus}.callbacks.${name}.${expression}`);
      }
    }
  };

  const operationKeys = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
  ] as const;

  const validatePathItem = (
    pathItem: OpenAPIPathItemObject,
    locus: string,
    templatePath?: string,
  ) => {
    if (visitedPathItems.has(pathItem)) {
      return;
    }

    visitedPathItems.add(pathItem);

    const pathParameters = pathItem.parameters ?? [];
    validateParameterList(pathParameters, `${locus}.parameters`);

    for (const method of operationKeys) {
      const operation = pathItem[method];
      if (operation) {
        validateOperation(operation, `${locus}.${method}`, pathParameters, templatePath);
      }
    }
  };

  if (!/^3\.1\.\d+(?:-.+)?$/.test(document.openapi)) {
    warning('openapi', `Helvetium Boot targets OpenAPI 3.1.x; received ${document.openapi}`);
  }

  if (!document.info?.title) {
    error('info.title', 'info.title is required');
  }

  if (!document.info?.version) {
    error('info.version', 'info.version is required');
  }

  if (document.info?.license?.identifier !== undefined && document.info.license.url !== undefined) {
    error('info.license', 'License Object cannot define both identifier and url');
  }

  if (!document.paths || typeof document.paths !== 'object') {
    error('paths', 'paths must be an object when present');
  }

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    if (!path.startsWith('/')) {
      error(`paths.${path}`, 'OpenAPI path keys must start with /');
    }

    validatePathItem(pathItem, `paths.${path}`, path);
  }

  for (const [name, pathItem] of Object.entries(document.webhooks ?? {})) {
    if (!isReference(pathItem)) {
      validatePathItem(pathItem, `webhooks.${name}`);
    }
  }

  const componentNamePattern = /^[A-Za-z0-9._-]+$/;
  const componentGroups = document.components
    ? Object.entries(document.components).filter(([key]) => !key.startsWith('x-'))
    : [];

  for (const [group, values] of componentGroups) {
    if (!isRecord(values)) {
      continue;
    }

    for (const name of Object.keys(values)) {
      if (!componentNamePattern.test(name)) {
        error(`components.${group}.${name}`, 'Component keys must match ^[A-Za-z0-9._-]+$');
      }
    }
  }

  for (const [name, parameter] of Object.entries(document.components?.parameters ?? {})) {
    validateParameter(parameter, `components.parameters.${name}`);
  }

  for (const [name, header] of Object.entries(document.components?.headers ?? {})) {
    validateHeader(header, `components.headers.${name}`);
  }

  for (const [name, response] of Object.entries(document.components?.responses ?? {})) {
    validateResponse(response, `components.responses.${name}`);
  }

  for (const [name, body] of Object.entries(document.components?.requestBodies ?? {})) {
    validateRequestBody(body, `components.requestBodies.${name}`);
  }

  for (const [name, example] of Object.entries(document.components?.examples ?? {})) {
    validateExample(example, `components.examples.${name}`);
  }

  for (const [name, link] of Object.entries(document.components?.links ?? {})) {
    validateLink(link, `components.links.${name}`);
  }

  for (const [name, pathItem] of Object.entries(document.components?.pathItems ?? {})) {
    if (!isReference(pathItem)) {
      validatePathItem(pathItem, `components.pathItems.${name}`);
    }
  }

  for (const [name, callback] of Object.entries(document.components?.callbacks ?? {})) {
    if (isReference(callback)) {
      continue;
    }

    for (const [expression, pathItem] of Object.entries(callback)) {
      if (!isReference(pathItem)) {
        validatePathItem(pathItem, `components.callbacks.${name}.${expression}`);
      }
    }
  }

  for (const [name, scheme] of Object.entries(document.components?.securitySchemes ?? {})) {
    if (isReference(scheme)) {
      continue;
    }

    const locus = `components.securitySchemes.${name}`;
    if (scheme.type === 'apiKey' && (!scheme.name || !scheme.in)) {
      error(locus, 'apiKey Security Scheme requires name and in');
    }

    if (scheme.type === 'http' && !scheme.scheme) {
      error(locus, 'http Security Scheme requires scheme');
    }

    if (scheme.type === 'oauth2' && !scheme.flows) {
      error(locus, 'oauth2 Security Scheme requires flows');
    }

    if (scheme.type === 'openIdConnect' && !scheme.openIdConnectUrl) {
      error(locus, 'openIdConnect Security Scheme requires openIdConnectUrl');
    }
  }

  return issues;
}

export function assertOpenAPIDocument(document: OpenAPIDocument): OpenAPIDocument {
  const issues = validateOpenAPIDocument(document);
  if (issues.some((issue) => issue.severity === 'error')) {
    throw new OpenAPIValidationError(issues);
  }

  return document;
}
