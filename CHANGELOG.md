# Changelog

## 0.1.0 - 2026-10-04

- Added `helvetiumPages(template, options)` and `renderHelvetiumDocument(request, template, options)` overloads for Helvetium DOM component document templates.
- Document templates receive Boot's managed route mount through their normal `children` prop, so layouts can own `<html>`, `<head>`, `<body>`, navbar, footer, and other shell components.
- Delegated `Anchor` navigation continues to replace only the managed route mount, preserving the surrounding template shell.
- Added validation for component-template roots and complete `<html>/<head>/<body>` output.
- Template mode now isolates shell `useId()` generation from route `useId()` generation to preserve hydration identity.
- Added template support for custom `mountId`, `head`, `clientEntry`, and `scriptNonce`.
- Updated the full-stack example and Helvetium DOM integration documentation.
- Requires Helvetium DOM >=0.5.3 for improved document/head TSX attributes.
- Added delegated same-document navigation for server-rendered Helvetium DOM `Anchor` links.
- `helvetiumPages()` now injects a small navigation runtime by default; no placeholder `clientEntry` is required for SSR page-to-page navigation.
- Added compact `application/vnd.helvetium.page+json` navigation payload responses and `X-Helvetium-Navigation` request handling.
- Added Back/Forward handling, replace-navigation support, scroll-reset controls, request cancellation, progressive fallback to native navigation, and CSP nonce configuration.
- Hydrated `createBrowserRouter()` navigation takes precedence and prevents duplicate delegated requests.
- Added explicit `clientNavigation: false` opt-out and `HelvetiumClientNavigationOptions`.
- Added Helvetium DOM 0.5.2 as a development dependency for the Boot repository's integration tests/examples while retaining it as an optional runtime peer.
- Updated the full-stack examples and documentation so SSR `Anchor` navigation works without an invented `/assets/client.js`.
- Fixed TypeScript 6 typed-array compatibility in the Node WebSocket adapter.
- Fixed WebCrypto `BufferSource` typing in JWT key import and signature verification.
- Made the Helvetium DOM integration build-safe when its optional peer is not installed; it is loaded only when the integration is used.
- Hardened Node `serve()` and `serveStatic()` public adapter types against source/dist nominal type duplication.
- Made example self-imports resolve consistently to the source tree during repository type-checks.
- Replaced all `export default app` endings in runnable examples with `serve({ app, ... })`.
- Updated documentation for runnable examples and documentation setup.
- OpenAPI subsystem release. Adds first-party `describeRoute()`, `describeResponse()`, complete OpenAPI 3.1 document types, validator-to-OpenAPI inference, JSON Schema output from built-in validators, Standard Schema vendor resolvers, reusable component schemas, request/response/content/security/callback/webhook metadata, optional and splat route conversion, OpenAPI JSON handlers, duplicate-operation detection, and deterministic document validation. Adds a dedicated `@newfoundcodes/helvetium-boot/openapi` export, 8 OpenAPI examples, and 30 OpenAPI regression tests. Legacy `RouteMetadata` and the old `generateOpenAPI(app, { title, version })` call remain supported.
- Initial Helvetium Boot release. Includes the standalone Web-standard core, multiple routers, middleware, validation, security, JWT/JWKS, RPC, metadata/OpenAPI skeleton, native Node WebSockets, server actions, Node adapter/static files, context storage, SSG, CLI, and Helvetium DOM 0.5 integration.
