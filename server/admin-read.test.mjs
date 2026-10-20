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
import { onRequest as archive } from '../functions/api/admin/orders/[id]/archive.ts';
import { onRequest as restore } from '../functions/api/admin/orders/[id]/restore.ts';
import { changeOrderFulfillment } from './orders/order-fulfillment.service.ts';
import { onRequest as publicProducts } from '../functions/api/products/index.ts';
const env = { ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com', ACCESS_AUD: 'test-only', ADMIN_EMAILS: 'admin@example.test' };
const emailEnv = { RESEND_API_KEY: 're_fixture', EMAIL_FROM: 'sender@example.test' };
const { privateKey, publicKey } = await generateKeyPair('RS256');
const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test' }] });

test('shipping email sends once under concurrent transitions and uses escaped historical snapshot', async t => {
  const { db, sqlite, ids } = await setup(t);
  sqlite.exec("UPDATE orders SET fulfillment_status='preparing', customer_name='<b>Customer</b>', shipping_address_line1='<script>address</script>'; UPDATE order_items SET product_name='Historical & <fruit>'; DELETE FROM products");
  const messages = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => { messages.push(JSON.parse(options.body)); return Response.json({ id: 'fixture' }); });
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => changeOrderFulfillment(db, ids[0], { fulfillmentStatus: 'shipped' }, emailEnv)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(messages.length, 1);
  await assert.rejects(changeOrderFulfillment(db, ids[0], { fulfillmentStatus: 'shipped' }, emailEnv));
  const row = sqlite.prepare('SELECT * FROM orders WHERE id=?').get(ids[0]);
  assert.equal(row.shipping_email_status, 'sent');
  assert.ok(Number.isFinite(Date.parse(row.shipping_email_sent_at)));
  assert.equal(row.confirmation_email_status, 'pending');
  assert.ok(messages[0].html.includes('&lt;b&gt;Customer&lt;/b&gt;'));
  assert.ok(messages[0].html.includes('Historical &amp; &lt;fruit&gt;'));
  assert.ok(messages[0].html.includes('&lt;script&gt;address&lt;/script&gt;'));
  assert.ok(!messages[0].html.includes('pi_fixture'));
  assert.ok(messages[0].text.includes(row.order_reference));
  await changeOrderFulfillment(db, ids[0], { fulfillmentStatus: 'delivered' }, emailEnv);
  await changeOrderFulfillment(db, ids[1], { fulfillmentStatus: 'cancelled' }, emailEnv);
  assert.equal(messages.length, 1);
});

test('provider failure returns successful shipment plus warning; missing email is skipped', async t => {
  const { send, sqlite, ids } = await setup(t);
  sqlite.exec("UPDATE orders SET fulfillment_status='preparing'");
  const provider = t.mock.method(globalThis, 'fetch', async () => Response.json({ private: 'provider data' }, { status: 500 }));
  const response = await send(fulfillment, ids[0], '', undefined, undefined, 'PATCH', { payload: { fulfillmentStatus: 'shipped' }, emailEnv });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.fulfillmentStatus, 'shipped'); assert.equal(body.shippingEmailWarning, true);
  assert.equal(JSON.stringify(body).includes('provider data'), false);
  assert.equal(sqlite.prepare('SELECT shipping_email_status s FROM orders WHERE id=?').get(ids[0]).s, 'failed');
  sqlite.prepare("UPDATE orders SET customer_email='' WHERE id=?").run(ids[1]);
  const missing = await send(fulfillment, ids[1], '', undefined, undefined, 'PATCH', { payload: { fulfillmentStatus: 'shipped' }, emailEnv });
  assert.equal(missing.status, 200);
  assert.equal((await missing.json()).shippingEmailWarning, true);
  const row = sqlite.prepare('SELECT * FROM orders WHERE id=?').get(ids[1]);
  assert.equal(row.fulfillment_status, 'shipped'); assert.equal(row.shipping_email_status, 'skipped');
  assert.equal(row.shipping_email_sent_at, null); assert.equal(provider.mock.callCount(), 1);
});

