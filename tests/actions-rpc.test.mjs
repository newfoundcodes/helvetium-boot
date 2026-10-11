import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ServerActionRegistry,
  serverActions,
  createApp,
  getServerActionId,
  createRPCClient,
  hc,
} from '../dist/index.js';

test('67 server action requires directive', () => {
  const r = new ServerActionRegistry();
  assert.throws(() =>
    r.register(function x() {
      return 1;
    }),
  );
});

test('68 server action registry assigns id', () => {
  const r = new ServerActionRegistry();
  const fn = r.register(function action() {
    'use server';
    return 1;
  });

  assert.ok(getServerActionId(fn));
  assert.equal(r.manifest().length, 1);
});

test('69 server action middleware invokes action', async () => {
  const r = new ServerActionRegistry();
  r.register(
    function add(a, b) {
      'use server';
      return a + b;
    },
    { id: 'add' },
  );

  const a = createApp();
  a.use(serverActions(r));

  const res = await a.request('/__helvetium/actions/add', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ args: [2, 3] }),
  });

  assert.deepEqual(await res.json(), { ok: true, value: 5 });
});

test('70 server action auth can forbid call', async () => {
  const r = new ServerActionRegistry();
  r.register(
    function secret() {
      'use server';
      return 1;
    },
    { id: 's', auth: () => false },
  );

  const a = createApp();
  a.use(serverActions(r));

  assert.equal(
    (
      await a.request('/__helvetium/actions/s', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"args":[]}',
      })
    ).status,
    403,
  );
});

test('71 RPC client interpolates params and query', async () => {
  let seen = '';

  const client = createRPCClient('https://api.test', {});
  const old = globalThis.fetch;

  globalThis.fetch = async (input) => {
    seen = String(input);
    return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
  };

  try {
    const r = await client.call('GET /users/:id', { param: { id: 4 }, query: { q: 'x' } });

    assert.match(seen, /\/users\/4\?q=x/);
    assert.deepEqual(r.data, { ok: true });
  } finally {
    globalThis.fetch = old;
  }
});

test('72 hc proxy builds path and method', async () => {
  let method = '',
    url = '';
  const old = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    url = String(input);
    method = init.method;
    return new Response('ok');
  };

  try {
    await hc('https://api.test').users.$post({});
    assert.equal(method, 'POST');
    assert.equal(url, 'https://api.test/users');
  } finally {
    globalThis.fetch = old;
  }
});
