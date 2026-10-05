import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/promo-signup.ts';
import { promoSignup } from './promo-signup.ts';

const originalFetch = globalThis.fetch;
beforeEach(() => { globalThis.fetch = async () => { throw new Error('Real network calls forbidden'); }; });
afterEach(() => { globalThis.fetch = originalFetch; });

const migration = readFileSync(new URL('../migrations/0001_promo_signups.sql', import.meta.url), 'utf8');
function setup(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  db.exec(readFileSync(new URL('../migrations/0002_promo_codes.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  const calls = [];
  const client = {
    coupons: { async retrieve(id) { assert.equal(id, 'coupon_test'); return { valid: true, percent_off: 10 }; } },
    promotionCodes: { async create(params, options) {
      calls.push({ params, options });
      return { id: `promo_test_${calls.length}`, code: `NAIS${calls.length}` };
    } },
  };
  const env = { STRIPE_SECRET_KEY: 'test-placeholder', STRIPE_PROMO_COUPON_ID: 'coupon_test', PROMO_DB: { prepare(sql) {
    return { bind(...values) { return { async first() { return db.prepare(sql).get(...values) ?? null; }, async run() {
      const result = db.prepare(sql).run(...values);
      return { success: true, meta: { changes: Number(result.changes) } };
    } }; } };
  } } };
  const request = (value, options = {}) => promoSignup(new Request('https://naisdrinks.com/api/promo-signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), ...options,
  }), env, () => client);
  return { db, env, request, calls, client };
}

test('persists one Stripe code with normalized email and pending delivery; returns no personal data', async t => {
  const { db, request, calls } = setup(t);
  const response = await request({ email: ' User@Example.COM ' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'registered' });
  const row = db.prepare('SELECT * FROM promo_signups').get();
  assert.equal(row.email, 'user@example.com');
  assert.equal(row.delivery_status, 'pending');
  assert.ok(Date.parse(row.created_at));
  assert.equal(row.stripe_promotion_code_id, 'promo_test_1');
  assert.equal(row.promotion_code, 'NAIS1');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    params: { promotion: { type: 'coupon', coupon: 'coupon_test' }, max_redemptions: 1,
      restrictions: { first_time_transaction: true }, metadata: { nais_promo_request_id: row.promotion_request_id } },
    options: { idempotencyKey: `nais-promo-${row.promotion_request_id}` },
  });
  assert.deepEqual(Object.keys(row).sort(), ['created_at', 'delivery_status', 'email', 'promotion_code', 'promotion_request_id', 'stripe_promotion_code_id']);
});

for (const email of ['user@example.com', 'USER@EXAMPLE.COM', ' user@example.com ']) {
  test(`duplicate normalization ${JSON.stringify(email)} grants no second entitlement`, async t => {
    const { db, request, calls } = setup(t);
    await request({ email: 'user@example.com' });
    const before = { ...db.prepare('SELECT * FROM promo_signups').get() };
    const response = await request({ email });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'already_registered' });
    assert.deepEqual({ ...db.prepare('SELECT * FROM promo_signups').get() }, before);
    assert.equal(db.prepare('SELECT count(*) AS count FROM promo_signups').get().count, 1);
    assert.equal(calls.length, 1);
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
  const { db, request, calls } = setup(t);
  const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => request({ email: i % 2 ? ' USER@example.com ' : 'user@example.com' })));
  assert.equal(responses.filter(response => response.status === 201).length, 1);
  assert.equal(responses.filter(response => [200, 503].includes(response.status)).length, 19);
  assert.equal(db.prepare('SELECT count(*) AS count FROM promo_signups').get().count, 1);
  assert.equal(calls.length, 1);
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
  for (const env of [{}, { STRIPE_SECRET_KEY: 'test-placeholder', STRIPE_PROMO_COUPON_ID: 'coupon_test', PROMO_DB: { prepare() { throw new Error('internal database detail'); } } }]) {
    const response = await onRequest({ env, request: new Request('https://naisdrinks.com/api/promo-signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"user@example.com"}',
    }) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
  }
});

test('Stripe failure keeps reservation and a repeated request never creates a replacement', async t => {
  const { db, request, client } = setup(t);
  let attempts = 0;
  client.promotionCodes.create = async () => { attempts++; throw new Error('sensitive Stripe detail'); };
  for (let i = 0; i < 2; i++) {
    const result = await request({ email: 'user@example.com' });
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { status: 'unavailable' });
  }
  assert.equal(attempts, 1);
  const row = db.prepare('SELECT * FROM promo_signups').get();
  assert.equal(row.stripe_promotion_code_id, null);
  assert.equal(row.delivery_status, 'pending');
  assert.ok(row.promotion_request_id);
});

