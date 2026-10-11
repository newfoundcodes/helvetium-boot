import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OpenAPIValidationError,
  assertOpenAPIDocument,
  componentSchema,
  createApp,
  createOpenAPIDocument,
  describeResponse,
  describeRoute,
  expandOpenAPIPaths,
  generateOpenAPI,
  openAPIRouteHandler,
  openAPISpecs,
  registerOpenAPISchemaResolver,
  resolver,
  schema,
  validateOpenAPIDocument,
  validator,
} from '../dist/index.js';

const json = (value) => ({
  description: 'JSON response',
  content: { 'application/json': { schema: value } },
});

test('81 describeRoute contributes operation metadata', () => {
  const app = createApp();
  app.get(
    '/users',
    describeRoute({
      summary: 'List users',
      tags: ['users'],
      operationId: 'listUsers',
      responses: { 200: { description: 'OK' } },
    }),
    (c) => c.json([]),
  );

  const doc = generateOpenAPI(app);
  assert.equal(doc.paths['/users'].get.summary, 'List users');
  assert.deepEqual(doc.paths['/users'].get.tags, ['users']);
  assert.equal(doc.paths['/users'].get.operationId, 'listUsers');
});

test('82 built-in query validator becomes OpenAPI parameters', () => {
  const app = createApp();
  app.get(
    '/search',
    validator(
      'query',
      schema.object({
        q: schema.string({ min: 1 }),
        page: schema.number({ integer: true, min: 1, coerce: true }).optional(),
      }),
    ),
    (c) => c.json({}),
  );

  const operation = generateOpenAPI(app).paths['/search'].get;
  const q = operation.parameters.find((p) => p.name === 'q');
  const page = operation.parameters.find((p) => p.name === 'page');

  assert.equal(q.in, 'query');
  assert.equal(q.required, true);
  assert.equal(q.schema.minLength, 1);
  assert.equal(page.required, false);
  assert.equal(page.schema.type, 'integer');
});

test('83 param validator supplies path parameter schema and required=true', () => {
  const app = createApp();
  app.get(
    '/users/:id',
    validator('param', schema.object({ id: schema.string({ pattern: /^[a-z]+$/ }) })),
    (c) => c.text('ok'),
  );

  const parameter = generateOpenAPI(app).paths['/users/{id}'].get.parameters.find(
    (p) => p.name === 'id',
  );

  assert.equal(parameter.in, 'path');
  assert.equal(parameter.required, true);
  assert.equal(parameter.schema.pattern, '^[a-z]+$');
});

test('84 missing param validator still gets standards-compliant path parameter', () => {
  const app = createApp();
  app.get('/users/:id', (c) => c.text('ok'));

  const parameter = generateOpenAPI(app).paths['/users/{id}'].get.parameters.find(
    (p) => p.name === 'id',
  );

  assert.equal(parameter.required, true);
  assert.equal(parameter.schema.type, 'string');
});

test('85 optional Boot path expands into two OpenAPI paths', () => {
  const expanded = expandOpenAPIPaths('/users/:id?');
  assert.deepEqual(
    expanded.map((v) => v.path),
    ['/users', '/users/{id}'],
  );

  const app = createApp();
  app.get(
    '/users/:id?',
    describeRoute({ operationId: 'getUser', responses: { 200: { description: 'OK' } } }),
    (c) => c.text('ok'),
  );

  const doc = generateOpenAPI(app);
  assert.ok(doc.paths['/users'].get);
  assert.ok(doc.paths['/users/{id}'].get);

  assert.equal(doc.paths['/users/{id}'].get.operationId, 'getUser');
  assert.equal(doc.paths['/users'].get.operationId, 'getUser__variant_1');
});

test('86 splat paths carry Helvetium extension metadata', () => {
  const app = createApp();
  app.get('/files/*path', (c) => c.text('ok'));

  const parameter = generateOpenAPI(app).paths['/files/{path}'].get.parameters.find(
    (p) => p.name === 'path',
  );
  assert.equal(parameter['x-helvetium-splat'], true);
});

