import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createApp,
  logger,
  cors,
  secureHeaders,
  requestId,
  timing,
  etag,
  bodyLimit,
  basicAuth,
  bearerAuth,
  rateLimit,
  csrf,
  cacheControl,
  prettyJSON,
  language,
  methodOverride,
  cacheMiddleware,
} from '../dist/index.js';

test('33 logger records request', async () => {
  let msg = '';
  const a = createApp();

  a.use(
    logger({
      log: (m) => {
        msg = m;
      },
    }),
  );
  a.get('/', (c) => c.text('x'));

  await a.request('/');
  assert.match(msg, /GET \/ 200/);
});

test('34 CORS sets allow origin', async () => {
  const a = createApp();
  a.use(cors({ origin: 'https://app.test' }));
  a.get('/', (c) => c.text('x'));

  assert.equal(
    (await a.request('/', { headers: { origin: 'https://app.test' } })).headers.get(
      'access-control-allow-origin',
    ),
    'https://app.test',
  );
});

test('35 CORS preflight returns 204', async () => {
  const a = createApp();
  a.use(cors());

  const r = await a.request('/', {
    method: 'OPTIONS',
    headers: { origin: 'https://x.test', 'access-control-request-method': 'POST' },
  });
  assert.equal(r.status, 204);
});

test('36 secure headers sets nosniff', async () => {
  const a = createApp();
  a.use(secureHeaders());
  a.get('/', (c) => c.text('x'));

  assert.equal((await a.request('/')).headers.get('x-content-type-options'), 'nosniff');
});

test('37 request id generates header', async () => {
  const a = createApp();
  a.use(requestId({ generator: () => 'id-1' }));
  a.get('/', (c) => c.text(c.get('requestId')));

  const r = await a.request('/');
  assert.equal(r.headers.get('x-request-id'), 'id-1');
});

test('38 timing emits Server-Timing', async () => {
  const a = createApp();
  a.use(timing());
  a.get('/', (c) => c.text('x'));

  assert.match((await a.request('/')).headers.get('server-timing') ?? '', /dur=/);
});

test('39 etag emits validator', async () => {
  const a = createApp();
  a.use(etag());
  a.get('/', (c) => c.text('hello'));

  assert.match((await a.request('/')).headers.get('etag') ?? '', /^"/);
});

test('40 etag handles If-None-Match', async () => {
  const a = createApp();
  a.use(etag());
  a.get('/', (c) => c.text('hello'));

  const first = await a.request('/'),
    tag = first.headers.get('etag');
  const r = await a.request('/', { headers: { 'if-none-match': tag } });
  assert.equal(r.status, 304);
});

test('41 body limit rejects declared oversized body', async () => {
  const a = createApp();
  a.use(bodyLimit(2));
  a.post('/', async (c) => c.text(await c.req.text()));

  assert.equal(
    (await a.request('/', { method: 'POST', headers: { 'content-length': '3' }, body: 'abc' }))
      .status,
    413,
  );
});

test('42 basic auth permits valid credentials', async () => {
  const a = createApp();
  a.use(basicAuth({ username: 'u', password: 'p' }));
  a.get('/', (c) => c.text('ok'));

  assert.equal(
    (await a.request('/', { headers: { authorization: `Basic ${btoa('u:p')}` } })).status,
    200,
  );
});

test('43 bearer auth rejects invalid token', async () => {
  const a = createApp();
  a.use(bearerAuth({ token: 'good' }));
  a.get('/', (c) => c.text('ok'));

  assert.equal((await a.request('/', { headers: { authorization: 'Bearer bad' } })).status, 401);
});

test('44 rate limiter returns 429 after limit', async () => {
  const a = createApp();
  a.use(rateLimit({ limit: 1, windowMs: 10000, key: () => 'k' }));
  a.get('/', (c) => c.text('ok'));

  await a.request('/');
  assert.equal((await a.request('/')).status, 429);
});

test('45 csrf rejects wrong origin', async () => {
  const a = createApp();
  a.use(csrf({ origin: 'https://good.test' }));
  a.post('/', (c) => c.text('ok'));

  assert.equal(
    (await a.request('/', { method: 'POST', headers: { origin: 'https://bad.test' } })).status,
    403,
  );
});

test('46 cache-control middleware sets header', async () => {
  const a = createApp();
  a.use(cacheControl('public, max-age=60'));
  a.get('/', (c) => c.text('x'));

  assert.equal((await a.request('/')).headers.get('cache-control'), 'public, max-age=60');
});

test('47 pretty JSON formats response', async () => {
  const a = createApp();
  a.use(prettyJSON(2));
  a.get('/', (c) => c.json({ a: 1 }));

  assert.match(await (await a.request('/')).text(), /\n {2}"a"/);
});

test('48 language negotiates supported language', async () => {
  const a = createApp();
  a.use(language({ supported: ['en', 'fr'], default: 'en' }));
  a.get('/', (c) => c.text(c.get('language')));

  assert.equal(
    await (await a.request('/', { headers: { 'accept-language': 'fr-FR, en;q=.5' } })).text(),
    'fr',
  );
});

test('49 method override changes route method before matching', async () => {
  const a = createApp();
  a.use(methodOverride());
  a.delete('/x', (c) => c.text('deleted'));

  assert.equal(
    await (
      await a.request('/x', { method: 'POST', headers: { 'x-http-method-override': 'DELETE' } })
    ).text(),
    'deleted',
  );
});

test('50 cache middleware serves second request from cache', async () => {
  let n = 0;
  const a = createApp();

  a.use(cacheMiddleware({ ttlMs: 10000 }));
  a.get('/', (c) => c.text(String(++n)));

  assert.equal(await (await a.request('/')).text(), '1');
  assert.equal(await (await a.request('/')).text(), '1');
});
