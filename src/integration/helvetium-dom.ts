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

import * as H from '@newfoundcodes/helvetium-dom';
import type {
  HelvetiumBootstrap,
  HelvetiumClientNavigationOptions,
  HelvetiumDOMRuntime,
  HelvetiumNavigationPayload,
  HelvetiumPageOptions,
  HelvetiumPagesContext,
  HelvetiumRouter,
  ResolvedHelvetiumPageOptions,
  TemplateVNodeShape,
} from '../interfaces/dom.js';

export type {
  HelvetiumBootstrap,
  HelvetiumClientNavigationOptions,
  HelvetiumNavigationPayload,
  HelvetiumPageOptions,
  HelvetiumPagesContext,
  HelvetiumRouteDefinition,
  HelvetiumRouteMatch,
  HelvetiumRouter,
  ResolvedHelvetiumPageOptions,
} from '../interfaces/dom.js';

export type HelvetiumComponent<P = Record<string, unknown>> = (props: P) => unknown;
export type HelvetiumVNodeChild = unknown;

export type HelvetiumPagesMiddleware = (
  context: HelvetiumPagesContext,
  next: () => Promise<Response | void>,
) => Response | void | Promise<Response | void>;

export type HelvetiumDocumentTemplate = HelvetiumVNodeChild;

let runtimePromise: Promise<HelvetiumDOMRuntime> | undefined;

async function loadHelvetiumDOM(): Promise<HelvetiumDOMRuntime> {
  runtimePromise ??= Promise.resolve(H as unknown as HelvetiumDOMRuntime).catch((error) => {
    runtimePromise = undefined;
    throw new Error(
      'Helvetium DOM integration requires the optional peer dependency @newfoundcodes/helvetium-dom. Install @newfoundcodes/helvetium-dom before using helvetiumPages() or renderHelvetiumDocument().',
      { cause: error },
    );
  });
  return runtimePromise;
}

