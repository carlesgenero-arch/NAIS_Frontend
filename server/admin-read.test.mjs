import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { requireAdmin } from './admin/admin-auth.ts';
import { createPaidOrder } from './orders/order.service.ts';
import { onRequest as products } from '../functions/api/admin/products/index.ts';
import { onRequest as product } from '../functions/api/admin/products/[id].ts';
import { onRequest as orders } from '../functions/api/admin/orders/index.ts';
import { onRequest as order } from '../functions/api/admin/orders/[id].ts';
import { onRequest as fulfillment } from '../functions/api/admin/orders/[id]/fulfillment.ts';
import { changeOrderFulfillment } from './orders/order-fulfillment.service.ts';
import { onRequest as publicProducts } from '../functions/api/products/index.ts';
const env = { ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com', ACCESS_AUD: 'test-only', ADMIN_EMAILS: 'admin@example.test' };
const { privateKey, publicKey } = await generateKeyPair('RS256');
const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test' }] });
async function jwt(email = 'admin@example.test') {
  return new SignJWT({ type: 'app', email }).setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject('test-subject').setIssuer(env.ACCESS_TEAM_DOMAIN).setAudience(env.ACCESS_AUD)
    .setIssuedAt().setExpirationTime('5m').sign(privateKey);
}
async function setup(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of ['0003_orders.sql', '0004_products.sql', '0005_seed_products.sql']) {
    sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  }
  const db = { prepare(sql) { return { sql, values: [], bind(...values) { this.values = values; return this; },
    async first() { return sqlite.prepare(sql).get(...this.values) ?? null; },
    async all() { return { success: true, results: sqlite.prepare(sql).all(...this.values) }; } }; },
    async batch(statements) { sqlite.exec('BEGIN'); try {
      const results = statements.map(s => { sqlite.prepare(s.sql).run(...s.values); return { success: true }; });
      sqlite.exec('COMMIT'); return results;
    } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
  };
  for (let i = 0; i < 3; i++) await createPaidOrder(db, {
    stripe_checkout_session_id: `cs_test_fixture${i}`, stripe_event_id: `evt_fixture${i}`,
    stripe_payment_intent_id: 'pi_fixture', stripe_customer_id: null,
    customer_name: 'Synthetic Buyer', customer_email: 'buyer@example.test', customer_phone: null,
    shipping_name: 'Synthetic Recipient', shipping_address_line1: 'Test Address', shipping_address_line2: null,
    shipping_postal_code: '00000', shipping_city: 'Test City', shipping_country: 'ES',
    subtotal_amount: 3600, shipping_amount: 600, discount_amount: 0, tax_amount: 0, total_amount: 4200,
    currency: 'eur', paid_at: '2026-01-01T00:00:00.000Z', items: [{ stripe_line_item_id: 'li_fixture',
      product_id: 'orange-spritz', product_name: 'Historical product', stripe_price_id: 'price_fixture',
      quantity: 1, unit_amount: 3600, line_total_amount: 3600 }],
  });
  sqlite.exec("UPDATE orders SET created_at='2026-01-01T00:00:00.000Z'");
  const ids = sqlite.prepare('SELECT id FROM orders ORDER BY id DESC').all().map(r => r.id);
  const signed = await jwt();
  async function send(handler, id, query = '', token = signed, database = db, method = 'GET', options = {}) {
    const request = new Request('https://nais.example/api/admin/test' + query, { method,
      headers: { ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), Origin: options.origin ?? 'https://nais.example',
        'Content-Type': options.contentType ?? 'application/json' },
      body: options.raw ?? (options.payload === undefined ? undefined : JSON.stringify(options.payload)) });
    const context = { request, env: { ...env, PROMO_DB: database }, data: {}, params: { id },
      next: () => handler(context) };
    return requireAdmin(context, () => keys);
  }
  return { sqlite, db, ids, send };
}
test('admin read and fulfillment adapters deny unauthenticated/unauthorized identities before D1', async t => {
  const { send, ids } = await setup(t);
  const failDb = { prepare() { assert.fail('D1 must not run'); } };
  for (const handler of [products, product, orders, order, fulfillment]) {
    assert.equal((await send(handler, ids[0], '', null, failDb)).status, 401);
    assert.equal((await send(handler, ids[0], '', 'forged', failDb)).status, 401);
    assert.equal((await send(handler, ids[0], '', await jwt('other@example.test'), failDb)).status, 403);
  }
});

