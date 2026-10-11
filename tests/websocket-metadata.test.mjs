import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { WebSocketRouter, createApp, generateOpenAPI, routeManifest } from '../dist/index.js';
import {
  HELVETIUM_NAVIGATION_HEADER,
  HELVETIUM_NAVIGATION_MEDIA_TYPE,
  helvetiumPages,
  renderHelvetiumDocument,
} from '../dist/integration/helvetium-dom.js';
import { Anchor, h } from '@newfoundcodes/helvetium-dom';

test('73 websocket router matches static route', () => {
  const r = new WebSocketRouter();
  const hnd = {};

  r.route('/ws', hnd);
  assert.equal(r.match('/ws').handlers, hnd);
});

test('74 websocket router extracts params', () => {
  const r = new WebSocketRouter();
  r.route('/rooms/:id', {});

  assert.equal(r.match('/rooms/a%20b').params.id, 'a b');
});

test('75 metadata produces OpenAPI and route manifest', () => {
  const a = createApp();
  a.get(
    '/users/:id',
    { metadata: { operationId: 'getUser', name: 'user.show', tags: ['users'] } },
    (c) => c.text(''),
  );

  const d = generateOpenAPI(a, { title: 'X', version: '1' });
  assert.equal(d.openapi, '3.1.2');
  assert.ok(d.paths['/users/{id}'].get);

  assert.equal(routeManifest(a)[0].name, 'user.show');
});

test('76 Helvetium DOM bridge renders the same deep route and Anchor href on the server', async () => {
  const Home = () => h('main', null, h('h1', null, 'Home'));
  const User = ({ params }) =>
    h('main', null, h('h1', null, `User ${params.id}`), h(Anchor, { to: '/' }, 'Home'));
  const response = await renderHelvetiumDocument(new Request('http://example.test/users/42'), {
    routes: [
      { id: 'home', path: '/', component: Home },
      { id: 'user', path: '/users/:id', component: User },
    ],
    clientEntry: '/client.js',
  });

  const html = await response.text();
  assert.equal(response.status, 200);

  assert.match(html, /User 42/);
  assert.match(html, /href="\/"/);
  assert.match(html, /__HELVETIUM_BOOT__/);
  assert.match(html, /\/client\.js/);
});

test('111 Helvetium pages inject same-document navigation and Anchor markers without a client bundle', async () => {
  const Home = () =>
    h('main', null, h('h1', null, 'Home'), h(Anchor, { to: '/users/42' }, 'User 42'));
  const User = ({ params }) =>
    h('main', null, h('h1', null, `User ${params.id}`), h(Anchor, { to: '/' }, 'Home'));
  const response = await renderHelvetiumDocument(new Request('http://example.test/'), {
    routes: [
      { id: 'home', path: '/', component: Home },
      { id: 'user', path: '/users/:id', component: User },
    ],
  });

  const html = await response.text();
  assert.match(html, /data-helvetium-anchor=""/);
  assert.match(html, /__HELVETIUM_BOOT_NAVIGATION__/);

  assert.doesNotMatch(html, /type="module"/);
});

