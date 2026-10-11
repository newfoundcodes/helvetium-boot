import test from 'node:test';
import assert from 'node:assert/strict';
import { schema, validateValue } from '../dist/index.js';

test('51 string schema validates string', async () =>
  assert.equal(await validateValue(schema.string({ min: 2 }), 'ok'), 'ok'));

test('52 string schema rejects short input', async () =>
  assert.rejects(() => validateValue(schema.string({ min: 3 }), 'x')));

test('53 number schema coerces strings', async () =>
  assert.equal(await validateValue(schema.number({ coerce: true, integer: true }), '42'), 42));

test('54 boolean schema coerces true', async () =>
  assert.equal(await validateValue(schema.boolean({ coerce: true }), 'true'), true));

test('55 object schema parses fields', async () =>
  assert.deepEqual(
    await validateValue(
      schema.object({ name: schema.string(), age: schema.number({ coerce: true }) }),
      { name: 'A', age: '2' },
    ),
    { name: 'A', age: 2 },
  ));

test('56 array schema parses items', async () =>
  assert.deepEqual(
    await validateValue(schema.array(schema.number({ coerce: true })), ['1', '2']),
    [1, 2],
  ));

test('57 union schema selects matching branch', async () =>
  assert.equal(await validateValue(schema.union([schema.string(), schema.number()]), 3), 3));

test('58 optional schema accepts undefined', async () =>
  assert.equal(await validateValue(schema.string().optional(), undefined), undefined));
