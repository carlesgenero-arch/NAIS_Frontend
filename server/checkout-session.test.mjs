import { checkoutDb, stripePrice, priceIds } from './testing/checkout-db.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkout } from './checkout/checkout-session.ts';
import { onRequest } from '../functions/api/checkout.ts';

beforeEach(t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Real network forbidden'); });
  const fixture = checkoutDb(t);
  env.PROMO_DB = fixture.db;
  sqlite = fixture.sqlite;
});
let sqlite;
const env = {
  STRIPE_SECRET_KEY: 'sk_test_placeholder', SITE_URL: 'https://naisdrinks.com/',
};
const item = (quantity, productId = 'orange-spritz') => ({ productId, quantity });
const request = (items = [item(1)], extra = {}, headers = {}) => new Request('https://naisdrinks.com/api/checkout', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ items, ...extra }),
});
const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test_fixture';
function mockClient(url = checkoutUrl) {
  const calls = [];
  return { calls, factory: () => ({ prices: { async retrieve(id) { return stripePrice(id); } }, checkout: { sessions: { async create(params) {
    calls.push(params); return { url };
  } } } }) };
}
for (const [name, items, shipping] of [
  ['one box', [item(1)], 600], ['two boxes', [item(2)], 0],
  ['mixed two boxes', [item(1), item(1, 'ginger-crush')], 0], ['three boxes', [item(3)], 0],
]) {
  test(`creates hosted payment Session for ${name}`, async () => {
    const mock = mockClient();
    const response = await checkout(request(items), env, mock.factory);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: checkoutUrl });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(mock.calls.length, 1);
    const params = mock.calls[0];
    assert.equal(params.mode, 'payment');
    assert.equal(params.customer_creation, 'always');
    assert.deepEqual(params.shipping_address_collection, { allowed_countries: ['ES'] });
    assert.equal(params.customer_email, undefined);
    assert.equal(params.customer, undefined);
    assert.deepEqual(params.name_collection, { individual: { enabled: true, optional: false } });
    assert.deepEqual(params.phone_number_collection, { enabled: true });
    assert.equal(params.allow_promotion_codes, true);
    assert.equal(params.discounts, undefined);
    assert.deepEqual(params.line_items, items.map(({ productId, quantity }) => ({
      price: priceIds[productId], quantity,
    })));
    assert.equal(params.shipping_options.length, 1);
    assert.deepEqual(params.shipping_options[0].shipping_rate_data.fixed_amount, { amount: shipping, currency: 'eur' });
    assert.equal(params.success_url, 'https://naisdrinks.com/checkout/success?session_id={CHECKOUT_SESSION_ID}');
    assert.equal(params.cancel_url, 'https://naisdrinks.com/checkout/cancel');
  });
}
test('merges duplicate items before creating line_items', async () => {
  const mock = mockClient();
  assert.equal((await checkout(request([item(1), item(1)]), env, mock.factory)).status, 200);
  assert.deepEqual(mock.calls[0].line_items, [{ price: priceIds['orange-spritz'], quantity: 2 }]);
});
test('missing configuration fails before Stripe API call', async () => {
  for (const key of ['STRIPE_SECRET_KEY', 'SITE_URL', 'PROMO_DB']) {
    for (const value of [undefined, '']) {
      const mock = mockClient();
      const response = await checkout(request(), { ...env, [key]: value }, mock.factory);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { status: 'unavailable' });
      assert.equal(mock.calls.length, 0);
    }
  }
});
test('rejects unsafe or non-origin SITE_URL configuration', async () => {
  for (const site of ['not a URL', 'javascript:alert(1)', 'http://naisdrinks.com', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com/?x=1', 'https://example.com/#fragment']) {
    const mock = mockClient();
    assert.equal((await checkout(request(), { ...env, SITE_URL: site }, mock.factory)).status, 503);
    assert.equal(mock.calls.length, 0);
  }
});
test('uses configured origin rather than request or forwarded host', async () => {
  const mock = mockClient();
  const req = new Request('https://preview.pages.dev/api/checkout', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': 'evil.example' },
    body: JSON.stringify({ items: [item(1)] }),
  });
  assert.equal((await checkout(req, env, mock.factory)).status, 200);
  assert.equal(mock.calls[0].cancel_url, 'https://naisdrinks.com/checkout/cancel');
});
test('rejects cross-origin browser requests', async () => {
  const mock = mockClient();
  assert.equal((await checkout(request([item(1)], {}, { Origin: 'https://evil.example' }), env, mock.factory)).status, 403);
  assert.equal(mock.calls.length, 0);
  assert.equal((await checkout(request([item(1)], {}, { Origin: 'https://naisdrinks.com' }), env, mock.factory)).status, 200);
});
test('rejects client discount, prices and return URLs before calling Stripe', async () => {
  for (const field of ['discount', 'discounts', 'price', 'shipping', 'success_url', 'cancel_url']) {
    const mock = mockClient();
    assert.equal((await checkout(request([item(1)], { [field]: 'untrusted' }), env, mock.factory)).status, 400);
    assert.equal(mock.calls.length, 0);
  }
  const mock = mockClient();
  assert.equal((await checkout(request([item(1, 'tropical-hops-harvest')]), env, mock.factory)).status, 400);
  assert.equal(mock.calls.length, 0);
});
test('Stripe API failure returns no sensitive details', async () => {
  const factory = () => ({ prices: { async retrieve(id) { return stripePrice(id); } }, checkout: { sessions: { async create() { throw new Error('private Stripe detail sk_test_placeholder'); } } } });
  const response = await checkout(request(), env, factory);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { status: 'checkout_unavailable' });
});
test('missing and unsafe Session URLs fail safely', async () => {
  for (const url of [null, '', 'invalid', 'https://evil.example', 'https://checkout.stripe.com.evil.example', 'http://checkout.stripe.com', 'https://user:pass@checkout.stripe.com']) {
    const response = await checkout(request(), env, mockClient(url).factory);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { status: 'checkout_unavailable' });
  }
  const response = await checkout(request(), env, () => ({ prices: { async retrieve(id) { return stripePrice(id); } }, checkout: { sessions: { async create() { return {}; } } } }));
  assert.equal(response.status, 502);
});
test('unexpected errors are contained', async () => {
  const response = await checkout({ get headers() { throw new Error('private stack'); } }, env);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
});
test('Pages endpoint invokes official SDK with mocked transport only', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/v1/prices/')) return Response.json({ ...stripePrice('price_orangeFixture'), object: 'price' });
    return Response.json({ id: 'cs_test_fixture', object: 'checkout.session', url: checkoutUrl });
  });
  const response = await onRequest({ request: request(), env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { url: checkoutUrl });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.stripe.com/v1/prices/price_orangeFixture');
  assert.equal(calls[1].url, 'https://api.stripe.com/v1/checkout/sessions');
});