function safeJSON(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export const HELVETIUM_NAVIGATION_MEDIA_TYPE = 'application/vnd.helvetium.page+json';
export const HELVETIUM_NAVIGATION_HEADER = 'x-helvetium-navigation';

function resolveClientNavigation(
  options: HelvetiumPageOptions,
): HelvetiumClientNavigationOptions | null {
  if (options.clientNavigation === false) {
    return null;
  }

  if (options.clientNavigation === true || options.clientNavigation === undefined) {
    return { enabled: true };
  }

  return options.clientNavigation.enabled === false ? null : options.clientNavigation;
}

function resolveScriptNonce(options: HelvetiumPageOptions): string | undefined {
  if (options.scriptNonce) {
    return options.scriptNonce;
  }

  const navigation = resolveClientNavigation(options);
  return navigation?.scriptNonce;
}

function routeTitle(router: HelvetiumRouter): string | undefined {
  const title = router.match?.route.title;
  if (!title) {
    return undefined;
  }

  return typeof title === 'function' ? title(router.match) : title;
}

function navigationRuntimeSource(config: { mountId: string; basePath: string }): string {
  const serialized = safeJSON(config);
  return `(()=>{const C=${serialized};if(globalThis.__HELVETIUM_BOOT_NAVIGATION__)return;const A='${HELVETIUM_NAVIGATION_MEDIA_TYPE}',H='${HELVETIUM_NAVIGATION_HEADER}';let active;const inBase=p=>C.basePath==='/'?p.startsWith('/'):p===C.basePath||p.startsWith(C.basePath+'/');const emit=(n,d)=>dispatchEvent(new CustomEvent(n,{detail:d}));const scroll=(url,skip)=>{if(skip)return;queueMicrotask(()=>{if(url.hash){let id=url.hash.slice(1);try{id=decodeURIComponent(id)}catch{}const el=document.getElementById(id);if(el&&typeof el.scrollIntoView==='function'){el.scrollIntoView();return}}if(typeof scrollTo==='function')scrollTo(0,0)})};async function visit(url,opt={}){if(active)active.abort();const controller=new AbortController();active=controller;emit('helvetium:navigation',{url:url.href});try{const response=await fetch(url.href,{method:'GET',headers:{accept:A,[H]:'1'},credentials:'same-origin',redirect:'follow',signal:controller.signal});const type=response.headers.get('content-type')||'';if(!type.toLowerCase().startsWith(A)){if(!opt.pop)location.assign(url.href);else location.reload();return}const payload=await response.json();if(controller.signal.aborted)return;const root=document.getElementById(payload.mountId||C.mountId);if(!root){location.assign(payload.url||url.href);return}const template=document.createElement('template');template.innerHTML=payload.html;root.replaceChildren(template.content.cloneNode(true));globalThis.__HELVETIUM_BOOT__=payload.bootstrap;if(payload.title)document.title=payload.title;const finalURL=new URL(payload.url||url.href,location.href);if(url.hash&&!finalURL.hash)finalURL.hash=url.hash;if(!opt.pop){const href=finalURL.pathname+finalURL.search+finalURL.hash;if(opt.replace)history.replaceState(null,'',href);else history.pushState(null,'',href)}scroll(finalURL,opt.preventScrollReset);emit('helvetium:navigated',{url:finalURL.href,bootstrap:payload.bootstrap,head:payload.head,title:payload.title})}catch(error){if(error&&error.name==='AbortError')return;emit('helvetium:navigationerror',{url:url.href,error});if(!opt.pop)location.assign(url.href);else location.reload()}finally{if(active===controller)active=undefined}}document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const target=event.target instanceof Element?event.target.closest('a[data-helvetium-anchor]'):null;if(!target)return;if(target.hasAttribute('download')||target.hasAttribute('data-helvetium-reload-document'))return;const browsingTarget=target.getAttribute('target');if(browsingTarget&&browsingTarget.toLowerCase()!=='_self')return;const url=new URL(target.href,location.href);if(url.origin!==location.origin||!inBase(url.pathname))return;event.preventDefault();void visit(url,{replace:target.hasAttribute('data-helvetium-replace'),preventScrollReset:target.hasAttribute('data-helvetium-prevent-scroll-reset')})});addEventListener('popstate',()=>{void visit(new URL(location.href),{pop:true,preventScrollReset:true})});globalThis.__HELVETIUM_BOOT_NAVIGATION__={visit:(to,options)=>visit(new URL(to,location.href),options||{}),version:1}})();`;
}

function navigationScriptTag(
  options: HelvetiumPageOptions,
  router: HelvetiumRouter,
  mountId: string,
): string {
  const navigation = resolveClientNavigation(options);
  if (!navigation) {
    return '';
  }

  const scriptNonce = resolveScriptNonce(options);
  const nonce = scriptNonce ? ` nonce="${scriptNonce.replace(/"/g, '&quot;')}"` : '';
  return `<script${nonce}>${navigationRuntimeSource({ mountId, basePath: router.basePath })}</script>`;
}

function defaultDocument(
  content: string,
  context: {
    head: string;
    bootstrap: string;
    clientEntry?: string;
    mountId: string;
    navigationScript: string;
    scriptNonce?: string;
  },
  lang = 'en',
): string {
  const nonce = context.scriptNonce
    ? ` nonce="${context.scriptNonce.replace(/"/g, '&quot;')}"`
    : '';
  return `<!doctype html><html lang="${lang.replace(/"/g, '&quot;')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.head}</head><body><div id="${context.mountId.replace(/"/g, '&quot;')}">${content}</div><script${nonce}>globalThis.__HELVETIUM_BOOT__=${context.bootstrap}</script>${context.navigationScript}${context.clientEntry ? `<script type="module" src="${context.clientEntry.replace(/"/g, '&quot;')}"></script>` : ''}</body></html>`;
}

function isNavigationRequest(request: Request): boolean {
  return (
    request.headers.get(HELVETIUM_NAVIGATION_HEADER) === '1' ||
    (request.headers.get('accept') ?? '').toLowerCase().includes(HELVETIUM_NAVIGATION_MEDIA_TYPE)
  );
}

function normalizePagesArguments(
  templateOrOptions: HelvetiumDocumentTemplate | HelvetiumPageOptions,
  maybeOptions?: HelvetiumPageOptions,
): ResolvedHelvetiumPageOptions {
  if (maybeOptions === undefined) {
    return templateOrOptions as HelvetiumPageOptions;
  }

  return { ...maybeOptions, template: templateOrOptions as HelvetiumDocumentTemplate };
}

