# Helvetium Boot examples

This directory contains 80 standalone TypeScript/TSX examples. Each numbered file focuses on one production or integration pattern.

All examples are checked by `npm run examples:typecheck`.

## Running server examples

Server-oriented examples start themselves with `serve()` instead of exporting an application object. They listen on `PORT` when it is set and otherwise use port `3000`. For example, with a TypeScript runner:

```bash
PORT=3100 npx tsx examples/02-http-methods.ts
```

The browser-only Helvetium DOM router/component examples and client-only RPC snippets do not create a Node server. All examples that previously ended with `export default app` now call `serve({ app, ... })` directly.

## Catalog

- `01-hello-node.ts` - Hello Node.
- `02-http-methods.ts` - HTTP Methods.
- `03-dynamic-parameters.ts` - Dynamic Parameters.
- `04-optional-parameters.ts` - Optional Parameters.
- `05-splat-route.ts` - Splat Route.
- `06-custom-middleware.ts` - Custom Middleware.
- `07-router-trie.ts` - Router Trie.
- `08-router-linear.ts` - Router Linear.
- `09-router-regexp.ts` - Router Regexp.
- `10-router-smart.ts` - Router Smart.
- `11-mounted-application.ts` - Mounted Application.
- `12-composed-application.ts` - Composed Application.
- `13-error-handler.ts` - Error Handler.
- `14-not-found.ts` - Not Found.
- `15-request-parsing.ts` - Request Parsing.
- `16-response-generation.ts` - Response Generation.
- `17-cookies.ts` - Cookies.
- `18-signed-cookies.ts` - Signed Cookies.
- `19-cors.ts` - CORS.
- `20-secure-headers.ts` - Secure Headers.
- `21-etag.ts` - Etag.
- `22-rate-limit.ts` - Rate Limit.
- `23-basic-auth.ts` - Basic Auth.
- `24-bearer-auth.ts` - Bearer Auth.
- `25-jwt-auth.ts` - JWT Auth.
- `26-jwk-auth.ts` - JWK Auth.
- `27-csrf.ts` - CSRF.
- `28-session.ts` - Session.
- `29-cache.ts` - Cache.
- `30-compression.ts` - Compression.
- `31-language.ts` - Language.
- `32-method-override.ts` - Method Override.
- `33-validation.ts` - Validation.
- `34-standard-schema.ts` - Standard Schema.
- `35-rpc-client.ts` - RPC Client.
- `36-hc-proxy.ts` - Hc Proxy.
- `37-openapi-metadata.ts` - Openapi Metadata.
- `38-websocket-echo.ts` - Websocket Echo.
- `39-websocket-room.ts` - Websocket Room.
- `40-static-files.ts` - Static Files.
- `41-reverse-proxy.ts` - Reverse Proxy.
- `42-server-sent-events.ts` - Server Sent Events.
- `43-streaming.ts` - Streaming.
- `44-server-action.ts` - Server Action.
- `45-server-action-auth.ts` - Server Action Auth.
- `46-server-action-client.ts` - Server Action Client.
- `47-helvetium-ssr.tsx` - Helvetium Ssr.
- `48-helvetium-router.tsx` - Helvetium Router.
- `49-anchor-deep-links.tsx` - Anchor Deep Links.
- `50-helvetium-shell.tsx` - Helvetium Shell.
- `51-router-base-path.tsx` - Router Base Path.
- `52-api-and-pages.tsx` - API And Pages.
- `53-health-check.ts` - Health Check.
- `54-multi-tenant.ts` - Multi Tenant.
- `55-versioned-api.ts` - Versioned API.
- `56-content-negotiation.ts` - Content Negotiation.
- `57-cache-policy.ts` - Cache Policy.
- `58-observability.ts` - Observability.
- `59-ip-restriction.ts` - Ip Restriction.
- `60-graceful-shutdown.ts` - Graceful Shutdown.
- `61-route-builder.ts` - Route Builder.
- `62-wildcard-method.ts` - Wildcard Method.
- `63-middleware-factory.ts` - Middleware Factory.
- `64-testing-request.ts` - Testing Request.
- `65-param-middleware.ts` - Param Middleware.
- `66-settings-and-locals.ts` - Settings And Locals.
- `67-context-storage.ts` - Context Storage.
- `68-static-site-generation.ts` - Static Site Generation.
- `69-safe-html-template.ts` - Safe Html Template.
- `70-accept-negotiation.ts` - Accept Negotiation.
- `71-nested-routers.ts` - Nested Routers.
- `72-full-stack-helvetium.tsx` - Full Stack Helvetium.
- `73-openapi-describe-route.ts` - Openapi Describe Route.
- `74-openapi-validator-inference.ts` - Openapi Validator Inference.
- `75-openapi-component-schemas.ts` - Openapi Component Schemas.
- `76-openapi-security.ts` - Openapi Security.
- `77-openapi-callbacks-webhooks.ts` - Openapi Callbacks Webhooks.
- `78-openapi-standard-schema-resolver.ts` - Openapi Standard Schema Resolver.
- `79-openapi-optional-and-splat-routes.ts` - Openapi Optional And Splat Routes.
- `80-openapi-complete.ts` - Openapi Complete.
