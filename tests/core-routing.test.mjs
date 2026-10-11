import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, LinearRouter, TrieRouter, RegExpRouter, SmartRouter } from '../dist/index.js';

test('01 GET route returns text', async () => {
  const a = createApp();
  a.get('/', (c) => c.text('ok'));

  assert.equal(await (await a.request('/')).text(), 'ok');
});

test('02 POST route returns JSON', async () => {
  const a = createApp();
  a.post('/x', (c) => c.json({ ok: true }, 201));

  const r = await a.request('/x', { method: 'POST' });
  assert.equal(r.status, 201);

  assert.deepEqual(await r.json(), { ok: true });
});

test('03 dynamic params are decoded', async () => {
  const a = createApp();
  a.get('/u/:id', (c) => c.text(c.req.param('id')));

  assert.equal(await (await a.request('/u/a%20b')).text(), 'a b');
});

test('04 optional params match empty', async () => {
  const a = createApp();
  a.get('/p/:id?', (c) => c.text(c.req.param('id') ?? 'none'));

  assert.equal(await (await a.request('/p')).text(), 'none');
});

test('05 splat captures remainder', async () => {
  const a = createApp();
  a.get('/f/*path', (c) => c.text(c.req.param('path')));

  assert.equal(await (await a.request('/f/a/b')).text(), 'a/b');
});

test('06 static route outranks dynamic route', async () => {
  const a = createApp();
  a.get('/u/:id', (c) => c.text('dynamic'));
  a.get('/u/new', (c) => c.text('static'));

  assert.equal(await (await a.request('/u/new')).text(), 'static');
});

test('07 all route matches arbitrary method', async () => {
  const a = createApp();
  a.all('/x', (c) => c.text(c.req.method));

  assert.equal(await (await a.request('/x', { method: 'PURGE' })).text(), 'PURGE');
});

test('08 HEAD falls back to GET without body', async () => {
  const a = createApp();
  a.get('/x', (c) => c.text('body'));

  const r = await a.request('/x', { method: 'HEAD' });
  assert.equal(r.status, 200);
  assert.equal(await r.text(), '');
});

test('09 automatic OPTIONS returns Allow', async () => {
  const a = createApp();
  a.get('/x', (c) => c.text(''));
  a.post('/x', (c) => c.text(''));

  const r = await a.request('/x', { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('allow') ?? '', /GET/);
});

test('10 basePath prefixes routes', async () => {
  const a = createApp();
  const api = a.basePath('/api');

  api.get('/x', (c) => c.text('x'));
  assert.equal(await (await api.request('/api/x')).text(), 'x');
});

test('11 mount strips prefix', async () => {
  const child = createApp();
  child.get('/x', (c) => c.text('child'));

  const a = createApp();
  a.mount('/api', child);

  assert.equal(await (await a.request('/api/x')).text(), 'child');
});

test('12 compose imports child routes', async () => {
  const child = createApp();
  child.get('/x', (c) => c.text('child'));

  const a = createApp();
  a.compose('/v1', child);

  assert.equal(await (await a.request('/v1/x')).text(), 'child');
});

test('13 route builder chains methods', async () => {
  const a = createApp();
  a.route('/r')
    .get((c) => c.text('g'))
    .post((c) => c.text('p'));

  assert.equal(await (await a.request('/r')).text(), 'g');
  assert.equal(await (await a.request('/r', { method: 'POST' })).text(), 'p');
});

test('14 middleware wraps route in order', async () => {
  const a = createApp();
  const order = [];

  a.use(async (c, next) => {
    order.push(1);
    await next();
    order.push(4);
  });

  a.use(async (c, next) => {
    order.push(2);
    await next();
    order.push(3);
  });

  a.get('/', (c) => c.text('x'));
  await a.request('/');

  assert.deepEqual(order, [1, 2, 3, 4]);
});

test('15 next route skips to second matching route', async () => {
  const a = createApp({ router: new LinearRouter() });
  a.get('/x', async (c, next) => next('route'));
  a.get('/x', (c) => c.text('second'));

  assert.equal(await (await a.request('/x')).text(), 'second');
});

test('16 custom notFound is used', async () => {
  const a = createApp();
  a.notFound((c) => c.text('missing', 404));

  assert.equal(await (await a.request('/none')).text(), 'missing');
});

test('17 async errors reach onError', async () => {
  const a = createApp();
  a.onError((e, c) => c.text('caught', 500));
  a.get('/', async () => {
    throw new Error('x');
  });

  assert.equal(await (await a.request('/')).text(), 'caught');
});

test('18 router presets all implement matching', async () => {
  for (const router of [
    new LinearRouter(),
    new TrieRouter(),
    new RegExpRouter(),
    new SmartRouter(),
  ]) {
    const a = createApp({ router });
    a.get('/x/:id', (c) => c.text(c.req.param('id')));

    assert.equal(await (await a.request('/x/1')).text(), '1');
  }
});
