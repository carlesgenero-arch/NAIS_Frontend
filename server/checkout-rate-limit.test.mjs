import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/checkout.ts';
import { enforceCheckoutRateLimit } from './checkout/checkout-rate-limit.ts';
import worker from './checkout/checkout-rate-limiter.worker.ts';
import { checkoutDb, stripePrice } from './testing/checkout-db.mjs';

function request(headers = {}, edge = true, method = 'POST') {
  const req = new Request('https://naisdrinks.com/api/checkout', { method,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.10', ...headers },
    ...(method === 'POST' ? { body: JSON.stringify({ items: [{ productId: 'orange-spritz', quantity: 1 }] }) } : {}),
  });
  if (edge) Object.defineProperty(req, 'cf', { value: {} });
  return req;
}

// Deterministic native-binding double; production counters are provided by Cloudflare.
function limiter() {
  const keys = [];
  const binding = { async limit({ key }) { keys.push(key); return { success: keys.filter(v => v === key).length <= 10 }; } };
  const service = { fetch: req => worker.fetch(req, { CHECKOUT_RATE_LIMITER: binding }) };
  return { keys, service };
}

test('first ten requests reach D1/Stripe; the next gets 429 before any further D1 or Stripe work', async t => {
  const { db } = checkoutDb(t); const limited = limiter();
  let queries = 0; let sessions = 0;
  const env = { CHECKOUT_RATE_LIMITER: limited.service, STRIPE_SECRET_KEY: 'sk_test_fixture', SITE_URL: 'https://naisdrinks.com',
    PROMO_DB: { prepare(...args) { queries++; return db.prepare(...args); } } };
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('/v1/prices/')) return Response.json({ ...stripePrice('price_orangeFixture'), object: 'price' });
    assert.equal(String(url), 'https://api.stripe.com/v1/checkout/sessions');
    sessions++; return Response.json({ url: 'https://checkout.stripe.com/c/pay/cs_test_fixture' });
  });
  for (let i = 0; i < 10; i++) assert.equal((await onRequest({ request: request(), env })).status, 200);
  const beforeQueries = queries;
  const rejected = await onRequest({ request: request(), env });
  assert.equal(rejected.status, 429);
  assert.deepEqual(await rejected.json(), { status: 'rate_limited' });
  assert.equal(rejected.headers.get('Cache-Control'), 'no-store');
  assert.equal(queries, beforeQueries); assert.equal(sessions, 10);
  assert.deepEqual(limited.keys, Array(11).fill('checkout:192.0.2.10'));
});

test('only Cloudflare edge metadata plus CF-Connecting-IP defines an IP bucket; other headers are ignored', async () => {
  const limited = limiter();
  await enforceCheckoutRateLimit(request({ 'X-Forwarded-For': '198.51.100.20', 'X-Real-IP': '198.51.100.21' }), limited.service);
  await enforceCheckoutRateLimit(request({ 'CF-Connecting-IP': '198.51.100.99' }, false), limited.service);
  await enforceCheckoutRateLimit(request({ 'CF-Connecting-IP': '' }), limited.service);
  assert.deepEqual(limited.keys, ['checkout:192.0.2.10', 'checkout:anonymous', 'checkout:anonymous']);
});

test('missing, broken or malformed service fails closed without touching D1 or Stripe', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('Stripe must not be called'); });
  for (const service of [undefined, { fetch() { throw Error('private details'); } },
    { async fetch() { return Response.json({ secret: 'private' }); } }]) {
    const response = await onRequest({ request: request(), env: { CHECKOUT_RATE_LIMITER: service,
      get PROMO_DB() { throw Error('D1 must not be touched'); } } });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { status: 'unavailable' });
  }
});

test('non-POST checkout requests retain method validation and never consume a rate-limit token', async () => {
  const response = await onRequest({ request: request({}, true, 'GET'), env: {
    CHECKOUT_RATE_LIMITER: { fetch() { throw Error('Must not rate limit'); } },
  } });
  assert.equal(response.status, 405);
});

test('private Worker validates its tiny contract and safely handles limiter failures', async () => {
  const req = (body, path = '/limit') => new Request('https://private.internal' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const binding = { async limit() { throw Error('private provider error'); } };
  assert.equal((await worker.fetch(req('{"key":"checkout:anonymous"}'), { CHECKOUT_RATE_LIMITER: binding })).status, 503);
  assert.equal((await worker.fetch(req('{"key":"checkout:anonymous"}'), {})).status, 503);
  for (const body of ['invalid', '{}', '{"key":"other:endpoint"}', '{"key":"checkout:anonymous","email":"fake@example.test"}']) {
    assert.equal((await worker.fetch(req(body), { CHECKOUT_RATE_LIMITER: binding })).status, 400);
  }
  assert.equal((await worker.fetch(req('{}', '/api/stripe-webhook'), { CHECKOUT_RATE_LIMITER: binding })).status, 404);
});
