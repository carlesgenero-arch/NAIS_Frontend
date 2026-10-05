import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/orders/checkout-session/[sessionId].ts';
import { createPaidOrder } from './orders/order.service.ts';

const sessionId = 'cs_test_' + 'A'.repeat(32);
async function setup(t) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(readFileSync(new URL('../migrations/0003_orders.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  const env = { PROMO_DB: {
    prepare(sql) { return { sql, values: [], bind(...values) { this.values = values; return this; },
      async first() { return db.prepare(sql).get(...this.values) ?? null; } }; },
    async batch(statements) {
      db.exec('BEGIN');
      try { const results = statements.map(s => { db.prepare(s.sql).run(...s.values); return { success: true }; });
        db.exec('COMMIT'); return results;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  } };
  await createPaidOrder(env.PROMO_DB, {
    stripe_checkout_session_id: sessionId, stripe_event_id: 'evt_private', stripe_payment_intent_id: 'pi_private',
    stripe_customer_id: 'cus_private', customer_name: 'Private Name', customer_email: 'private@example.com',
    customer_phone: '+34000000000', shipping_name: 'Private Recipient', shipping_address_line1: 'Private Street 1',
    shipping_address_line2: 'Private Floor', shipping_postal_code: '08001', shipping_city: 'Barcelona', shipping_country: 'ES',
    subtotal_amount: 7200, shipping_amount: 0, discount_amount: 720, tax_amount: 0, total_amount: 6480,
    currency: 'eur', paid_at: '2026-10-05T10:00:00.000Z', items: [{ stripe_line_item_id: 'li_private',
      product_id: 'orange-spritz', product_name: 'Orange Spritz', stripe_price_id: 'price_private', quantity: 2,
      unit_amount: 3600, line_total_amount: 6480 }],
  });
  const send = (id = sessionId, options = {}) => onRequest({ env, params: { sessionId: id },
    request: new Request('https://naisdrinks.com/api/orders/checkout-session/' + encodeURIComponent(String(id)), options) });
  return { db, env, send };
}

test('verified lookup returns only public snapshot fields in minor units', async t => {
  const { send, db } = await setup(t);
  const result = await send();
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Cache-Control'), 'no-store, private');
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
  const summary = await result.json();
  assert.deepEqual(Object.keys(summary).sort(), ['createdAt', 'currency', 'fulfillmentStatus', 'items', 'orderNumber', 'paymentStatus', 'totalAmount']);
  assert.equal(summary.orderNumber, db.prepare('SELECT order_number FROM orders').get().order_number);
  assert.equal(summary.paymentStatus, 'paid');
  assert.equal(summary.fulfillmentStatus, 'pending');
  assert.equal(summary.totalAmount, 6480);
  assert.deepEqual(summary.items, [{ productName: 'Orange Spritz', quantity: 2, unitAmount: 3600, lineTotalAmount: 6480 }]);
  assert.ok(!JSON.stringify(summary).includes('private'));
  assert.ok(!JSON.stringify(summary).includes(sessionId));
});

test('unknown session returns pending without fabricating an order', async t => {
  const { send } = await setup(t);
  const result = await send('cs_test_' + 'B'.repeat(32));
  assert.equal(result.status, 404);
  assert.deepEqual(await result.json(), { status: 'pending' });
});

test('malformed references are rejected before D1, including arrays and injection', async t => {
  const { env, send } = await setup(t);
  env.PROMO_DB.prepare = () => { throw new Error('Must not query invalid ID'); };
  for (const id of ['', 'cs_test_short', 'order_123', "' OR 1=1 --", '../orders', ['cs_test_' + 'A'.repeat(32)], 'cs_test_' + 'A'.repeat(201)]) {
    const result = await send(id);
    assert.equal(result.status, 400);
    assert.deepEqual(await result.json(), { status: 'invalid_request' });
  }
});

test('database failure and missing binding return generic errors', async t => {
  const { env, send } = await setup(t);
  env.PROMO_DB.prepare = () => { throw new Error('private email and SQL details'); };
  let result = await send();
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { status: 'unavailable' });
  delete env.PROMO_DB;
  result = await send();
  assert.equal(result.status, 503);
});

test('GET only and cross-origin requests rejected without CORS', async t => {
  const { send } = await setup(t);
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const result = await send(sessionId, { method });
    assert.equal(result.status, 405);
    assert.equal(result.headers.get('Allow'), 'GET');
  }
  assert.equal((await send(sessionId, { headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await send(sessionId, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
});

test('reads current stored payment status, never claims refunded order is paid', async t => {
  const { send, db } = await setup(t);
  db.exec("UPDATE orders SET payment_status = 'refunded'");
  assert.equal((await (await send()).json()).paymentStatus, 'refunded');
});

test('incomplete stored snapshot fails safely', async t => {
  const { send, db } = await setup(t);
  db.exec('DELETE FROM order_items');
  assert.equal((await send()).status, 503);
});
