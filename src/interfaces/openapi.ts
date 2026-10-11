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

import type {
  kOpenAPIComponent,
  kOpenAPIRoute,
  kOpenAPIValidation,
  OpenAPICallbackObject,
  OpenAPIResponsesObject,
  OpenAPISchema,
  OpenAPISecurityRequirementObject,
  OpenAPISecuritySchemeObject,
} from '../openapi.js';
import type { Handler, ValidationTarget } from '../types.js';
import type { RouteRecord } from './router.js';

export interface OpenAPIReferenceObject {
  $ref: string;
  summary?: string;
  description?: string;
}

export interface OpenAPISchemaObject extends Record<string, unknown> {
  $id?: string;
  $schema?: string;
  $ref?: string;
  $defs?: Record<string, OpenAPISchemaObject | boolean>;
  type?: string | string[];
  title?: string;
  description?: string;
  format?: string;
  default?: unknown;
  examples?: unknown[];
  example?: unknown;
  const?: unknown;
  enum?: unknown[];
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  properties?: Record<string, OpenAPISchemaObject | OpenAPIReferenceObject | boolean>;
  patternProperties?: Record<string, OpenAPISchemaObject | OpenAPIReferenceObject | boolean>;
  additionalProperties?: OpenAPISchemaObject | OpenAPIReferenceObject | boolean;
  items?: OpenAPISchemaObject | OpenAPIReferenceObject | boolean;
  prefixItems?: Array<OpenAPISchemaObject | OpenAPIReferenceObject | boolean>;
  allOf?: Array<OpenAPISchemaObject | OpenAPIReferenceObject | boolean>;
  anyOf?: Array<OpenAPISchemaObject | OpenAPIReferenceObject | boolean>;
  oneOf?: Array<OpenAPISchemaObject | OpenAPIReferenceObject | boolean>;
  not?: OpenAPISchemaObject | OpenAPIReferenceObject | boolean;
  if?: OpenAPISchemaObject | OpenAPIReferenceObject | boolean;
  then?: OpenAPISchemaObject | OpenAPIReferenceObject | boolean;
  else?: OpenAPISchemaObject | OpenAPIReferenceObject | boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  contentEncoding?: string;
  contentMediaType?: string;
  discriminator?: { propertyName: string; mapping?: Record<string, string> };
  xml?: Record<string, unknown>;
  externalDocs?: OpenAPIExternalDocumentationObject;
}

