import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';
import { stripeWebhook } from './stripe/stripe-webhook.ts';
import { onRequest } from '../functions/api/stripe-webhook.ts';
import { createPaidOrder, hasOrderForSession } from './orders/order.service.ts';

const signingSecret = 'whsec_test_fixture_only';
const fetch = globalThis.fetch;
beforeEach(() => { globalThis.fetch = async () => { throw new Error('Real network prohibited'); }; });
afterEach(() => { globalThis.fetch = fetch; });

function emailProvider(env, fail = false) {
  Object.assign(env, { RESEND_API_KEY: 're_synthetic', EMAIL_FROM: 'NAIS <sender@example.test>' });
  const messages = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    messages.push(JSON.parse(options.body));
    return fail ? Response.json({ private: 'never returned' }, { status: 500 }) : Response.json({ id: 'synthetic' });
  };
  return messages;
}

test('confirmation sends once after commit under concurrent and repeated signed webhooks', async t => {
  const { env, db, send, event } = setup(t);
  const messages = emailProvider(env);
  const replies = await Promise.all(Array.from({ length: 8 }, (_, i) => send({ ...event, id: `evt_email_${i}` })));
  assert.ok(replies.every(response => response.status === 200));
  assert.equal((await send()).status, 200);
  assert.equal(messages.length, 1);
  const order = db.prepare('SELECT * FROM orders').get();
  assert.equal(order.confirmation_email_status, 'sent');
  assert.ok(Number.isFinite(Date.parse(order.confirmation_email_sent_at)));
  assert.equal(order.payment_status, 'paid');
  assert.ok(messages[0].text.includes(order.order_number));
  assert.ok(messages[0].text.includes('Purchased name snapshot'));
  assert.ok(!messages[0].text.includes('Different current product name'));
  assert.ok(messages[0].text.includes('36,00'));
  assert.ok(messages[0].text.includes('64,80'));
  assert.ok(!messages[0].html.includes('pi_fixture'));
  assert.ok(!messages[0].html.includes('cs_test_fixture'));
});

test('provider failure preserves paid order and records failed without webhook retry sends', async t => {
  const { env, db, send } = setup(t);
  const messages = emailProvider(env, true);
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  assert.equal(messages.length, 1);
  const order = db.prepare('SELECT * FROM orders').get();
  assert.equal(order.payment_status, 'paid');
  assert.equal(order.confirmation_email_status, 'failed');
  assert.equal(order.confirmation_email_sent_at, null);
  assert.equal(db.prepare('SELECT count(*) n FROM order_items').get().n, 1);
});

test('missing customer email persists the paid order and records unsent failure', async t => {
  const { env, db, send, session } = setup(t);
  const messages = emailProvider(env);
  session.customer_details.email = null;
  assert.equal((await send()).status, 200);
  assert.equal(messages.length, 0);
  const order = db.prepare('SELECT * FROM orders').get();
  assert.equal(order.payment_status, 'paid');
  assert.equal(order.customer_email, '');
  assert.equal(order.confirmation_email_status, 'failed');
});

test('confirmation escapes stored customer/item/address data and reads D1 historical values', async t => {
  const { env, db, send, session, line } = setup(t);
  session.customer_details.name = '<script>customer</script>';
  session.collected_information.shipping_details.address.line1 = '<img src=x onerror="bad">';
  line.description = 'Drink & <b>fruit</b>';
  // Persist without mail configuration, then simulate a future explicitly authorized recovery.
  await send();
  db.exec("UPDATE orders SET confirmation_email_status='pending', subtotal_amount=8100, total_amount=7400");
  const messages = emailProvider(env);
  line.description = 'Changed upstream';
  await send();
  assert.equal(messages.length, 1);
  assert.ok(messages[0].html.includes('&lt;script&gt;customer&lt;/script&gt;'));
  assert.ok(messages[0].html.includes('Drink &amp; &lt;b&gt;fruit&lt;/b&gt;'));
  assert.ok(messages[0].html.includes('&lt;img'));
  assert.ok(!messages[0].html.includes('<script>'));
  assert.ok(messages[0].text.includes('81,00'));
  assert.ok(messages[0].text.includes('74,00'));
  assert.ok(!messages[0].text.includes('Changed upstream'));
});

test('email final state write failure remains claimed and cannot duplicate an accepted send', async t => {
  const { env, db, send } = setup(t);
  const messages = emailProvider(env);
  db.exec(`CREATE TRIGGER fail_email_finish BEFORE UPDATE OF confirmation_email_sent_at ON orders
    BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;`);
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  assert.equal(messages.length, 1);
  assert.equal(db.prepare('SELECT confirmation_email_status s FROM orders').get().s, 'sending');
});

