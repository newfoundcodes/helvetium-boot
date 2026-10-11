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
  HelvetiumComponent,
  HelvetiumDocumentTemplate,
  HelvetiumVNodeChild,
} from '../integration/helvetium-dom.js';

export interface HelvetiumRouteDefinition {
  id?: string;
  path: string;
  component: HelvetiumComponent<Record<string, unknown>>;
  end?: boolean;
  title?: string | ((match: HelvetiumRouteMatch) => string);
  meta?: Readonly<Record<string, unknown>>;
}

export interface HelvetiumRouteMatch {
  route: HelvetiumRouteDefinition;
  params: Readonly<Record<string, string>>;
  pathname: string;
}

export interface HelvetiumRouter {
  readonly kind: 'browser' | 'static';
  readonly routes: readonly HelvetiumRouteDefinition[];
  readonly basePath: string;

  readonly location: {
    href: string;
    pathname: string;
    search: string;
    hash: string;
    state: unknown;
    key?: string;
  };

  readonly match: HelvetiumRouteMatch | null;
  readonly notFound: HelvetiumComponent<Record<string, unknown>> | undefined;
}

export interface HelvetiumDOMRuntime {
  h(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): unknown;
  RouterProvider: unknown;
  RouterOutlet: unknown;

  createStaticRouter(
    routes: readonly HelvetiumRouteDefinition[],
    options: {
      url: string;
      basePath?: string;
      notFound?: HelvetiumComponent<Record<string, unknown>>;
    },
  ): HelvetiumRouter;

  matchRoutes(
    routes: readonly HelvetiumRouteDefinition[],
    pathname: string,
    options?: { basePath?: string },
  ): HelvetiumRouteMatch | null;

  renderToString(view: unknown, options?: { identifierPrefix?: string }): string;
  isVNode(value: unknown): boolean;
}

export interface HelvetiumPagesContext {
  req: { method: string; url: string; header(name: string): string | undefined };
  request: Request;
}

export interface HelvetiumClientNavigationOptions {
  enabled?: boolean;

  scriptNonce?: string;
}

export interface HelvetiumNavigationPayload {
  version: 1;
  url: string;
  html: string;
  head: string;
  title?: string;
  mountId: string;
  bootstrap: HelvetiumBootstrap;
}

export interface HelvetiumPageOptions {
  routes: readonly HelvetiumRouteDefinition[];
  basePath?: string;
  notFound?: HelvetiumComponent<Record<string, unknown>>;
  clientEntry?: string;

  clientNavigation?: boolean | HelvetiumClientNavigationOptions;

  scriptNonce?: string;
  mountId?: string;
  identifierPrefix?: string;
  lang?: string;
  head?: string | ((request: Request, router: HelvetiumRouter) => string | Promise<string>);
  render?: (router: HelvetiumRouter, request: Request) => HelvetiumVNodeChild;
  document?: (
    content: string,
    context: {
      request: Request;
      router: HelvetiumRouter;
      head: string;
      bootstrap: string;
      clientEntry?: string;
      mountId: string;
      navigationScript: string;
      scriptNonce?: string;
    },
  ) => string | Promise<string>;
  headers?: HeadersInit;
  status?: number | ((router: HelvetiumRouter) => number);
}

export interface ResolvedHelvetiumPageOptions extends HelvetiumPageOptions {
  template?: HelvetiumDocumentTemplate;
}

export interface TemplateVNodeShape {
  kind: unknown;
  props?: Record<string, unknown>;
  key?: unknown;
  ref?: unknown;
}

export interface HelvetiumBootstrap {
  version: 1;
  url: string;
  basePath: string;
  routeId: string | null;
  params: Record<string, string>;
  identifierPrefix: string;
}