for (const status of ['coming-soon', 'draft', 'archived']) {
  test(`D1 ${status} products cannot create a Checkout Session`, async () => {
    sqlite.prepare('UPDATE products SET status=? WHERE id=?').run(status, 'orange-spritz');
    const mock = mockClient();
    const response = await checkout(request(), env, mock.factory);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: 'invalid_product' });
    assert.equal(mock.calls.length, 0);
  });
}

test('unknown product fails before Stripe', async () => {
  const mock = mockClient();
  assert.equal((await checkout(request([item(1, 'unknown-product')]), env, mock.factory)).status, 400);
  assert.equal(mock.calls.length, 0);
});

test('new D1 active product works without the old allowlist or any Price binding', async () => {
  sqlite.exec("INSERT INTO products (id,slug,name,status,price_cents,stripe_price_id) VALUES ('new-product','new-product','New product','active',3600,'price_newFixture')");
  const mock = mockClient();
  const response = await checkout(request([item(2, 'new-product')]), {
    PROMO_DB: env.PROMO_DB, STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY, SITE_URL: env.SITE_URL,
  }, mock.factory);
  assert.equal(response.status, 200);
  assert.deepEqual(mock.calls[0].line_items, [{ price: 'price_newFixture', quantity: 2 }]);
  assert.deepEqual(mock.calls[0].metadata, { nais_catalogue: 'd1-v1', nais_product_0: 'new-product', nais_price_0: 'price_newFixture' });
  assert.equal(mock.calls[0].shipping_options[0].shipping_rate_data.fixed_amount.amount, 0);
});

test('D1 overrides legacy bindings and does not fall back when price ID is absent', async () => {
  const legacyEnv = { ...env, STRIPE_PRICE_ORANGE_SPRITZ: 'price_legacyIgnored' };
  sqlite.exec("UPDATE products SET stripe_price_id='price_databaseOnly' WHERE id='orange-spritz'");
  const mock = mockClient();
  assert.equal((await checkout(request(), legacyEnv, mock.factory)).status, 200);
  assert.equal(mock.calls[0].line_items[0].price, 'price_databaseOnly');
  for (const value of [null, '', 'not-a-price', 'price_']) {
    sqlite.prepare('UPDATE products SET stripe_price_id=? WHERE id=?').run(value, 'orange-spritz');
    const failed = mockClient();
    const response = await checkout(request(), legacyEnv, failed.factory);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
    assert.equal(failed.calls.length, 0);
  }
});

test('invalid stored status, fractional/negative cents and unsupported currency fail closed', async () => {
  sqlite.exec('PRAGMA ignore_check_constraints=ON');
  for (const [column, value] of [['status','invalid'], ['price_cents', -1], ['price_cents', 1.5], ['currency','usd']]) {
    sqlite.exec("UPDATE products SET status='active', price_cents=3600,currency='eur' WHERE id='orange-spritz'");
    sqlite.prepare(`UPDATE products SET ${column}=? WHERE id=?`).run(value, 'orange-spritz');
    const mock = mockClient();
    assert.equal((await checkout(request(), env, mock.factory)).status, 503);
    assert.equal(mock.calls.length, 0);
  }
});

test('Stripe price must match D1 cents, currency and one-time active configuration', async () => {
  for (const patch of [{ unit_amount: 1 }, { currency: 'usd' }, { active: false }, { type: 'recurring' }, { billing_scheme: 'tiered' }, { id: 'price_other' }]) {
    const mock = mockClient();
    const client = mock.factory();
    client.prices.retrieve = async id => ({ ...stripePrice(id), ...patch });
    const response = await checkout(request(), env, () => client);
    assert.equal(response.status, 503);
    assert.equal(mock.calls.length, 0);
  }
});

test('D1 and Stripe price lookup failures return safe errors without creating a session', async () => {
  const mock = mockClient();
  const response = await checkout(request(), { ...env, PROMO_DB: { prepare() { throw new Error('private SQL'); } } }, mock.factory);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
  const client = mock.factory();
  client.prices.retrieve = async () => { throw new Error('private Stripe details'); };
  const failed = await checkout(request(), env, () => client);
  assert.equal(failed.status, 502);
  assert.deepEqual(await failed.json(), { status: 'checkout_unavailable' });
  assert.equal(mock.calls.length, 0);
});

test('ambiguous D1 Price mappings fail before Session creation', async () => {
  sqlite.exec("UPDATE products SET stripe_price_id='price_orangeFixture' WHERE id='ginger-crush'");
  const mock = mockClient();
  assert.equal((await checkout(request([item(1), item(1,'ginger-crush')]), env, mock.factory)).status, 503);
  assert.equal(mock.calls.length, 0);
});
