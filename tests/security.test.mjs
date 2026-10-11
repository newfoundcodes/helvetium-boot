import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signJWT,
  verifyJWT,
  decodeJWT,
  serializeCookie,
  parseCookies,
  serializeSignedCookie,
  verifySignedCookie,
  verifyWithJWKS,
} from '../dist/index.js';

test('59 JWT HS256 signs and verifies', async () => {
  const t = await signJWT({ sub: '1', exp: Math.floor(Date.now() / 1000) + 60 }, 'secret', 'HS256');
  assert.equal((await verifyJWT(t, 'secret')).sub, '1');
});

test('60 JWT decode exposes header and payload', async () => {
  const t = await signJWT({ a: 1 }, 'secret');
  const d = decodeJWT(t);

  assert.equal(d.header.alg, 'HS256');
  assert.equal(d.payload.a, 1);
});

test('61 JWT rejects wrong secret', async () => {
  const t = await signJWT({ a: 1 }, 'secret');
  await assert.rejects(() => verifyJWT(t, 'wrong'));
});

test('62 JWT validates expiration', async () => {
  const t = await signJWT({ exp: 1 }, 'secret');
  await assert.rejects(() => verifyJWT(t, 'secret', { now: 2 }));
});

test('63 cookie serializer includes security attributes', () => {
  assert.match(
    serializeCookie('sid', 'x', { httpOnly: true, secure: true, sameSite: 'Strict' }),
    /HttpOnly; Secure; SameSite=Strict/,
  );
});

test('64 cookie parser decodes values', () =>
  assert.equal(parseCookies('a=hello%20world').a, 'hello world'));

test('65 signed cookies verify and reject tampering', async () => {
  const header = await serializeSignedCookie('s', 'value', 'secret');
  const val = parseCookies(header.split(';')[0]).s;

  assert.equal(await verifySignedCookie(val, 'secret'), 'value');
  assert.equal(await verifySignedCookie(val + 'x', 'secret'), undefined);
});

test('66 JWKS verifies RSA token by kid', async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );

  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  pub.kid = 'k1';
  pub.alg = 'RS256';

  const token = await signJWT({ sub: 'u' }, pair.privateKey, 'RS256', { kid: 'k1' });
  assert.equal((await verifyWithJWKS(token, [pub], { algorithms: ['RS256'] })).sub, 'u');
});