test('87 JSON validator becomes requestBody application/json', () => {
  const app = createApp();
  app.post(
    '/users',
    validator(
      'json',
      schema.object({ name: schema.string(), age: schema.number({ integer: true }).optional() }),
    ),
    (c) => c.json({}),
  );

  const body = generateOpenAPI(app).paths['/users'].post.requestBody;
  assert.equal(body.required, true);
  assert.equal(body.content['application/json'].schema.type, 'object');

  assert.deepEqual(body.content['application/json'].schema.required, ['name']);
});

test('88 form and raw body validators select correct media types', () => {
  const app = createApp();
  app.post('/upload', validator('form', schema.object({ name: schema.string() })), (c) =>
    c.text('ok'),
  );

  app.post(
    '/binary',
    validator('body', schema.unknown(), {
      openapi: { schema: { type: 'string', contentEncoding: 'base64' } },
    }),
    (c) => c.text('ok'),
  );

  const doc = generateOpenAPI(app);
  assert.ok(doc.paths['/upload'].post.requestBody.content['application/x-www-form-urlencoded']);
  assert.ok(doc.paths['/binary'].post.requestBody.content['application/octet-stream']);
});

test('89 manual describeRoute parameters override inferred parameter metadata', () => {
  const app = createApp();
  app.get(
    '/search',
    describeRoute({
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: false,
          description: 'Search phrase',
          schema: { type: 'string', maxLength: 100 },
        },
      ],
      responses: { 200: { description: 'OK' } },
    }),
    validator('query', schema.object({ q: schema.string({ min: 1 }) })),
    (c) => c.text('ok'),
  );

  const parameter = generateOpenAPI(app).paths['/search'].get.parameters.find(
    (p) => p.name === 'q',
  );

  assert.equal(parameter.description, 'Search phrase');
  assert.equal(parameter.schema.maxLength, 100);
  assert.equal(parameter.required, false);
});

test('90 manual requestBody merges content with inferred requestBody', () => {
  const app = createApp();
  app.post(
    '/items',
    describeRoute({
      requestBody: {
        required: true,
        description: 'Create input',
        content: { 'application/vnd.example+json': { schema: { type: 'object' } } },
      },
      responses: { 201: { description: 'Created' } },
    }),
    validator('json', schema.object({ name: schema.string() })),
    (c) => c.json({}, 201),
  );

  const body = generateOpenAPI(app).paths['/items'].post.requestBody;
  assert.equal(body.description, 'Create input');

  assert.ok(body.content['application/json']);
  assert.ok(body.content['application/vnd.example+json']);
});

test('91 resolver converts Helvetium schema to JSON Schema', () => {
  const result = resolver(schema.array(schema.string({ min: 2 }), { min: 1 }));
  assert.equal(result.type, 'array');
  assert.equal(result.minItems, 1);
  assert.equal(result.items.minLength, 2);

  assert.deepEqual(resolver({}), {});
});

test('92 resolver supports reusable component schemas', () => {
  const User = componentSchema(
    'User',
    schema.object({ id: schema.string(), name: schema.string() }),
  );

  const app = createApp();
  app.get('/users/:id', describeRoute({ responses: { 200: json(User) } }), (c) => c.json({}));

  const doc = generateOpenAPI(app);
  assert.equal(
    doc.paths['/users/{id}'].get.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/User',
  );

  assert.equal(doc.components.schemas.User.type, 'object');
});

test('93 resolver({ref}) automatically registers component definition', () => {
  const User = resolver(schema.object({ id: schema.string() }), { ref: 'UserByResolver' });
  const app = createApp();
  app.get('/user', describeRoute({ responses: { 200: json(User) } }), (c) => c.json({}));

  const doc = generateOpenAPI(app);
  assert.equal(doc.components.schemas.UserByResolver.type, 'object');
});

test('94 conflicting component definitions fail generation', () => {
  const app = createApp();
  app.get(
    '/a',
    describeRoute({ responses: { 200: json(componentSchema('Thing', { type: 'string' })) } }),
    (c) => c.text('a'),
  );

  app.get(
    '/b',
    describeRoute({ responses: { 200: json(componentSchema('Thing', { type: 'number' })) } }),
    (c) => c.text('b'),
  );

  assert.throws(() => generateOpenAPI(app), /conflicting definitions/);
});

