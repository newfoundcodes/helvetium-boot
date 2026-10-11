import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, validator, schema } from '../dist/index.js';

test('19 request header lookup', async () => {
  const a = createApp();
  a.get('/', (c) => c.text(c.req.header('x-a') ?? ''));

  assert.equal(await (await a.request('/', { headers: { 'x-a': 'b' } })).text(), 'b');
});

test('20 query lookup', async () => {
  const a = createApp();
  a.get('/', (c) => c.text(c.req.query('q') ?? ''));

  assert.equal(await (await a.request('/?q=hi')).text(), 'hi');
});

test('21 repeated queries', async () => {
  const a = createApp();
  a.get('/', (c) => c.json(c.req.queries('q')));

  assert.deepEqual(await (await a.request('/?q=a&q=b')).json(), ['a', 'b']);
});

test('22 cookie parsing', async () => {
  const a = createApp();
  a.get('/', (c) => c.text(c.req.cookie('a') ?? ''));

  assert.equal(
    await (await a.request('/', { headers: { cookie: 'a=hello%20world' } })).text(),
    'hello world',
  );
});

test('23 JSON body parsing', async () => {
  const a = createApp();
  a.post('/', async (c) => c.json(await c.req.json()));

  assert.deepEqual(
    await (
      await a.request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"a":1}',
      })
    ).json(),
    { a: 1 },
  );
});

test('24 URL encoded form parsing', async () => {
  const a = createApp();
  a.post('/', async (c) => c.json(await c.req.parseBody()));

  assert.deepEqual(
    await (
      await a.request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'a=1&b=2',
      })
    ).json(),
    { a: '1', b: '2' },
  );
});

test('25 text body parsing', async () => {
  const a = createApp();
  a.post('/', async (c) => c.text(await c.req.text()));

  assert.equal(await (await a.request('/', { method: 'POST', body: 'hello' })).text(), 'hello');
});

test('26 context status changes response status', async () => {
  const a = createApp();
  a.get('/', (c) => c.status(202).text('x'));

  assert.equal((await a.request('/')).status, 202);
});

test('27 context header is merged', async () => {
  const a = createApp();
  a.get('/', (c) => c.header('x-a', 'b').text('x'));

  assert.equal((await a.request('/')).headers.get('x-a'), 'b');
});

test('28 context cookie sets Set-Cookie', async () => {
  const a = createApp();
  a.get('/', (c) => c.cookie('a', 'b', { httpOnly: true }).text('x'));

  assert.match((await a.request('/')).headers.get('set-cookie') ?? '', /HttpOnly/);
});

test('29 redirect helper sets location', async () => {
  const a = createApp();
  a.get('/', (c) => c.redirect('/x', 307));

  const r = await a.request('/');
  assert.equal(r.status, 307);
  assert.equal(r.headers.get('location'), '/x');
});

test('30 object return is automatic JSON', async () => {
  const a = createApp();
  a.get('/', () => ({ ok: true }));

  assert.deepEqual(await (await a.request('/')).json(), { ok: true });
});

test('31 string return is automatic text', async () => {
  const a = createApp();
  a.get('/', () => 'hello');

  assert.equal(await (await a.request('/')).text(), 'hello');
});

test('32 validator stores typed valid data', async () => {
  const a = createApp();
  a.get('/u/:id', validator('param', schema.object({ id: schema.string() })), (c) =>
    c.text(c.req.valid('param').id),
  );

  assert.equal(await (await a.request('/u/9')).text(), '9');
});