test('unpaid session never sends a confirmation', async t => {
  const { env, send, session } = setup(t);
  const messages = emailProvider(env);
  session.payment_status = 'unpaid';
  assert.equal((await send()).status, 200);
  assert.equal(messages.length, 0);
});

test('migration preserves historical orders, skips backlog and constrains delivery states', async t => {
  const { db, send } = setup(t);
  await send();
  const historical = db.prepare('SELECT * FROM orders').get();
  delete historical.confirmation_email_status;
  delete historical.confirmation_email_sent_at;
  const old = new DatabaseSync(':memory:');
  t.after(() => old.close());
  old.exec(readFileSync(new URL('../migrations/0003_orders.sql', import.meta.url), 'utf8'));
  const columns = Object.keys(historical);
  old.prepare(`INSERT INTO orders (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(historical));
  old.exec(readFileSync(new URL('../migrations/0006_order_confirmation.sql', import.meta.url), 'utf8'));
  assert.equal(old.prepare('SELECT confirmation_email_status s FROM orders').get().s, 'skipped');
  assert.equal(old.prepare('SELECT total_amount a FROM orders').get().a, historical.total_amount);
  assert.throws(() => old.exec("UPDATE orders SET confirmation_email_status='invalid'"));
});

test('failed order transaction never sends an email', async t => {
  const { env, db, send } = setup(t);
  const messages = emailProvider(env);
  db.exec(`CREATE TRIGGER fail_items BEFORE INSERT ON order_items
    BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;`);
  assert.equal((await send()).status, 503);
  assert.equal(messages.length, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 0);
});

function setup(t) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('../migrations/0003_orders.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0006_order_confirmation.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  const env = { STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: signingSecret,
    STRIPE_PRICE_ORANGE_SPRITZ: 'price_fixture', PROMO_DB: {
      prepare(sql) { return { sql, values: [], bind(...values) { this.values = values; return this; },
        async first() { return db.prepare(sql).get(...this.values) ?? null; } }; },
      async batch(statements) {
        db.exec('BEGIN');
        try {
          const results = statements.map(stmt => { db.prepare(stmt.sql).run(...stmt.values); return { success: true }; });
          db.exec('COMMIT'); return results;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    } };
  const session = { id: 'cs_test_fixture', object: 'checkout.session', mode: 'payment', status: 'complete',
    payment_status: 'paid', livemode: false, payment_intent: 'pi_fixture', customer: 'cus_fixture',
    customer_details: { name: 'Test Buyer', email: 'buyer@example.com', phone: '+34000000000' },
    collected_information: { shipping_details: { name: 'Test Recipient', address: {
      line1: 'Test Street 1', line2: 'Floor 2', postal_code: '08001', city: 'Barcelona', country: 'ES',
    } } }, amount_subtotal: 7200, amount_total: 6480, currency: 'eur',
    total_details: { amount_shipping: 0, amount_discount: 720, amount_tax: 0 } };
  const line = { id: 'li_fixture', object: 'item', description: 'Purchased name snapshot', quantity: 2,
    currency: 'eur', amount_subtotal: 7200, amount_total: 6480,
    price: { id: 'price_fixture', unit_amount: 3600, currency: 'eur',
      product: { id: 'prod_fixture', metadata: { nais_product_id: 'orange-spritz' }, name: 'Different current product name' } } };
  const event = { id: 'evt_fixture', object: 'event', type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000), livemode: false, data: { object: { id: session.id, object: 'checkout.session' } } };
  let reads = 0;
  const client = { checkout: { sessions: {
    async retrieve(id) { assert.equal(id, session.id); reads++; return session; },
    async listLineItems(id, params) { assert.equal(id, session.id); assert.deepEqual(params.expand, ['data.price.product']);
      return { data: [line], has_more: false }; },
  } } };
  function request(payload = event, options = {}) {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return new Request('https://naisdrinks.com/api/stripe-webhook', { method: 'POST',
      headers: { 'Stripe-Signature': Stripe.webhooks.generateTestHeaderString({ payload: body, secret: signingSecret }),
        'Content-Type': 'application/json' }, body, ...options });
  }
  const send = (payload = event, options = {}) => stripeWebhook(request(payload, options), env, () => client);
  return { db, env, session, line, event, client, request, send, reads: () => reads };
}

test('valid signed paid session persists historical customer, item and cents snapshot', async t => {
  const { db, send, event } = setup(t);
  const response = await send();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'received' });
  const order = db.prepare('SELECT * FROM orders').get();
  assert.equal(order.payment_status, 'paid');
  assert.equal(order.fulfillment_status, 'pending');
  assert.equal(order.customer_email, 'buyer@example.com');
  assert.equal(order.customer_name, 'Test Buyer');
  assert.equal(order.shipping_name, 'Test Recipient');
  assert.equal(order.shipping_address_line2, 'Floor 2');
  assert.equal(order.shipping_country, 'ES');
  assert.equal(order.subtotal_amount, 7200);
  assert.equal(order.discount_amount, 720);
  assert.equal(order.total_amount, 6480);
  assert.equal(order.paid_at, new Date(event.created * 1000).toISOString());
  const item = db.prepare('SELECT * FROM order_items').get();
  assert.equal(item.order_id, order.id);
  assert.equal(item.product_id, 'orange-spritz');
  assert.equal(item.product_name, 'Purchased name snapshot');
  assert.equal(item.stripe_price_id, 'price_fixture');
  assert.equal(item.quantity, 2);
  assert.equal(item.unit_amount, 3600);
  assert.equal(item.line_total_amount, 6480);
});

test('one-box shipping amount is the Stripe snapshot, not recalculated', async t => {
  const { send, db, session, line } = setup(t);
  Object.assign(line, { quantity: 1, amount_subtotal: 3600, amount_total: 3600 });
  Object.assign(session, { amount_subtotal: 3600, amount_total: 4200,
    total_details: { amount_shipping: 600, amount_discount: 0, amount_tax: 0 } });
  assert.equal((await send()).status, 200);
  assert.equal(db.prepare('SELECT shipping_amount FROM orders').get().shipping_amount, 600);
});

test('duplicates including different event IDs and concurrent deliveries create one order', async t => {
  const { send, db, event, line } = setup(t);
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => send({ ...event, id: `evt_${i}` })));
  assert.ok(results.every(result => result.status === 200));
  line.description = 'Changed later';
  assert.equal((await send()).status, 200);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM order_items').get().n, 1);
  assert.equal(db.prepare('SELECT product_name FROM order_items').get().product_name, 'Purchased name snapshot');
});

test('order service duplicate lookup preserves the early return without another Stripe fetch', async t => {
  const { send, env, client, reads } = setup(t);
  assert.equal(await hasOrderForSession(env.PROMO_DB, 'cs_test_fixture'), false);
  assert.equal((await send()).status, 200);
  assert.equal(await hasOrderForSession(env.PROMO_DB, 'cs_test_fixture'), true);
  client.checkout.sessions.retrieve = async () => { throw new Error('Must not fetch a duplicate'); };
  assert.equal((await send()).status, 200);
  assert.equal(reads(), 1);
});

test('order service persists trusted snapshots without HTTP or Stripe dependencies', async t => {
  const { send, env, db } = setup(t);
  assert.equal((await send()).status, 200);
  const { id, order_number, created_at, payment_status, fulfillment_status, ...snapshot } = db.prepare('SELECT * FROM orders').get();
  snapshot.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id)
    .map(({ id, order_id, ...item }) => item);
  snapshot.stripe_checkout_session_id = 'cs_test_service';
  snapshot.stripe_event_id = 'evt_service';
  const before = structuredClone(snapshot);
  await createPaidOrder(env.PROMO_DB, snapshot);
  await createPaidOrder(env.PROMO_DB, snapshot);
  assert.deepEqual(snapshot, before);
  const order = db.prepare('SELECT * FROM orders WHERE stripe_checkout_session_id = ?').get(snapshot.stripe_checkout_session_id);
  assert.notEqual(order.id, id);
  assert.equal(order.order_number, `NAIS-${order.id.toUpperCase()}`);
  assert.equal(order.payment_status, 'paid');
  assert.equal(order.fulfillment_status, 'pending');
  assert.equal(order.total_amount, snapshot.total_amount);
  assert.equal(db.prepare('SELECT count(*) n FROM order_items WHERE order_id = ?').get(order.id).n, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 2);
});

for (const status of ['unpaid', 'no_payment_required']) {
  test(`${status} session never creates a paid order`, async t => {
    const { send, db, session } = setup(t);
    session.payment_status = status;
    assert.equal((await send()).status, 200);
    assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 0);
  });
}
test('incomplete session never creates a paid order', async t => {
  const { send, db, session } = setup(t);
  session.status = 'open';
  assert.equal((await send()).status, 200);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 0);
});

test('invalid, missing, expired or tampered signatures never access Stripe or D1', async t => {
  const { request, env, client, event, reads } = setup(t);
  const body = JSON.stringify(event);
  for (const signature of ['', 'invalid', Stripe.webhooks.generateTestHeaderString({ payload: body, secret: signingSecret, timestamp: 1 }),
    Stripe.webhooks.generateTestHeaderString({ payload: body + ' ', secret: signingSecret })]) {
    const result = await stripeWebhook(request(event, { headers: { 'Stripe-Signature': signature } }), env, () => client);
    assert.equal(result.status, 400);
    assert.deepEqual(await result.json(), { status: 'unavailable' });
  }
  assert.equal(reads(), 0);
});

test('malformed signed event and JSON rejected safely', async t => {
  const { send } = setup(t);
  for (const payload of ['{broken', '{}', 'null', '[]']) assert.equal((await send(payload)).status, 400);
});

test('POST only; unsupported signed events acknowledged without creating orders', async t => {
  const { send, event, reads } = setup(t);
  assert.equal((await send(event, { method: 'GET', body: undefined })).status, 405);
  assert.equal((await send({ ...event, type: 'payment_intent.succeeded' })).status, 200);
  assert.equal(reads(), 0);
});

test('database failure rolls back parent and children; retry succeeds', async t => {
  const { db, send } = setup(t);
  db.exec("CREATE TRIGGER fail_items BEFORE INSERT ON order_items BEGIN SELECT RAISE(ABORT, 'private database detail'); END");
  const result = await send();
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { status: 'unavailable' });
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 0);
  db.exec('DROP TRIGGER fail_items');
  assert.equal((await send()).status, 200);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 1);
});

test('Stripe failure and missing configuration return safe retryable errors', async t => {
  const { send, client, env } = setup(t);
  client.checkout.sessions.retrieve = async () => { throw new Error('Stripe secret internal'); };
  const result = await send();
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { status: 'unavailable' });
  for (const binding of ['PROMO_DB', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) {
    const before = env[binding]; delete env[binding];
    assert.equal((await send()).status, 503); env[binding] = before;
  }
});

test('paginated line items are all persisted', async t => {
  const { send, client, line, db, session } = setup(t);
  session.amount_subtotal = 14400;
  session.amount_total = 12960;
  session.total_details.amount_discount = 1440;
  client.checkout.sessions.listLineItems = async (_id, params) => ({
    data: [{ ...line, id: params.starting_after ? 'li_second' : 'li_fixture' }], has_more: !params.starting_after,
  });
  assert.equal((await send()).status, 200);
  assert.equal(db.prepare('SELECT count(*) n FROM order_items').get().n, 2);
});

test('old price IDs resolve through Stripe metadata and preserve old price/name', async t => {
  const { send, env, line, session, db } = setup(t);
  env.STRIPE_PRICE_ORANGE_SPRITZ = 'price_new';
  line.price.unit_amount = 3000;
  line.amount_subtotal = 6000;
  line.amount_total = 5400;
  session.amount_subtotal = 6000;
  session.amount_total = 5400;
  session.total_details.amount_discount = 600;
  assert.equal((await send()).status, 200);
  assert.equal(db.prepare('SELECT unit_amount FROM order_items').get().unit_amount, 3000);
});

test('existing checkout prices work without product metadata', async t => {
  const { send, line } = setup(t);
  line.price.product.metadata = {};
  assert.equal((await send()).status, 200);
});

test('missing snapshot fields or fractional money fail without partial orders', async t => {
  const { send, session, db } = setup(t);
  session.amount_total = 12.5;
  assert.equal((await send()).status, 503);
  session.amount_total = 6480;
  session.collected_information.shipping_details = null;
  assert.equal((await send()).status, 503);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 0);
});

test('actual Pages handler uses mocked Stripe HTTP transport with real signature verification', async t => {
  const { env, request, session, line, db } = setup(t);
  globalThis.fetch = async url => {
    assert.ok(String(url).startsWith('https://api.stripe.com/v1/checkout/sessions/cs_test_fixture'));
    return Response.json(String(url).includes('/line_items') ? { object: 'list', data: [line], has_more: false } : session);
  };
  assert.equal((await onRequest({ env, request: request() })).status, 200);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 1);
});

test('updated schema permits only documented statuses; completed replay preserves later states', async t => {
  const { send, db } = setup(t);
  assert.equal((await send()).status, 200);
  for (const payment of ['paid', 'partially_refunded', 'refunded']) {
    for (const fulfillment of ['pending', 'preparing', 'shipped', 'delivered', 'cancelled']) {
      // Schema compatibility only: no refund/fulfillment handlers are introduced.
      db.prepare('UPDATE orders SET payment_status = ?, fulfillment_status = ?').run(payment, fulfillment);
      assert.equal((await send()).status, 200);
      const row = db.prepare('SELECT payment_status, fulfillment_status FROM orders').get();
      assert.equal(row.payment_status, payment);
      assert.equal(row.fulfillment_status, fulfillment);
    }
  }
  assert.throws(() => db.prepare('UPDATE orders SET payment_status = ?').run('unpaid'), /CHECK constraint/);
  assert.throws(() => db.prepare('UPDATE orders SET fulfillment_status = ?').run('unknown'), /CHECK constraint/);
});

test('updated foreign key rejects orphan items and cascades only the deleted order', async t => {
  const { send, db, event, session } = setup(t);
  assert.equal((await send()).status, 200);
  const first = db.prepare('SELECT id FROM orders').get().id;
  session.id = 'cs_test_second';
  assert.equal((await send({ ...event, id: 'evt_second', data: { object: { id: session.id, object: 'checkout.session' } } })).status, 200);
  assert.throws(() => db.prepare('UPDATE order_items SET order_id = ? WHERE order_id = ?').run('missing', first), /FOREIGN KEY constraint/);
  db.prepare('DELETE FROM orders WHERE id = ?').run(first);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM order_items').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM order_items WHERE order_id = ?').get(first).n, 0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('session uniqueness is independent of event ID; updated indexes require no insert changes', async t => {
  const { send, db, event, session } = setup(t);
  assert.equal((await send()).status, 200);
  // Artificial reuse proves event_id has no uniqueness/deduplication role.
  session.id = 'cs_test_other';
  assert.equal((await send({ ...event, data: { object: { id: session.id, object: 'checkout.session' } } })).status, 200);
  assert.equal(db.prepare('SELECT count(*) n FROM orders WHERE stripe_event_id = ?').get(event.id).n, 2);
  assert.throws(() => db.prepare('UPDATE orders SET stripe_checkout_session_id = ?').run(session.id), /UNIQUE constraint/);
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map(row => row.name);
  for (const name of ['idx_orders_fulfillment_status', 'idx_orders_created_at', 'idx_orders_customer_email', 'idx_order_items_order_id']) {
    assert.ok(indexes.includes(name));
  }
  for (const table of ['orders', 'order_items']) {
    const row = db.prepare(`SELECT * FROM ${table} LIMIT 1`).get();
    for (const column of db.prepare(`PRAGMA table_info(${table})`).all().filter(column => column.notnull)) {
      assert.notEqual(row[column.name], null, `${table}.${column.name} must be populated`);
    }
  }
});

test('server Session mapping preserves D1 product identity without current catalogue or legacy bindings', async t => {
  const { session, line, env, send, db } = setup(t);
  delete env.STRIPE_PRICE_ORANGE_SPRITZ;
  session.metadata = { nais_catalogue: 'd1-v1', nais_product_0: 'new-product', nais_price_0: 'price_fixture' };
  line.price.product.metadata = { nais_product_id: 'changed-later' };
  assert.equal((await send()).status, 200);
  const item = db.prepare('SELECT * FROM order_items').get();
  assert.equal(item.product_id, 'new-product');
  assert.equal(item.product_name, 'Purchased name snapshot');
  assert.equal(item.unit_amount, 3600);
  assert.equal(item.line_total_amount, 6480);
});

test('incomplete server Session product mapping fails safely without using legacy fallback', async t => {
  const { session, send, db } = setup(t);
  session.metadata = { nais_catalogue: 'd1-v1', nais_price_0: 'price_fixture' };
  assert.equal((await send()).status, 503);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n, 0);
});

for (const [id, binding] of Object.entries({
  'orange-spritz': 'STRIPE_PRICE_ORANGE_SPRITZ', 'passion-hugo': 'STRIPE_PRICE_PASSION_HUGO',
  'ginger-crush': 'STRIPE_PRICE_GINGER_CRUSH', 'tropical-hops': 'STRIPE_PRICE_TROPICAL_HOPS',
  'pack-variat': 'STRIPE_PRICE_PACK_VARIAT',
})) {
  test(`legacy Session without metadata retains ${id} identity`, async t => {
    const { line, env, send, db } = setup(t);
    delete env.STRIPE_PRICE_ORANGE_SPRITZ;
    env[binding] = 'price_fixture';
    line.price.product.metadata = {};
    assert.equal((await send()).status, 200);
    const item = db.prepare('SELECT * FROM order_items').get();
    assert.equal(item.product_id, id);
    assert.equal(item.product_name, 'Purchased name snapshot');
    assert.equal(item.unit_amount, 3600);
  });
}