test('95 custom Standard Schema resolver participates in validator inference', () => {
  const external = {
    '~standard': { version: 1, vendor: 'test-vendor', validate: (value) => ({ value }) },
  };

  const unregister = registerOpenAPISchemaResolver('test-vendor', () => ({
    type: 'object',
    properties: { token: { type: 'string' } },
    required: ['token'],
  }));

  try {
    const app = createApp();
    app.get('/external', validator('query', external), (c) => c.text('ok'));

    const parameter = generateOpenAPI(app).paths['/external'].get.parameters[0];
    assert.equal(parameter.name, 'token');
    assert.equal(parameter.required, true);
  } finally {
    unregister();
  }
});

test('96 unresolved external Standard Schema is nonfatal by default', () => {
  const external = {
    '~standard': { version: 1, vendor: 'unresolved-vendor', validate: (value) => ({ value }) },
  };

  const app = createApp();
  app.post('/external', validator('json', external), (c) => c.text('ok'));

  const schemaObject =
    generateOpenAPI(app).paths['/external'].post.requestBody.content['application/json'].schema;
  assert.equal(schemaObject['x-helvetium-unresolved-schema'], true);
});

test('97 strict schema resolution rejects unresolved Standard Schema', () => {
  const external = {
    '~standard': { version: 1, vendor: 'unresolved-strict', validate: (value) => ({ value }) },
  };

  const app = createApp();
  app.post('/external', validator('json', external), (c) => c.text('ok'));

  assert.throws(
    () => generateOpenAPI(app, { strictSchemaResolution: true }),
    /cannot be converted/,
  );
});

test('98 hidden operations are omitted unless includeHidden is enabled', () => {
  const app = createApp();
  app.get(
    '/internal',
    describeRoute({ hide: true, responses: { 200: { description: 'OK' } } }),
    (c) => c.text('ok'),
  );

  assert.equal(generateOpenAPI(app).paths['/internal'], undefined);
  assert.ok(generateOpenAPI(app, { includeHidden: true }).paths['/internal'].get);
});

test('99 includeEmptyPaths=false excludes undescribed routes', () => {
  const app = createApp();
  app.get('/plain', (c) => c.text('ok'));
  app.get('/described', describeRoute({ responses: { 200: { description: 'OK' } } }), (c) =>
    c.text('ok'),
  );

  const doc = generateOpenAPI(app, { includeEmptyPaths: false });
  assert.equal(doc.paths['/plain'], undefined);
  assert.ok(doc.paths['/described'].get);
});