test('shipping migration marks historical final states skipped and leaves preparing eligible', async t => {
  const { sqlite } = await setup(t);
  sqlite.exec('ALTER TABLE orders DROP COLUMN shipping_email_status; ALTER TABLE orders DROP COLUMN shipping_email_sent_at');
  for (const state of ['pending', 'preparing', 'shipped', 'delivered', 'cancelled']) {
    sqlite.prepare('UPDATE orders SET fulfillment_status=?').run(state);
    sqlite.exec(readFileSync(new URL('../migrations/0007_shipping_email.sql', import.meta.url), 'utf8'));
    assert.equal(sqlite.prepare('SELECT shipping_email_status s FROM orders LIMIT 1').get().s,
      ['pending', 'preparing'].includes(state) ? 'pending' : 'skipped');
    assert.throws(() => sqlite.exec("UPDATE orders SET shipping_email_status='invalid'"));
    sqlite.exec('ALTER TABLE orders DROP COLUMN shipping_email_status; ALTER TABLE orders DROP COLUMN shipping_email_sent_at');
  }
});
async function jwt(email = 'admin@example.test') {
  return new SignJWT({ type: 'app', email }).setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject('test-subject').setIssuer(env.ACCESS_TEAM_DOMAIN).setAudience(env.ACCESS_AUD)
    .setIssuedAt().setExpirationTime('5m').sign(privateKey);
}
async function setup(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of ['0003_orders.sql', '0004_products.sql', '0005_seed_products.sql', '0006_order_confirmation.sql', '0007_shipping_email.sql', '0012_stripe_price_cleanup.sql', '0014_order_reference.sql', '0015_order_archiving.sql']) {
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
      body: options.raw ?? (options.payload === undefined ? undefined : JSON.stringify(options.payload)),
      ...(options.raw instanceof ReadableStream ? { duplex: 'half' } : {}) });
    const context = { request, env: { ...env, ...options.emailEnv, PROMO_DB: database }, data: {}, params: { id },
      next: () => handler(context) };
    return requireAdmin(context, () => keys);
  }
  return { sqlite, db, ids, send };
}
test('admin read and fulfillment adapters deny unauthenticated/unauthorized identities before D1', async t => {
  const { send, ids } = await setup(t);
  const failDb = { prepare() { assert.fail('D1 must not run'); } };
  for (const handler of [products, product, orders, order, fulfillment, archive, restore]) {
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
    assert.deepEqual({ ...sqlite.prepare('SELECT * FROM orders WHERE id=?').get(ids[0]) }, {
      ...before, fulfillment_status: next, shipping_email_status: next === 'preparing' ? 'pending' : 'failed',
    });
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
  assert.deepEqual(Object.keys(p).sort(), ['id','slug','name','description','status','priceCents','currency','stripeProductId','stripePriceId','stripePriceCleanupPending','imageUrl','featureImageUrl','createdAt','updatedAt'].sort());
  const pub = await publicProducts({ request: new Request('https://nais.example/api/products'), env: { PROMO_DB: db } });
  const visible = await pub.json(); assert.equal(visible.length, 3);
  assert.ok(visible.every(p => p.status === 'active' && !('stripePriceId' in p) && !('createdAt' in p)));
});
test('admin orders expose only explicit operational snapshot fields in cents', async t => {
  const { send, ids } = await setup(t);
  const response = await send(order, ids[0]); assert.equal(response.status, 200);
  const o = await response.json();
  assert.deepEqual(Object.keys(o).sort(), ['archivedAt','id','orderNumber','paymentStatus','fulfillmentStatus','totalAmount','currency','createdAt','paidAt','items','customer','shippingAddress'].sort());
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


test('delivered archival is idempotent, persistent, filtered in D1 and reversible without emails', async t => {
  const {send,sqlite,ids}=await setup(t);
  const network=t.mock.method(globalThis,'fetch',async()=>{assert.fail('Archiving must not send email');});
  sqlite.prepare("UPDATE orders SET fulfillment_status='delivered' WHERE id=?").run(ids[0]);
  const before=sqlite.prepare('SELECT * FROM orders WHERE id=?').get(ids[0]);
  const result=await send(archive,ids[0],'',undefined,undefined,'POST');
  assert.equal(result.status,200); const archived=await result.json();
  assert.equal(archived.fulfillmentStatus,'delivered');assert.ok(Number.isFinite(Date.parse(archived.archivedAt)));
  assert.equal(result.headers.get('Cache-Control'),'no-store');
  const after=sqlite.prepare('SELECT * FROM orders WHERE id=?').get(ids[0]);
  assert.deepEqual({...after},{...before,archived_at:archived.archivedAt});
  assert.equal((await (await send(archive,ids[0],'',undefined,undefined,'POST')).json()).archivedAt,archived.archivedAt);
  const active=await (await send(orders,undefined)).json();
  assert.equal(active.items.some(row=>row.id===ids[0]),false);
  const archiveView=await (await send(orders,undefined,'?view=archived')).json();
  assert.deepEqual(archiveView.items.map(row=>row.id),[ids[0]]);
  assert.equal((await (await send(order,ids[0])).json()).archivedAt,archived.archivedAt);
  assert.equal((await (await send(orders,undefined,'?view=archived&limit=1')).json()).items[0].id,ids[0]);
  const restored=await send(restore,ids[0],'',undefined,undefined,'POST');
  assert.equal(restored.status,200);assert.equal((await restored.json()).archivedAt,null);
  assert.equal((await send(restore,ids[0],'',undefined,undefined,'POST')).status,200);
  assert.deepEqual({...sqlite.prepare('SELECT * FROM orders WHERE id=?').get(ids[0])},{...before});
  assert.equal((await (await send(orders,undefined,'?view=archived')).json()).items.length,0);
  assert.ok((await (await send(orders,undefined)).json()).items.some(row=>row.id===ids[0]));
  assert.equal(network.mock.callCount(),0);
});

test('archive and restore reject non-delivered orders and unsafe requests',async t=>{
  const {send,sqlite,ids}=await setup(t);
  for(const handler of [archive,restore]) {
    for(const state of ['pending','preparing','shipped','cancelled']) {
      sqlite.prepare('UPDATE orders SET fulfillment_status=? WHERE id=?').run(state,ids[0]);
      assert.equal((await send(handler,ids[0],'',undefined,undefined,'POST')).status,409);
      assert.equal(sqlite.prepare('SELECT archived_at FROM orders WHERE id=?').get(ids[0]).archived_at,null);
    }
    assert.equal((await send(handler,ids[0],'',undefined,undefined,'POST',{origin:'https://other.example'})).status,403);
    assert.equal((await send(handler,ids[0])).status,405);
    assert.equal((await send(handler,ids[0],'',undefined,undefined,'POST',{payload:{}})).status,400);
    assert.equal((await send(handler,'invalid','',undefined,undefined,'POST')).status,400);
    assert.equal((await send(handler,'00000000-0000-4000-8000-000000000000','',undefined,undefined,'POST')).status,404);
    assert.equal((await send(handler,ids[0],'',undefined,null,'POST')).status,503);
  }
  for(const query of ['?view=other','?view=archived&view=active']) assert.equal((await send(orders,undefined,query)).status,400);
});

test('archive migration preserves existing orders as active without changing snapshots',async t=>{
  const {sqlite}=await setup(t);
  const before=sqlite.prepare('SELECT * FROM orders').all().map(({archived_at,...row})=>row);
  sqlite.exec('DROP INDEX idx_orders_archive_created; ALTER TABLE orders DROP COLUMN archived_at');
  sqlite.exec(readFileSync(new URL('../migrations/0015_order_archiving.sql',import.meta.url),'utf8'));
  assert.deepEqual(sqlite.prepare('SELECT * FROM orders').all().map(row=>({...row})),before.map(row=>({...row,archived_at:null})));
});


test('archived pagination excludes active rows and concurrent archive preserves one timestamp',async t=>{
  const {send,sqlite,ids}=await setup(t);
  sqlite.prepare("UPDATE orders SET fulfillment_status='delivered' WHERE id IN (?,?)").run(ids[0],ids[1]);
  const replies=await Promise.all(Array.from({length:5},()=>send(archive,ids[0],'',undefined,undefined,'POST')));
  assert.ok(replies.every(response=>response.status===200));
  const times=await Promise.all(replies.map(async response=>(await response.json()).archivedAt));
  assert.equal(new Set(times).size,1);
  await send(archive,ids[1],'',undefined,undefined,'POST');
  const first=await (await send(orders,undefined,'?view=archived&limit=1')).json();
  assert.ok(first.nextCursor);assert.equal(first.items.length,1);
  const second=await (await send(orders,undefined,'?view=archived&limit=1&cursor='+encodeURIComponent(first.nextCursor))).json();
  assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);
  assert.notEqual(second.items[0].id,first.items[0].id);
  assert.ok([first.items[0],second.items[0]].every(row=>row.archivedAt));
});


for (const [name, body] of [
  ['absent', () => undefined], ['empty string', () => ''],
  ['empty bytes', () => new Uint8Array(0)],
  ['zero-byte stream', () => new ReadableStream({ start(controller) { controller.close(); } })],
  ['empty chunk then EOF', () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(0)); controller.close(); } })],
]) test('archive/restore accept ' + name + ' while preserving delivered state', async t => {
  const {send,sqlite,ids}=await setup(t);
  sqlite.prepare("UPDATE orders SET fulfillment_status='delivered' WHERE id=?").run(ids[0]);
  for (const [handler, archived] of [[archive,true],[restore,false]]) {
    const response=await send(handler,ids[0],'',undefined,undefined,'POST',{raw:body()});
    assert.equal(response.status,200);
    const order=await response.json();
    assert.equal(Boolean(order.archivedAt),archived);
    assert.equal(order.fulfillmentStatus,'delivered');
  }
});

