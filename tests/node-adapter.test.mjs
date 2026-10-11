import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { createApp } from '../dist/index.js';
import { serve, serveStatic } from '../dist/adapter/node.js';

test('77 Node adapter serves HTTP requests', async () => {
  const a = createApp();
  a.get('/', (c) => c.text('hello'));

  const s = serve({ app: a, port: 0 });
  const url = await s.ready;

  try {
    assert.equal(await (await fetch(url + '/')).text(), 'hello');
  } finally {
    await s.close();
  }
});

test('78 Node adapter forwards request bodies', async () => {
  const a = createApp();
  a.post('/', async (c) => c.json(await c.req.json()));

  const s = serve({ app: a, port: 0 });
  const url = await s.ready;

  try {
    assert.deepEqual(
      await (
        await fetch(url + '/', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"x":1}',
        })
      ).json(),
      { x: 1 },
    );
  } finally {
    await s.close();
  }
});

test('79 serveStatic returns files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hb-'));
  await writeFile(join(dir, 'hello.txt'), 'hello');

  const a = createApp();
  a.use(serveStatic(dir));

  try {
    assert.equal(await (await a.request('/hello.txt')).text(), 'hello');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('80 native Node WebSocket adapter upgrades and echoes frames', async () => {
  const app = createApp();
  app.ws('/echo', {
    message(event, socket) {
      socket.send(event.data);
    },
  });

  const server = serve({ app, port: 0 });
  const httpURL = await server.ready;
  const wsURL = httpURL.replace(/^http/, 'ws') + '/echo';

  try {
    const value = await new Promise((resolve, reject) => {
      const socket = new WebSocket(wsURL);
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('WebSocket test timed out'));
      }, 3000);

      socket.on('open', () => socket.send('hello-websocket'));
      socket.on('message', (data) => {
        clearTimeout(timer);
        socket.close();
        resolve(data.toString());
      });
      socket.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    assert.equal(value, 'hello-websocket');
  } finally {
    await server.close();
  }
});