test('100 top-level documentation supports servers tags components security and webhooks', () => {
  const app = createApp();
  app.get('/', (c) => c.text('ok'));

  const doc = generateOpenAPI(app, {
    documentation: {
      info: { title: 'Complete API', version: '2.0.0', description: 'Docs' },
      servers: [{ url: 'https://api.example.com' }],
      tags: [{ name: 'users', description: 'User operations' }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      security: [{ bearerAuth: [] }],
      webhooks: { userChanged: { post: { responses: { 200: { description: 'OK' } } } } },
    },
  });

  assert.equal(doc.info.title, 'Complete API');
  assert.equal(doc.servers[0].url, 'https://api.example.com');
  assert.equal(doc.components.securitySchemes.bearerAuth.scheme, 'bearer');

  assert.ok(doc.webhooks.userChanged.post);
});

test('101 callbacks externalDocs servers security and extensions survive describeRoute', () => {
  const app = createApp();
  app.post(
    '/subscribe',
    describeRoute({
      operationId: 'subscribe',
      externalDocs: { url: 'https://docs.example.com/subscribe' },
      servers: [{ url: 'https://regional.example.com' }],
      security: [{ bearerAuth: ['write'] }],
      callbacks: {
        event: {
          '{$request.body#/callbackUrl}': {
            post: { responses: { 200: { description: 'Callback accepted' } } },
          },
        },
      },
      responses: { 202: { description: 'Accepted' } },
      'x-owner': 'platform',
    }),
    (c) => c.text('ok'),
  );

  const operation = generateOpenAPI(app).paths['/subscribe'].post;
  assert.equal(operation.externalDocs.url, 'https://docs.example.com/subscribe');
  assert.equal(operation.servers[0].url, 'https://regional.example.com');

  assert.deepEqual(operation.security, [{ bearerAuth: ['write'] }]);
  assert.ok(operation.callbacks.event);
  assert.equal(operation['x-owner'], 'platform');
});

test('102 duplicate operationId is rejected', () => {
  const app = createApp();
  app.get(
    '/a',
    describeRoute({ operationId: 'same', responses: { 200: { description: 'OK' } } }),
    (c) => c.text('a'),
  );

  app.get(
    '/b',
    describeRoute({ operationId: 'same', responses: { 200: { description: 'OK' } } }),
    (c) => c.text('b'),
  );

  assert.throws(() => generateOpenAPI(app), /Duplicate OpenAPI operationId/);
});

test('103 validateOpenAPIDocument detects missing path parameters and empty responses', () => {
  const issues = validateOpenAPIDocument({
    openapi: '3.1.2',
    info: { title: 'Bad', version: '1' },
    paths: { '/users/{id}': { get: { responses: {} } } },
  });

  assert.ok(issues.some((i) => i.message.includes("Missing required path parameter 'id'")));
  assert.ok(issues.some((i) => i.message.includes('at least one response')));
});

test('104 assertOpenAPIDocument throws OpenAPIValidationError for invalid document', () => {
  assert.throws(
    () => assertOpenAPIDocument({ openapi: '3.1.2', info: { title: '', version: '' }, paths: {} }),
    OpenAPIValidationError,
  );
});

test('105 openAPIRouteHandler serves generated JSON with cache and pretty options', async () => {
  const app = createApp();
  app.get('/hello', describeRoute({ responses: { 200: { description: 'OK' } } }), (c) =>
    c.text('hello'),
  );

  app.get(
    '/openapi.json',
    openAPIRouteHandler(app, {
      info: { title: 'Served', version: '1' },
      cacheControl: 'public, max-age=60',
      pretty: 2,
    }),
  );

  const response = await app.fetch(new Request('http://example.test/openapi.json'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');

  const text = await response.text();
  assert.match(text, /\n {2}"openapi"/);
  assert.equal(JSON.parse(text).info.title, 'Served');
});

test('106 openAPISpecs is an alias for OpenAPI route serving', async () => {
  const app = createApp();
  app.get('/spec', openAPISpecs(app, { info: { title: 'Alias', version: '1' } }));

  const response = await app.fetch(new Request('http://example.test/spec'));
  assert.equal((await response.json()).info.title, 'Alias');
});

test('107 createOpenAPIDocument aliases generation and legacy APIInfo call remains supported', () => {
  const app = createApp();
  app.get('/x', (c) => c.text('x'));

  assert.equal(createOpenAPIDocument(app, { title: 'Legacy', version: '1' }).info.title, 'Legacy');
});

test('108 describeResponse attaches response metadata to a handler', () => {
  const app = createApp();
  const handler = describeResponse((c) => c.json({ ok: true }), {
    200: json({ type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }),
  });
  app.get('/response', handler);

  const response = generateOpenAPI(app).paths['/response'].get.responses['200'];
  assert.equal(response.content['application/json'].schema.properties.ok.type, 'boolean');
});

test('109 legacy RouteMetadata remains compatible', () => {
  const app = createApp();
  app.get(
    '/legacy/:id',
    {
      metadata: {
        operationId: 'legacyGet',
        summary: 'Legacy summary',
        tags: ['legacy'],
        security: ['apiKey'],
      },
    },
    (c) => c.text('ok'),
  );

  const operation = generateOpenAPI(app).paths['/legacy/{id}'].get;
  assert.equal(operation.operationId, 'legacyGet');
  assert.equal(operation.summary, 'Legacy summary');

  assert.deepEqual(operation.security, [{ apiKey: [] }]);
});

test('110 pathItem metadata is emitted and path parameter invariant remains valid', () => {
  const app = createApp();
  app.get(
    '/things/:id',
    describeRoute({
      pathItem: { summary: 'Thing path', description: 'Shared path description' },
      responses: { 200: { description: 'OK' } },
    }),
    (c) => c.text('ok'),
  );

  const pathItem = generateOpenAPI(app).paths['/things/{id}'];
  assert.equal(pathItem.summary, 'Thing path');
  assert.equal(pathItem.description, 'Shared path description');
  assert.equal(pathItem.get.parameters.find((p) => p.name === 'id').required, true);
});