for (const mode of ['throw', 'unsuccessful', 'no-change']) {
  test(`D1 persistence ${mode} never reports signup success or generates a second code`, async t => {
    const { db, env, request, calls } = setup(t);
    const prepare = env.PROMO_DB.prepare;
    env.PROMO_DB.prepare = sql => {
      if (!sql.startsWith('UPDATE')) return prepare(sql);
      return { bind() { return { async run() {
        if (mode === 'throw') throw new Error('private SQL details');
        return { success: mode !== 'unsuccessful', meta: { changes: 0 } };
      } }; } };
    };
    for (let i = 0; i < 2; i++) {
      const result = await request({ email: 'user@example.com' });
      assert.equal(result.status, 503);
      assert.deepEqual(await result.json(), { status: 'unavailable' });
    }
    assert.equal(calls.length, 1);
    assert.equal(db.prepare('SELECT promotion_code FROM promo_signups').get().promotion_code, null);
  });
}

for (const binding of ['STRIPE_SECRET_KEY', 'STRIPE_PROMO_COUPON_ID']) {
  test(`missing ${binding} fails without reserving an email`, async t => {
    const { db, env, request, calls } = setup(t);
    delete env[binding];
    assert.equal((await request({ email: 'user@example.com' })).status, 503);
    assert.equal(calls.length, 0);
    assert.equal(db.prepare('SELECT count(*) AS count FROM promo_signups').get().count, 0);
  });
}

for (const coupon of [{ valid: false, percent_off: 10 }, { valid: true, percent_off: 20 }, { valid: true, percent_off: null }]) {
  test(`rejects unsuitable coupon ${JSON.stringify(coupon)}`, async t => {
    const { request, client, calls } = setup(t);
    client.coupons.retrieve = async () => coupon;
    assert.equal((await request({ email: 'user@example.com' })).status, 503);
    assert.equal(calls.length, 0);
  });
}

test('malformed Stripe result never reports success', async t => {
  const { request, client } = setup(t);
  client.promotionCodes.create = async () => ({ id: '', code: '' });
  assert.equal((await request({ email: 'user@example.com' })).status, 503);
});

test('additive migration preserves legacy registrations and enforces unique codes', async t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(migration);
  db.exec("INSERT INTO promo_signups(email, delivery_status) VALUES ('legacy@example.com', 'sent')");
  db.exec(readFileSync(new URL('../migrations/0002_promo_codes.sql', import.meta.url), 'utf8'));
  assert.equal(db.prepare('SELECT delivery_status FROM promo_signups').get().delivery_status, 'sent');
  db.exec("UPDATE promo_signups SET promotion_code = 'NAIS1', stripe_promotion_code_id = 'promo_1'");
  assert.throws(() => db.exec("INSERT INTO promo_signups(email, promotion_code) VALUES ('other@example.com', 'nais1')"));
  assert.throws(() => db.exec("INSERT INTO promo_signups(email, stripe_promotion_code_id) VALUES ('other@example.com', 'promo_1')"));
});

test('legacy email is never granted another entitlement', async t => {
  const { db, request, calls } = setup(t);
  db.exec("INSERT INTO promo_signups(email) VALUES ('legacy@example.com')");
  const result = await request({ email: 'legacy@example.com' });
  assert.deepEqual(await result.json(), { status: 'already_registered' });
  assert.equal(calls.length, 0);
});

test('Pages handler uses official Stripe SDK with mocked transport only', async t => {
  const { env, db } = setup(t);
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith('/coupons/coupon_test')) {
      return Response.json({ id: 'coupon_test', object: 'coupon', valid: true, percent_off: 10 });
    }
    assert.ok(String(url).endsWith('/promotion_codes'));
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('promotion[type]'), 'coupon');
    assert.equal(body.get('promotion[coupon]'), 'coupon_test');
    assert.equal(body.get('max_redemptions'), '1');
    assert.equal(body.get('restrictions[first_time_transaction]'), 'true');
    assert.equal(body.has('code'), false);
    assert.equal(body.has('email'), false);
    return Response.json({ id: 'promo_transport', code: 'NAISTRANSPORT' });
  };
  const result = await onRequest({ env, request: new Request('https://naisdrinks.com/api/promo-signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"user@example.com"}',
  }) });
  assert.equal(result.status, 201);
  assert.equal(requests.length, 2);
  assert.equal(db.prepare('SELECT promotion_code FROM promo_signups').get().promotion_code, 'NAISTRANSPORT');
});