export interface OpenAPIExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIEncodingObject {
  contentType?: string;
  headers?: Record<string, OpenAPIHeaderObject | OpenAPIReferenceObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIMediaTypeObject {
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExampleObject | OpenAPIReferenceObject>;
  encoding?: Record<string, OpenAPIEncodingObject>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIHeaderObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  style?: 'simple';
  explode?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExampleObject | OpenAPIReferenceObject>;
  content?: Record<string, OpenAPIMediaTypeObject>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExampleObject | OpenAPIReferenceObject>;
  content?: Record<string, OpenAPIMediaTypeObject>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIRequestBodyObject {
  description?: string;
  content: Record<string, OpenAPIMediaTypeObject>;
  required?: boolean;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPILinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  description?: string;
  server?: OpenAPIServerObject;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIResponseObject {
  description: string;
  headers?: Record<string, OpenAPIHeaderObject | OpenAPIReferenceObject>;
  content?: Record<string, OpenAPIMediaTypeObject>;
  links?: Record<string, OpenAPILinkObject | OpenAPIReferenceObject>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIExternalDocumentationObject {
  description?: string;
  url: string;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
}

export interface OpenAPIServerObject {
  url: string;
  description?: string;
  variables?: Record<string, OpenAPIServerVariableObject>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIOperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocumentationObject;
  operationId?: string;
  parameters?: Array<OpenAPIParameterObject | OpenAPIReferenceObject>;
  requestBody?: OpenAPIRequestBodyObject | OpenAPIReferenceObject;
  responses: OpenAPIResponsesObject;
  callbacks?: Record<string, OpenAPICallbackObject | OpenAPIReferenceObject>;
  deprecated?: boolean;
  security?: OpenAPISecurityRequirementObject[];
  servers?: OpenAPIServerObject[];
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIPathItemObject {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OpenAPIOperationObject;
  put?: OpenAPIOperationObject;
  post?: OpenAPIOperationObject;
  delete?: OpenAPIOperationObject;
  options?: OpenAPIOperationObject;
  head?: OpenAPIOperationObject;
  patch?: OpenAPIOperationObject;
  trace?: OpenAPIOperationObject;
  servers?: OpenAPIServerObject[];
  parameters?: Array<OpenAPIParameterObject | OpenAPIReferenceObject>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface OpenAPILicenseObject {
  name: string;
  identifier?: string;
  url?: string;
}

export interface OpenAPIInfoObject {
  title: string;
  summary?: string;
  description?: string;
  termsOfService?: string;
  contact?: OpenAPIContactObject;
  license?: OpenAPILicenseObject;
  version: string;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPITagObject {
  name: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocumentationObject;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIOAuthImplicitFlowObject {
  authorizationUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIOAuthPasswordFlowObject {
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIOAuthClientCredentialsFlowObject {
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIOAuthAuthorizationCodeFlowObject {
  authorizationUrl: string;
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIOAuthFlowsObject {
  implicit?: OpenAPIOAuthImplicitFlowObject;
  password?: OpenAPIOAuthPasswordFlowObject;
  clientCredentials?: OpenAPIOAuthClientCredentialsFlowObject;
  authorizationCode?: OpenAPIOAuthAuthorizationCodeFlowObject;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIComponentsObject {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponseObject | OpenAPIReferenceObject>;
  parameters?: Record<string, OpenAPIParameterObject | OpenAPIReferenceObject>;
  examples?: Record<string, OpenAPIExampleObject | OpenAPIReferenceObject>;
  requestBodies?: Record<string, OpenAPIRequestBodyObject | OpenAPIReferenceObject>;
  headers?: Record<string, OpenAPIHeaderObject | OpenAPIReferenceObject>;
  securitySchemes?: Record<string, OpenAPISecuritySchemeObject | OpenAPIReferenceObject>;
  links?: Record<string, OpenAPILinkObject | OpenAPIReferenceObject>;
  callbacks?: Record<string, OpenAPICallbackObject | OpenAPIReferenceObject>;
  pathItems?: Record<string, OpenAPIPathItemObject | OpenAPIReferenceObject>;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfoObject;
  jsonSchemaDialect?: string;
  servers?: OpenAPIServerObject[];
  paths: Record<string, OpenAPIPathItemObject>;
  webhooks?: Record<string, OpenAPIPathItemObject | OpenAPIReferenceObject>;
  components?: OpenAPIComponentsObject;
  security?: OpenAPISecurityRequirementObject[];
  tags?: OpenAPITagObject[];
  externalDocs?: OpenAPIExternalDocumentationObject;
  [extension: `x-${string}`]: unknown;
}

export interface OpenAPIRouteDescription extends Omit<
  Partial<OpenAPIOperationObject>,
  'responses'
> {
  responses?: OpenAPIResponsesObject;

  hide?: boolean;

  pathItem?: Pick<OpenAPIPathItemObject, 'summary' | 'description' | 'servers' | 'parameters'> &
    Record<string, unknown>;
}

export interface OpenAPIValidationOptions {
  schema?: OpenAPISchema;

  mediaType?: string;

  parameters?: Record<string, Partial<OpenAPIParameterObject>>;

  description?: string;

  required?: boolean;

  hide?: boolean;
}

export interface OpenAPIValidationDescriptor {
  target: ValidationTarget;
  sourceSchema: unknown;
  options: OpenAPIValidationOptions;
}

export interface SchemaResolverOptions {
  schema?: OpenAPISchema;

  ref?: string;

  overlay?: Record<string, unknown>;
}

export interface OpenAPIGenerationOptions {
  documentation?: Omit<Partial<OpenAPIDocument>, 'paths'> & { info?: OpenAPIInfoObject };

  info?: OpenAPIInfoObject;

  openapi?: string;

  includeEmptyPaths?: boolean;

  includeHidden?: boolean;

  validate?: boolean;

  strictSchemaResolution?: boolean;

  defaultResponse?: OpenAPIResponseObject | false;

  autoOperationIds?: boolean;

  duplicateOperationId?: 'error' | 'ignore';

  filter?: (route: RouteRecord) => boolean;
}

export interface OpenAPIRouteHandlerOptions extends OpenAPIGenerationOptions {
  headers?: HeadersInit;

  cacheControl?: string;

  pretty?: number;
}

export interface OpenAPIValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface OpenAPIAnnotatedHandler extends Handler<unknown, Record<string, unknown>> {
  [kOpenAPIRoute]?: OpenAPIRouteDescription;
  [kOpenAPIValidation]?: OpenAPIValidationDescriptor;
}

export interface ComponentSchemaReference extends OpenAPIReferenceObject {
  [kOpenAPIComponent]?: { name: string; schema: OpenAPISchema };
}

export interface ExpandedPathParameter {
  name: string;
  optional: boolean;
  splat: boolean;
}

export interface ExpandedPath {
  path: string;
  parameters: ExpandedPathParameter[];
}