function cloneTemplateWithRouteMount(
  dom: HelvetiumDOMRuntime,
  template: HelvetiumDocumentTemplate,
  routeMount: unknown,
): unknown {
  if (!dom.isVNode(template)) {
    throw new TypeError(
      'helvetiumPages(template, options) requires a Helvetium DOM component VNode such as <Index />.',
    );
  }

  const vnode = template as TemplateVNodeShape;
  if (typeof vnode.kind !== 'function') {
    throw new TypeError(
      'The helvetiumPages() document template root must be a component VNode. Wrap <html> in a component and pass <Index />.',
    );
  }

  const props: Record<string, unknown> = { ...(vnode.props ?? {}) };
  if (vnode.key != null) {
    props.key = vnode.key;
  }

  if (vnode.ref != null) {
    props.ref = vnode.ref;
  }

  return dom.h(vnode.kind, props, routeMount);
}

function injectBeforeClosingTag(html: string, tag: 'head' | 'body', insertion: string): string {
  if (!insertion) {
    return html;
  }

  const closing = `</${tag}>`;
  const index = html.toLowerCase().lastIndexOf(closing);
  if (index === -1) {
    return `${html}${insertion}`;
  }

  return `${html.slice(0, index)}${insertion}${html.slice(index)}`;
}

function bootstrapScriptTag(bootstrap: string, scriptNonce?: string): string {
  const nonce = scriptNonce ? ` nonce="${scriptNonce.replace(/"/g, '&quot;')}"` : '';
  return `<script${nonce}>globalThis.__HELVETIUM_BOOT__=${bootstrap}</script>`;
}

function clientEntryScriptTag(clientEntry?: string): string {
  return clientEntry
    ? `<script type="module" src="${clientEntry.replace(/"/g, '&quot;')}"></script>`
    : '';
}

function renderTemplateDocument(
  dom: HelvetiumDOMRuntime,
  template: HelvetiumDocumentTemplate,
  routeHTML: string,
  context: {
    router: HelvetiumRouter;
    identifierPrefix: string;
    mountId: string;
    head: string;
    bootstrap: string;
    navigationScript: string;
    clientEntry?: string;
    scriptNonce?: string;
  },
): string {
  const routeMount = dom.h('div', {
    id: context.mountId,
    'data-helvetium-page-root': '',
    dangerouslySetInnerHTML: { __html: routeHTML },
  });
  const documentView = cloneTemplateWithRouteMount(dom, template, routeMount);
  let html = dom.renderToString(
    dom.h(dom.RouterProvider, { router: context.router }, documentView),
    { identifierPrefix: `${context.identifierPrefix}shell-` },
  );

  if (
    !/<html(?:\s|>)/i.test(html) ||
    !/<head(?:\s|>)/i.test(html) ||
    !/<body(?:\s|>)/i.test(html)
  ) {
    throw new TypeError(
      'The helvetiumPages() document template must render a complete <html><head>...</head><body>...</body></html> document.',
    );
  }

  html = injectBeforeClosingTag(html, 'head', context.head);
  html = injectBeforeClosingTag(
    html,
    'body',
    `${bootstrapScriptTag(context.bootstrap, context.scriptNonce)}${context.navigationScript}${clientEntryScriptTag(context.clientEntry)}`,
  );

  if (!/^\s*<!doctype\s+html/i.test(html)) {
    html = `<!doctype html>${html}`;
  }

  return html;
}

export function renderHelvetiumDocument(
  request: Request,
  options: HelvetiumPageOptions,
): Promise<Response>;

export function renderHelvetiumDocument(
  request: Request,
  template: HelvetiumDocumentTemplate,
  options: HelvetiumPageOptions,
): Promise<Response>;