test('fulfillment normal flow changes only fulfillment_status and refreshed list reflects it', async t => {
  const { send, sqlite, ids } = await setup(t);
  const before = sqlite.prepare('SELECT * FROM orders WHERE id=?').get(ids[0]);
  const items = sqlite.prepare('SELECT * FROM order_items').all();
  for (const next of ['preparing', 'shipped', 'delivered']) {
    const response = await send(fulfillment, ids[0], '', undefined, undefined, 'PATCH', { payload: { fulfillmentStatus: next } });
    assert.equal(response.status, 200); assert.equal((await response.json()).fulfillmentStatus, next);
    assert.deepEqual({ ...sqlite.prepare('SELECT * FROM orders WHERE id=?').get(ids[0]) }, { ...before, fulfillment_status: next });
  }
  assert.deepEqual(sqlite.prepare('SELECT * FROM order_items').all(), items);
  const page = await (await send(orders)).json();
  assert.equal(page.items.find(o => o.id === ids[0]).fulfillmentStatus, 'delivered');
});
test('fulfillment cancellation allowed only from pending/preparing', async t => {
  const { send, sqlite, ids } = await setup(t);
  for (const previous of ['pending', 'preparing', 'shipped', 'delivered', 'cancelled']) {
    sqlite.prepare('UPDATE orders SET fulfillment_status=? WHERE id=?').run(previous, ids[0]);
    const response = await send(fulfillment, ids[0], '', undefined, undefined, 'PATCH', { payload: { fulfillmentStatus: 'cancelled' } });
    assert.equal(response.status, ['pending', 'preparing'].includes(previous) ? 200 : 409);
    assert.equal(sqlite.prepare('SELECT payment_status FROM orders WHERE id=?').get(ids[0]).payment_status, 'paid');
  }
});
test('fulfillment rejects all backwards, skipped, repeated and terminal transitions', async t => {
  const { send, sqlite, ids } = await setup(t);
  const allowed = { pending: ['preparing','cancelled'], preparing: ['shipped','cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
  for (const previous of Object.keys(allowed)) for (const next of Object.keys(allowed)) {
    if (allowed[previous].includes(next)) continue;
    sqlite.prepare('UPDATE orders SET fulfillment_status=? WHERE id=?').run(previous, ids[0]);
    const response = await send(fulfillment, ids[0], '', undefined, undefined, 'PATCH', { payload: { fulfillmentStatus: next } });
    assert.equal(response.status, 409, `${previous} -> ${next}`);
    assert.equal(sqlite.prepare('SELECT fulfillment_status FROM orders WHERE id=?').get(ids[0]).fulfillment_status, previous);
  }
});
test('fulfillment rejects payment and other fields, malformed JSON and wrong method', async t => {
  const { send, sqlite, ids } = await setup(t);
  const before = sqlite.prepare('SELECT * FROM orders').all();
  for (const payload of [{}, null, [], { fulfillmentStatus: 'bad' }, { fulfillmentStatus: 'preparing', paymentStatus: 'refunded' },
    { payment_status: 'paid' }, { fulfillmentStatus: 'preparing', totalAmount: 0 }, { fulfillmentStatus: 'preparing', customer: {} }]) {
    assert.equal((await send(fulfillment, ids[0], '', undefined, undefined, 'PATCH', { payload })).status, 400);
  }
  for (const raw of ['{', '', ' '.repeat(1025)]) assert.equal((await send(fulfillment, ids[0], '', undefined, undefined, 'PATCH', { raw })).status, 400);
  assert.equal((await send(fulfillment, ids[0], '', undefined, undefined, 'PATCH', { payload: { fulfillmentStatus: 'preparing' }, contentType: 'text/plain' })).status, 400);
  assert.equal((await send(fulfillment, ids[0])).status, 405);
  assert.deepEqual(sqlite.prepare('SELECT * FROM orders').all(), before);
});
test('fulfillment unknown order, unauthorized/cross-origin and database failure fail safely', async t => {
  const { send, ids } = await setup(t); const options = { payload: { fulfillmentStatus: 'preparing' } };
  assert.equal((await send(fulfillment, '00000000-0000-0000-0000-000000000000', '', undefined, undefined, 'PATCH', options)).status, 404);
  assert.equal((await send(fulfillment, '../bad', '', undefined, undefined, 'PATCH', options)).status, 400);
  assert.equal((await send(fulfillment, ids[0], '', null, undefined, 'PATCH', options)).status, 401);
  assert.equal((await send(fulfillment, ids[0], '', await jwt('other@example.test'), undefined, 'PATCH', options)).status, 403);
  assert.equal((await send(fulfillment, ids[0], '', undefined, undefined, 'PATCH', { ...options, origin: 'https://evil.test' })).status, 403);
  const response = await send(fulfillment, ids[0], '', undefined, { prepare() { throw Error('private SQL'); } }, 'PATCH', options);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { status: 'unavailable' });
});
test('concurrent fulfillment changes cannot overwrite each other', async t => {
  const { db, ids, sqlite } = await setup(t);
  // Start both reads together, without variable JWT verification timing serializing the requests.
  const responses = await Promise.allSettled(['preparing', 'cancelled'].map(fulfillmentStatus =>
    changeOrderFulfillment(db, ids[0], { fulfillmentStatus })));
  assert.equal(responses.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(responses.find(r => r.status === 'rejected').reason.code, 'order_changed');
  assert.ok(['preparing','cancelled'].includes(sqlite.prepare('SELECT fulfillment_status FROM orders WHERE id=?').get(ids[0]).fulfillment_status));
});
test('authorized admin sees all product states and operational fields; public projection unchanged', async t => {
  const { send, sqlite, db } = await setup(t);
  sqlite.exec("UPDATE products SET status='draft', stripe_price_id='price_fixture', stripe_product_id='prod_fixture' WHERE id='orange-spritz'; UPDATE products SET status='archived' WHERE id='ginger-crush'");
  const response = await send(products);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const list = await response.json(); assert.equal(list.length, 6);
  assert.deepEqual([...new Set(list.map(p => p.status))].sort(), ['active', 'archived', 'coming-soon', 'draft']);
  const detail = await send(product, 'orange-spritz'); assert.equal(detail.status, 200);
  const p = await detail.json(); assert.equal(p.stripePriceId, 'price_fixture'); assert.equal(p.stripeProductId, 'prod_fixture');
  assert.deepEqual(Object.keys(p).sort(), ['id','slug','name','description','status','priceCents','currency','stripeProductId','stripePriceId','imageUrl','featureImageUrl','createdAt','updatedAt'].sort());
  const pub = await publicProducts({ request: new Request('https://nais.example/api/products'), env: { PROMO_DB: db } });
  const visible = await pub.json(); assert.equal(visible.length, 3);
  assert.ok(visible.every(p => p.status === 'active' && !('stripePriceId' in p) && !('createdAt' in p)));
});
test('admin orders expose only explicit operational snapshot fields in cents', async t => {
  const { send, ids } = await setup(t);
  const response = await send(order, ids[0]); assert.equal(response.status, 200);
  const o = await response.json();
  assert.deepEqual(Object.keys(o).sort(), ['id','orderNumber','paymentStatus','fulfillmentStatus','totalAmount','currency','createdAt','paidAt','items','customer','shippingAddress'].sort());
  assert.deepEqual(o.customer, { name: 'Synthetic Buyer', email: 'buyer@example.test', phone: null });
  assert.deepEqual(o.shippingAddress, { name: 'Synthetic Recipient', line1: 'Test Address', line2: null, postalCode: '00000', city: 'Test City', country: 'ES' });
  assert.deepEqual(o.items, [{ productId: 'orange-spritz', productName: 'Historical product', quantity: 1, unitAmount: 3600, lineTotalAmount: 3600 }]);
  assert.equal(o.totalAmount, 4200); assert.equal(o.paymentStatus, 'paid');
  assert.ok(!JSON.stringify(o).includes('pi_fixture'));
  const page = await (await send(orders)).json(); assert.equal(page.items.length, 3); assert.equal(page.nextCursor, null);
});
test('cursor pagination handles equal timestamps and rows moving ahead of the cursor', async t => {
  const { send, ids, sqlite } = await setup(t);
  let cursor = ''; const seen = [];
  do {
    const response = await send(orders, undefined, '?limit=1' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    assert.equal(response.status, 200);
    const page = await response.json(); assert.equal(page.items.length, 1);
    seen.push(page.items[0].id); cursor = page.nextCursor;
    if (seen.length === 1) sqlite.prepare('UPDATE orders SET created_at=? WHERE id=?').run('2026-02-01T00:00:00.000Z', ids[0]);
  } while (cursor);
  assert.deepEqual(seen, ids);
});
test('unknown valid IDs return 404; invalid IDs/queries return 400', async t => {
  const { send } = await setup(t);
  for (const [handler, id] of [[product, 'unknown-product'], [order, '00000000-0000-0000-0000-000000000000']]) {
    const response = await send(handler, id); assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { status: 'not_found' });
  }
  for (const handler of [product, order]) for (const id of ['', '../secret', "' OR 1=1", undefined, ['a','b']]) {
    assert.equal((await send(handler, id)).status, 400);
  }
  for (const query of ['?limit=0','?limit=101','?limit=1.5','?limit=1&limit=2','?cursor=','?cursor=bad','?offset=1','?cursor=' + encodeURIComponent(btoa('["bad","bad"]'))]) {
    assert.equal((await send(orders, undefined, query)).status, 400);
  }
});
test('read adapters handle missing/failing D1 and reject unsupported deletes', async t => {
  const { send, ids, db } = await setup(t);
  for (const [handler, id] of [[products, undefined], [product, 'orange-spritz'], [orders, undefined], [order, ids[0]]]) {
    for (const database of [null, { prepare() { throw Error('private SQL'); } }]) {
      const response = await send(handler, id, '', await jwt(), database);
      assert.equal(response.status, 503); assert.deepEqual(await response.json(), { status: 'unavailable' });
    }
    const response = await send(handler, id, '', await jwt(), db, 'DELETE');
    if (handler === product) {
      // Product detail now supports DELETE, but this active fixture cannot be deleted.
      assert.equal(response.status, 409);
    } else {
      assert.equal(response.status, 405); assert.equal(response.headers.get('Allow'), 'GET');
    }
  }
});
test('refunded and later fulfillment states remain readable without catalogue reconstruction', async t => {
  const { send, sqlite, ids } = await setup(t);
  sqlite.exec("UPDATE orders SET payment_status='partially_refunded', fulfillment_status='shipped'; DELETE FROM products");
  const response = await send(order, ids[0]); assert.equal(response.status, 200);
  const o = await response.json(); assert.equal(o.paymentStatus, 'partially_refunded'); assert.equal(o.fulfillmentStatus, 'shipped');
  assert.equal(o.items[0].productName, 'Historical product');
});
