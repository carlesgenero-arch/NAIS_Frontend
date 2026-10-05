import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkout } from './checkout/checkout-session.ts';
import { onRequest } from '../functions/api/checkout.ts';

beforeEach(t => t.mock.method(globalThis, 'fetch', () => { throw new Error('Real network forbidden'); }));
const env = {
  STRIPE_SECRET_KEY: 'sk_test_placeholder', SITE_URL: 'https://naisdrinks.com/',
  STRIPE_PRICE_ORANGE_SPRITZ: 'price_orangeFixture', STRIPE_PRICE_GINGER_CRUSH: 'price_gingerFixture',
};
const item = (quantity, productId = 'orange-spritz') => ({ productId, quantity });
const request = (items = [item(1)], extra = {}, headers = {}) => new Request('https://naisdrinks.com/api/checkout', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ items, ...extra }),
});
const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test_fixture';
function mockClient(url = checkoutUrl) {
  const calls = [];
  return { calls, factory: () => ({ checkout: { sessions: { async create(params) {
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
      price: productId === 'orange-spritz' ? env.STRIPE_PRICE_ORANGE_SPRITZ : env.STRIPE_PRICE_GINGER_CRUSH, quantity,
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
  assert.deepEqual(mock.calls[0].line_items, [{ price: env.STRIPE_PRICE_ORANGE_SPRITZ, quantity: 2 }]);
});
test('missing configuration fails before Stripe API call', async () => {
  for (const key of ['STRIPE_SECRET_KEY', 'SITE_URL', 'STRIPE_PRICE_ORANGE_SPRITZ']) {
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
  const factory = () => ({ checkout: { sessions: { async create() { throw new Error('private Stripe detail sk_test_placeholder'); } } } });
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
  const response = await checkout(request(), env, () => ({ checkout: { sessions: { async create() { return {}; } } } }));
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
    return Response.json({ id: 'cs_test_fixture', object: 'checkout.session', url: checkoutUrl });
  });
  const response = await onRequest({ request: request(), env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { url: checkoutUrl });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.stripe.com/v1/checkout/sessions');
});
