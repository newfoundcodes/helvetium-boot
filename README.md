<div align="center">
  <img src="https://github.com/newfoundcodes/newfoundcodes-logo/blob/main/newfoundcodes-helvetium.png?raw=true" width="128" />
  <h1>Helvetium Boot</h1>
  <p>
    <a href="https://github.com/newfoundcodes/helvetium-boot/actions"><img src="https://github.com/newfoundcodes/helvetium-boot/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
  </p>
</div>

Helvetium Boot is a standalone TypeScript web framework built around Web-standard Request/Response APIs. It includes routing, middleware, security, validation, RPC, WebSockets, server actions, Node serving, and first-party Helvetium DOM full-stack integration.

It does **not** import Express or Hono. Helvetium DOM is an optional peer only for UI/page rendering.

## Install

```bash
npm install @newfoundcodes/helvetium-boot
```

For Helvetium DOM pages:

```bash
npm install @newfoundcodes/helvetium-boot @newfoundcodes/helvetium-dom
```

## Minimal application

```ts
import { createApp } from '@newfoundcodes/helvetium-boot';
import { serve } from '@newfoundcodes/helvetium-boot/node';

const app = createApp();
app.get('/', (c) => c.text('Hello'));
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));

console.log(await serve({ app, port: 3000 }).ready);
```

## Main feature groups

- Web-standard HTTP core and Node adapter
- multiple router engines and route presets
- ordered/custom middleware and parameter hooks
- request parsers, response helpers, streaming and SSE
- CORS, headers, ETag, compression, cache, limits, timing, IDs, language, IP policy
- cookies, signed cookies, sessions, Basic/Bearer/JWT/JWKS authentication
- schema and Standard Schema validation
- RPC plus comprehensive OpenAPI 3.1 with `describeRoute()`, validator inference, reusable components, security, callbacks, webhooks, and served specifications
- native Node WebSockets without a WebSocket package
- `'use server'` server action registry and POST transport
- Helvetium DOM SSR, static/browser shared routing, Anchor deep links, delegated same-document SSR navigation, hydration bootstrap
- static files, proxy, context storage, SSG, CLI

## OpenAPI 3.1

Helvetium Boot includes a first-party OpenAPI 3.1 subsystem. `describeRoute()` attaches operation metadata as normal route middleware, while `validator()` contributes path, query, header, cookie, and request-body schemas automatically. Built-in `schema.*` validators expose JSON Schema directly, and external Standard Schema vendors can register schema resolvers.

```ts
import {
  createApp,
  describeRoute,
  openAPIRouteHandler,
  schema,
  validator,
} from '@newfoundcodes/helvetium-boot';
import { serve } from '@newfoundcodes/helvetium-boot/node';

const app = createApp();
const Params = schema.object({ id: schema.string() });

app.get(
  '/users/:id',
  describeRoute({
    operationId: 'getUser',
    summary: 'Get one user',
    tags: ['users'],
    responses: {
      200: { description: 'User found' },
      404: { description: 'User not found' },
    },
  }),
  validator('param', Params),
  (c) => c.json({ id: c.req.param('id') }),
);

app.get(
  '/openapi.json',
  openAPIRouteHandler(app, {
    info: { title: 'Users API', version: '1.0.0' },
    pretty: 2,
  }),
);

serve({ app, port: 3000 });
```

The generator supports OpenAPI components, parameters, request bodies, responses, headers, examples, callbacks, webhooks, security schemes and requirements, servers, tags, `x-` extensions, optional Boot route expansion, splat annotations, deterministic operation IDs, hidden operations, strict schema resolution, and structural document validation. The package does not depend on Hono, `hono-openapi`, Swagger UI, or another OpenAPI runtime.

## Helvetium DOM pages, templates, and Anchor navigation

`helvetiumPages()` can render Helvetium DOM routes inside a user-defined full-document component. Pass the template VNode as the first argument and use its normal `children` prop as the route insertion point:

```tsx
import { createApp } from '@newfoundcodes/helvetium-boot';
import { helvetiumPages } from '@newfoundcodes/helvetium-boot/helvetium-dom';
import { serve } from '@newfoundcodes/helvetium-boot/node';
import { Anchor, h, type RouteDefinition, type VNodeChild } from '@newfoundcodes/helvetium-dom';

function Index({ children }: { children?: VNodeChild }) {
  return (
    <html lang="en">
      <head>
        <title>Hello, world!</title>
      </head>
      <body>
        <nav>
          <Anchor to="/">Home</Anchor>
        </nav>
        {children}
        <footer>Helvetium</footer>
      </body>
    </html>
  );
}

const routes: RouteDefinition[] = [
  { id: 'home', path: '/', component: () => <Anchor to="/users/42">User 42</Anchor> },
  {
    id: 'user',
    path: '/users/:id',
    component: ({ params }) => (
      <>
        <h1>User {params.id}</h1>
        <Anchor to="/">Home</Anchor>
      </>
    ),
  },
];

const app = createApp();
app.use(helvetiumPages(<Index />, { routes }));
serve({ app, port: 3000 });
```

Boot injects a managed route mount at `{children}`. Delegated navigation replaces only that mount, so the template shell remains in the current document. A hydrated `createBrowserRouter()` still takes precedence and performs local VDOM routing.

The original `helvetiumPages({ routes })` form remains supported and uses Boot's default HTML document.

## Quality gates in this repository

- strict TypeScript source build
- strict TypeScript compile for 80 full examples
- 120 named Node unit/integration tests, including 30 dedicated OpenAPI tests
- real Node HTTP and native WebSocket tests
- Helvetium DOM deep-link SSR integration test

## Development

```bash
npm run typecheck
npm run examples:typecheck
npm test
```

## License

This project is licensed under the [AGPL-3.0-only](https://spdx.org/licenses/AGPL-3.0-only.html) License.
