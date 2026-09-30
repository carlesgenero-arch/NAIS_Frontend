import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/promo-signup.ts';

const migration = readFileSync(new URL('../migrations/0001_promo_signups.sql', import.meta.url), 'utf8');
function setup(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  t.after(() => db.close());
  const env = { PROMO_DB: { prepare(sql) {
    return { bind(email) { return { async run() {
      const result = db.prepare(sql).run(email);
      return { success: true, meta: { changes: Number(result.changes) } };
    } }; } };
  } } };
  const request = (value, options = {}) => onRequest({ env, request: new Request('https://naisdrinks.com/api/promo-signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), ...options,
  }) });
  return { db, env, request };
}

test('registers only normalized email, timestamp and pending entitlement; returns no personal data', async t => {
  const { db, request } = setup(t);
  const response = await request({ email: ' User@Example.COM ' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'registered' });
  const row = db.prepare('SELECT * FROM promo_signups').get();
  assert.equal(row.email, 'user@example.com');
  assert.equal(row.delivery_status, 'pending');
  assert.ok(Date.parse(row.created_at));
  assert.deepEqual(Object.keys(row).sort(), ['created_at', 'delivery_status', 'email']);
});

for (const email of ['user@example.com', 'USER@EXAMPLE.COM', ' user@example.com ']) {
  test(`duplicate normalization ${JSON.stringify(email)} grants no second entitlement`, async t => {
    const { db, request } = setup(t);
    await request({ email: 'user@example.com' });
    const before = { ...db.prepare('SELECT * FROM promo_signups').get() };
    const response = await request({ email });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'already_registered' });
    assert.deepEqual({ ...db.prepare('SELECT * FROM promo_signups').get() }, before);
    assert.equal(db.prepare('SELECT count(*) AS count FROM promo_signups').get().count, 1);
  });
}

for (const value of [null, [], 'string', {}, { email: null }, { email: 42 }, { email: '' },
  { email: '   ' }, { email: 'invalid' }, { email: 'user@domain' }, { email: 'a..b@example.com' },
  { email: 'x@-example.com' }, { email: 'a'.repeat(65) + '@example.com' },
  { email: 'user@example.com', eligible: true }, { isFirstOrder: true }]) {
  test(`rejects untrusted input ${JSON.stringify(value)}`, async t => {
    const { db, request } = setup(t);
    assert.equal((await request(value)).status, 400);
    assert.equal(db.prepare('SELECT count(*) AS count FROM promo_signups').get().count, 0);
  });
}

test('rejects malformed JSON and oversized streaming payloads', async t => {
  const { request } = setup(t);
  assert.equal((await request(null, { body: '{broken' })).status, 400);
  assert.equal((await request(null, { body: ' '.repeat(2049) })).status, 400);
});

test('simultaneous duplicate attempts yield exactly one new registration', async t => {
  const { db, request } = setup(t);
  const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => request({ email: i % 2 ? ' USER@example.com ' : 'user@example.com' })));
  assert.equal(responses.filter(response => response.status === 201).length, 1);
  assert.equal(responses.filter(response => response.status === 200).length, 19);
  assert.equal(db.prepare('SELECT count(*) AS count FROM promo_signups').get().count, 1);
});

test('unique constraint survives new handler instances; different emails remain eligible', async t => {
  const { db, env, request } = setup(t);
  await request({ email: 'user@example.com' });
  const duplicate = await onRequest({ env: { ...env }, request: new Request('https://naisdrinks.com/api/promo-signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"user@example.com"}',
  }) });
  assert.equal(duplicate.status, 200);
  assert.equal((await request({ email: 'second@example.com' })).status, 201);
  assert.equal(db.prepare('SELECT count(*) AS count FROM promo_signups').get().count, 2);
});

test('rejects cross-origin, unsupported method and content type', async t => {
  const { request } = setup(t);
  assert.equal((await request({}, { method: 'GET', body: undefined })).status, 405);
  assert.equal((await request({}, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request({}, { headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' } })).status, 403);
});

test('storage failure or missing binding fails closed without database details', async () => {
  for (const env of [{}, { PROMO_DB: { prepare() { throw new Error('internal database detail'); } } }]) {
    const response = await onRequest({ env, request: new Request('https://naisdrinks.com/api/promo-signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"user@example.com"}',
    }) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
  }
});