test('112 Helvetium navigation requests return compact route payloads', async () => {
  const Home = () =>
    h('main', null, h('h1', null, 'Home'), h(Anchor, { to: '/users/42' }, 'User 42'));
  const User = ({ params }) =>
    h('main', null, h('h1', null, `User ${params.id}`), h(Anchor, { to: '/' }, 'Home'));
  const app = createApp();

  app.use(
    helvetiumPages({
      routes: [
        { id: 'home', path: '/', component: Home },
        { id: 'user', path: '/users/:id', component: User },
      ],
    }),
  );

  const response = await app.fetch(
    new Request('http://example.test/users/42', {
      headers: { accept: HELVETIUM_NAVIGATION_MEDIA_TYPE, [HELVETIUM_NAVIGATION_HEADER]: '1' },
    }),
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('content-type') ?? '',
    new RegExp(`^${HELVETIUM_NAVIGATION_MEDIA_TYPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  );

  const payload = await response.json();
  assert.equal(payload.version, 1);
  assert.equal(payload.bootstrap.routeId, 'user');
  assert.equal(payload.bootstrap.params.id, '42');

  assert.match(payload.html, /User 42/);
  assert.match(payload.html, /data-helvetium-anchor=""/);
});

test('113 Helvetium delegated navigation can be disabled explicitly', async () => {
  const response = await renderHelvetiumDocument(new Request('http://example.test/'), {
    routes: [{ path: '/', component: () => h('main', null, 'Home') }],
    clientNavigation: false,
  });
  const html = await response.text();

  assert.doesNotMatch(html, /__HELVETIUM_BOOT_NAVIGATION__/);
});

test('114 delegated navigation runtime prevents document loading and swaps the route mount', async () => {
  const Home = () =>
    h('main', null, h('h1', null, 'Home'), h(Anchor, { to: '/users/42' }, 'User 42'));
  const User = ({ params }) =>
    h('main', null, h('h1', null, `User ${params.id}`), h(Anchor, { to: '/' }, 'Home'));
  const routes = [
    { id: 'home', path: '/', component: Home },
    { id: 'user', path: '/users/:id', component: User },
  ];

  const response = await renderHelvetiumDocument(new Request('http://example.test/'), { routes });
  const html = await response.text();
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1],
  );

  const runtime = scripts.find((source) => source.includes('__HELVETIUM_BOOT_NAVIGATION__'));
  assert.ok(runtime, 'navigation runtime must be present');

  class FakeElement {
    constructor(href) {
      this.href = href;
      this.attributes = new Map([['data-helvetium-anchor', '']]);
    }

    closest(selector) {
      return selector === 'a[data-helvetium-anchor]' ? this : null;
    }

    hasAttribute(name) {
      return this.attributes.has(name);
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
  }

  const root = {
    html: '',
    replaceChildren(node) {
      this.html = node.html;
    },
  };

  const listeners = new Map();
  const windowListeners = new Map();
  let scrolledToSessions = false;
  const sessions = {
    scrollIntoView() {
      scrolledToSessions = true;
    },
  };

  const document = {
    title: '',
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    getElementById(id) {
      return id === 'app' ? root : id === 'sessions' ? sessions : null;
    },
    createElement(name) {
      assert.equal(name, 'template');
      return {
        innerHTML: '',
        get content() {
          const html = this.innerHTML;
          return {
            cloneNode() {
              return { html };
            },
          };
        },
      };
    },
  };

  const location = {
    origin: 'http://example.test',
    href: 'http://example.test/',
    pathname: '/',
    search: '',
    hash: '',
    assigned: null,
    assign(value) {
      this.assigned = value;
    },
    reload() {
      this.assigned = 'reload';
    },
  };

  const historyCalls = [];
  const history = {
    pushState(state, title, href) {
      historyCalls.push(['pushState', href]);

      const u = new URL(href, location.href);
      location.href = u.href;
      location.pathname = u.pathname;
      location.search = u.search;
      location.hash = u.hash;
    },
    replaceState(state, title, href) {
      historyCalls.push(['replaceState', href]);

      const u = new URL(href, location.href);
      location.href = u.href;
      location.pathname = u.pathname;
      location.search = u.search;
      location.hash = u.hash;
    },
  };

  const payloadResponse = await renderHelvetiumDocument(
    new Request('http://example.test/users/42?tab=security', {
      headers: { accept: HELVETIUM_NAVIGATION_MEDIA_TYPE, [HELVETIUM_NAVIGATION_HEADER]: '1' },
    }),
    { routes },
  );

  const payloadText = await payloadResponse.text();
  const context = {
    globalThis: null,
    document,
    location,
    history,
    Element: FakeElement,
    URL,
    AbortController,
    Response,
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    fetch: async () =>
      new Response(payloadText, {
        status: 200,
        headers: { 'content-type': HELVETIUM_NAVIGATION_MEDIA_TYPE },
      }),
    dispatchEvent() {
      return true;
    },
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    queueMicrotask,
    scrollTo() {},
  };

  context.globalThis = context;
  vm.runInNewContext(runtime, context);

  const anchor = new FakeElement('http://example.test/users/42?tab=security#sessions');
  const click = {
    target: anchor,
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };

  listeners.get('click')(click);
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(click.defaultPrevented, true);
  assert.match(root.html, /User 42/);
  assert.deepEqual(historyCalls, [['pushState', '/users/42?tab=security#sessions']]);
  assert.equal(location.hash, '#sessions');
  assert.equal(scrolledToSessions, true);

  assert.equal(location.assigned, null);
  assert.equal(context.__HELVETIUM_BOOT__.routeId, 'user');
});

test('115 Helvetium scriptNonce covers bootstrap and delegated navigation scripts', async () => {
  const response = await renderHelvetiumDocument(new Request('http://example.test/'), {
    routes: [{ path: '/', component: () => h('main', null, 'Home') }],
    scriptNonce: 'nonce-123',
  });

  const html = await response.text();
  assert.match(html, /<script nonce="nonce-123">globalThis\.__HELVETIUM_BOOT__/);

  const nonceScripts = [...html.matchAll(/<script nonce="nonce-123">/g)];
  assert.equal(nonceScripts.length, 2);
});

test('116 helvetiumPages accepts a component VNode document template and injects the route as children', async () => {
  const Home = () =>
    h(
      'main',
      { 'data-page': 'home' },
      h('h1', null, 'Home'),
      h(Anchor, { to: '/users/42' }, 'User 42'),
    );
  const Navbar = () => h('nav', { 'data-shell': 'navbar' }, h(Anchor, { to: '/' }, 'Brand'));
  const Footer = () => h('footer', { 'data-shell': 'footer' }, 'Footer');
  const Index = ({ children }) =>
    h(
      'html',
      { lang: 'en' },
      h('head', null, h('title', null, 'Hello, world!')),
      h('body', null, h(Navbar, null), children, h(Footer, null)),
    );
  const routes = [{ id: 'home', path: '/', component: Home }];

  const app = createApp();
  app.use(helvetiumPages(h(Index, null), { routes }));

  const response = await app.fetch(new Request('http://example.test/'));
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<title>Hello, world!<\/title>/);
  assert.match(html, /data-shell="navbar"/);
  assert.match(html, /data-shell="footer"/);

  assert.match(
    html,
    /<div id="app" data-helvetium-page-root="">[\s\S]*data-page="home"[\s\S]*<\/div>/,
  );
  assert.match(html, /__HELVETIUM_BOOT_NAVIGATION__/);
});

test('117 templated Helvetium navigation payload contains only the managed route subtree', async () => {
  const Home = () => h('main', { 'data-page': 'home' }, 'Home');
  const User = ({ params }) => h('main', { 'data-page': 'user' }, `User ${params.id}`);

  const Index = ({ children }) =>
    h(
      'html',
      null,
      h('head', null, h('title', null, 'Shell')),
      h(
        'body',
        null,
        h('nav', { 'data-shell': 'navbar' }, 'Navbar'),
        children,
        h('footer', { 'data-shell': 'footer' }, 'Footer'),
      ),
    );

  const routes = [
    { id: 'home', path: '/', component: Home },
    { id: 'user', path: '/users/:id', component: User },
  ];

  const app = createApp();
  app.use(helvetiumPages(h(Index, null), { routes }));

  const response = await app.fetch(
    new Request('http://example.test/users/42', {
      headers: { accept: HELVETIUM_NAVIGATION_MEDIA_TYPE, [HELVETIUM_NAVIGATION_HEADER]: '1' },
    }),
  );

  const payload = await response.json();
  assert.equal(payload.bootstrap.routeId, 'user');
  assert.match(payload.html, /data-page="user"/);

  assert.doesNotMatch(payload.html, /data-shell="navbar"/);
  assert.doesNotMatch(payload.html, /data-shell="footer"/);
  assert.doesNotMatch(payload.html, /<html/i);
});

test('118 templated document preserves custom mount id and injects head/client/CSP scripts', async () => {
  const Index = ({ children }) => h('html', null, h('head', null), h('body', null, children));
  const response = await renderHelvetiumDocument(
    new Request('http://example.test/'),
    h(Index, null),
    {
      routes: [{ path: '/', component: () => h('main', null, 'Home') }],
      mountId: 'content',
      head: '<meta name="application-name" content="Helvetium">',
      clientEntry: '/assets/client.js',
      scriptNonce: 'nonce-template',
    },
  );

  const html = await response.text();
  assert.match(html, /<div id="content" data-helvetium-page-root="">/);
  assert.match(html, /<meta name="application-name" content="Helvetium"><\/head>/);
  assert.match(html, /<script nonce="nonce-template">globalThis\.__HELVETIUM_BOOT__/);

  assert.equal([...html.matchAll(/<script nonce="nonce-template">/g)].length, 2);
  assert.match(html, /<script type="module" src="\/assets\/client\.js"><\/script>/);
});

test('119 templated document rejects a native-element template root', async () => {
  await assert.rejects(
    () =>
      renderHelvetiumDocument(
        new Request('http://example.test/'),
        h('html', null, h('head', null), h('body', null)),
        { routes: [{ path: '/', component: () => h('main', null, 'Home') }] },
      ),
    /template root must be a component VNode/,
  );
});

test('120 templated document rejects incomplete HTML shells', async () => {
  const Bad = ({ children }) => h('main', null, children);
  await assert.rejects(
    () =>
      renderHelvetiumDocument(new Request('http://example.test/'), h(Bad, null), {
        routes: [{ path: '/', component: () => h('main', null, 'Home') }],
      }),
    /must render a complete <html><head>/,
  );
});