export async function renderHelvetiumDocument(
  request: Request,
  templateOrOptions: HelvetiumDocumentTemplate | HelvetiumPageOptions,
  maybeOptions?: HelvetiumPageOptions,
): Promise<Response> {
  const options = normalizePagesArguments(templateOrOptions, maybeOptions);
  if (options.template !== undefined && options.document) {
    throw new TypeError(
      'helvetiumPages(template, options) cannot be combined with the legacy `document` string renderer. Use one document strategy.',
    );
  }

  const dom = await loadHelvetiumDOM();
  const router = dom.createStaticRouter(options.routes, {
    url: request.url,
    basePath: options.basePath,
    notFound: options.notFound,
  });

  const routeView = options.render?.(router, request) ?? dom.h(dom.RouterOutlet, null);
  const identifierPrefix = options.identifierPrefix ?? 'hb-';
  const routeTree = dom.h(dom.RouterProvider, { router }, routeView);
  const content = dom.renderToString(routeTree, { identifierPrefix });
  const head =
    typeof options.head === 'function' ? await options.head(request, router) : (options.head ?? '');

  const bootstrapObject: HelvetiumBootstrap = {
    version: 1,
    url: request.url,
    basePath: router.basePath,
    routeId: router.match?.route.id ?? router.match?.route.path ?? null,
    params: { ...(router.match?.params ?? {}) },
    identifierPrefix,
  };

  const bootstrap = safeJSON(bootstrapObject);
  const mountId = options.mountId ?? 'app';
  const title = routeTitle(router);

  const status =
    typeof options.status === 'function'
      ? options.status(router)
      : (options.status ?? (router.match || options.notFound ? 200 : 404));

  if (isNavigationRequest(request) && request.method === 'GET') {
    const payload: HelvetiumNavigationPayload = {
      version: 1,
      url: request.url,
      html: content,
      head,
      title,
      mountId,
      bootstrap: bootstrapObject,
    };
    const navigationHeaders = new Headers(options.headers);

    navigationHeaders.set('content-type', `${HELVETIUM_NAVIGATION_MEDIA_TYPE}; charset=utf-8`);
    navigationHeaders.set('cache-control', 'no-store');
    return new Response(JSON.stringify(payload), {
      status,
      headers: navigationHeaders,
    });
  }

  const navigationScript = navigationScriptTag(options, router, mountId);
  const scriptNonce = resolveScriptNonce(options);

  const html =
    options.template !== undefined
      ? renderTemplateDocument(dom, options.template, content, {
          router,
          identifierPrefix,
          mountId,
          head,
          bootstrap,
          navigationScript,
          clientEntry: options.clientEntry,
          scriptNonce,
        })
      : options.document
        ? await options.document(content, {
            request,
            router,
            head,
            bootstrap,
            clientEntry: options.clientEntry,
            mountId,
            navigationScript,
            scriptNonce,
          })
        : defaultDocument(
            content,
            {
              head,
              bootstrap,
              clientEntry: options.clientEntry,
              mountId,
              navigationScript,
              scriptNonce,
            },
            options.lang,
          );
  return new Response(request.method === 'HEAD' ? null : html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...Object.fromEntries(new Headers(options.headers)),
    },
  });
}

export function helvetiumPages(options: HelvetiumPageOptions): HelvetiumPagesMiddleware;

export function helvetiumPages(
  template: HelvetiumDocumentTemplate,
  options: HelvetiumPageOptions,
): HelvetiumPagesMiddleware;

export function helvetiumPages(
  templateOrOptions: HelvetiumDocumentTemplate | HelvetiumPageOptions,
  maybeOptions?: HelvetiumPageOptions,
): HelvetiumPagesMiddleware {
  const options = normalizePagesArguments(templateOrOptions, maybeOptions);
  return async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      return next();
    }

    const accept = c.req.header('accept') ?? 'text/html';
    const normalizedAccept = accept.toLowerCase();
    const navigationRequest =
      c.req.header(HELVETIUM_NAVIGATION_HEADER) === '1' ||
      normalizedAccept.includes(HELVETIUM_NAVIGATION_MEDIA_TYPE);

    if (
      !navigationRequest &&
      !normalizedAccept.includes('text/html') &&
      !normalizedAccept.includes('*/*')
    ) {
      return next();
    }

    const dom = await loadHelvetiumDOM();
    const path = new URL(c.req.url).pathname;
    const match = dom.matchRoutes(options.routes, path, { basePath: options.basePath });

    if (!match && !options.notFound) {
      return next();
    }

    return renderHelvetiumDocument(c.request, options);
  };
}

export function getHelvetiumBootstrap(
  globalObject: unknown = globalThis,
): HelvetiumBootstrap | undefined {
  return (globalObject as Record<string, unknown>).__HELVETIUM_BOOT__ as
    HelvetiumBootstrap | undefined;
}