test('archive/restore reject every non-empty body, including whitespace, before D1', async t => {
  const {send,ids}=await setup(t);
  const noDb={prepare(){assert.fail('Non-empty body must not reach D1');}};
  for (const handler of [archive,restore]) for (const raw of [' ', '\n', '{}', 'null', 'x'.repeat(100000)]) {
    const response=await send(handler,ids[0],'',undefined,noDb,'POST',{raw});
    assert.equal(response.status,400);assert.deepEqual(await response.json(),{status:'invalid_request'});
  }
});

test('archive/restore stop on first content chunk and cancel unread remainder', async t => {
  const {send,ids}=await setup(t);
  for (const handler of [archive,restore]) {
    let pulls=0;let cancelled=false;
    const raw=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array([1]));},
      cancel(){cancelled=true;}},{highWaterMark:0});
    const response=await send(handler,ids[0],'',undefined,undefined,'POST',{raw});
    assert.equal(response.status,400);assert.equal(pulls,1);assert.equal(cancelled,true);
  }
});

test('archive/restore fail closed on stream errors and excessive empty chunks', async t => {
  const {send,ids}=await setup(t);
  for (const handler of [archive,restore]) {
    const broken=new ReadableStream({start(controller){controller.error(new Error('synthetic'));}});
    assert.equal((await send(handler,ids[0],'',undefined,undefined,'POST',{raw:broken})).status,400);
    let pulls=0;let cancelled=false;
    const raw=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(0));},
      cancel(){cancelled=true;}},{highWaterMark:0});
    assert.equal((await send(handler,ids[0],'',undefined,undefined,'POST',{raw})).status,400);
    assert.equal(pulls,16);assert.equal(cancelled,true);
  }
});
