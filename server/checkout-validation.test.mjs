import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCheckout } from './checkout/checkout-validation.ts';

// Exercise validation independently of Session creation.
async function onRequest({ request, env }) {
  const result = await validateCheckout(request, env);
  return result instanceof Response ? result : Response.json(
    { status: 'validated_only', totalBoxes: result.totalBoxes },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
import { MAX_CART_QUANTITY } from '../src/shared/cart-limits.ts';
import { CHECKOUT_CATALOGUE } from './checkout/checkout-catalogue.ts';
import { MAX_CHECKOUT_LINES } from './checkout/checkout-validation.ts';

const bindings = Object.fromEntries(Object.values(CHECKOUT_CATALOGUE).map((key, index) => [key, `price_fixture${index}`]));

const line = (quantity = 2, productId = 'orange-spritz') => ({ productId, quantity });
const submit = (payload, options = {}, env = bindings) => onRequest({ env, request: new Request('https://naisdrinks.com/api/checkout', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), ...options,
}) });

test('validates every allowed product without Stripe secret or network access', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Network forbidden'); });
  const response = await submit({ items: Object.keys(CHECKOUT_CATALOGUE).map(id => line(1, id)) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'validated_only', totalBoxes: 5 });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Content-Type'), /application\/json/);
});
test('POST only, including OPTIONS and HEAD', async () => {
  for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await onRequest({ request: new Request('https://example.com/api/checkout', { method }) });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
  }
});
test('requires JSON media type, allowing charset parameters', async () => {
  for (const headers of [{}, { 'Content-Type': 'text/plain' }, { 'Content-Type': 'application/jsonp' }]) {
    assert.equal((await submit({ items: [line()] }, { headers })).status, 415);
  }
  assert.equal((await submit({ items: [line()] }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } })).status, 200);
});
test('rejects malformed or missing JSON', async () => {
  for (const body of ['', '{', '{"items":NaN}', '{"items":Infinity}']) {
    assert.equal((await submit(null, { body })).status, 400);
  }
});
test('rejects invalid top-level and items structures', async () => {
  for (const payload of [null, [], 4, 'cart', {}, { items: null }, { items: {} }, { items: 'x' }, { items: [] }]) {
    assert.equal((await submit(payload)).status, 400);
  }
});
test('limits raw cart lines', async () => {
  assert.equal(MAX_CHECKOUT_LINES, 5);
  assert.equal((await submit({ items: Array.from({ length: MAX_CHECKOUT_LINES + 1 }, () => line(1)) })).status, 400);
});
test('rejects malformed line objects', async () => {
  for (const item of [null, [], 'item', {}, { productId: 'orange-spritz' }, { quantity: 1 }]) {
    assert.equal((await submit({ items: [item] })).status, 400);
  }
});
test('rejects unknown, non-string, prototype and coming-soon product IDs', async () => {
  for (const id of ['tropical-hops-harvest', 'unknown', '__proto__', 'constructor', 'toString', '', ' orange-spritz', 1, null, {}]) {
    assert.equal((await submit({ items: [line(1, id)] })).status, 400);
  }
});
test('rejects invalid quantities', async () => {
  for (const quantity of [0, -1, 1.5, MAX_CART_QUANTITY + 1, '2', true, null, {}, NaN, Infinity]) {
    assert.equal((await submit({ items: [line(quantity)] })).status, 400);
  }
  // Valid JSON exponent parses as Infinity rather than null.
  assert.equal((await submit(null, { body: '{"items":[{"productId":"orange-spritz","quantity":1e999}]}' })).status, 400);
});
test('accepts quantity boundaries', async () => {
  for (const quantity of [1, MAX_CART_QUANTITY]) {
    assert.equal((await submit({ items: [line(quantity)] })).status, 200);
  }
});
test('duplicate quantities are combined before enforcing the maximum', async () => {
  assert.equal((await submit({ items: [line(1), line(MAX_CART_QUANTITY - 1)] })).status, 200);
  assert.equal((await submit({ items: [line(1), line(MAX_CART_QUANTITY)] })).status, 400);
});
test('rejects untrusted extra fields at both levels', async () => {
  for (const field of ['price', 'subtotal', 'total', 'shipping', 'shipping_options', 'shipping_rate', 'shippingPrice', 'totalBoxes', 'currency', 'priceId', 'stripePriceId', 'discount', 'couponId', 'successUrl', 'cancelUrl', 'success_url', 'cancel_url', 'anything']) {
    assert.equal((await submit({ items: [line()], [field]: 'untrusted' })).status, 400);
    assert.equal((await submit({ items: [{ ...line(), [field]: 'untrusted' }] })).status, 400);
  }
});
test('rejects oversized bodies without trusting Content-Length', async () => {
  assert.equal((await submit(null, { body: ' '.repeat(4097), headers: { 'Content-Type': 'application/json', 'Content-Length': '1' } })).status, 400);
});
test('body read failures return safe JSON', async () => {
  const request = { method: 'POST', headers: new Headers({ 'Content-Type': 'application/json' }),
    body: new ReadableStream({ start(controller) { controller.error(new Error('private details')); } }),
  };
  const response = await onRequest({ request });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { status: 'invalid_payload' });
});

for (const [name, items, totalBoxes] of [
  ['single product', [line(1)], 1],
  ['mixed products', [line(1), line(1, 'ginger-crush')], 2],
  ['multiple quantities', [line(2)], 2],
  ['duplicate lines', [line(2), line(3)], 5],
]) {
  test(`resolves ${name} and calculates total boxes`, async () => {
    const response = await submit({ items });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'validated_only', totalBoxes });
  });
}
test('missing or invalid required bindings fail safely without disclosing configuration', async () => {
  for (const env of [{}, { ...bindings, STRIPE_PRICE_GINGER_CRUSH: undefined }, { ...bindings, STRIPE_PRICE_GINGER_CRUSH: 'private-invalid-value' }]) {
    const response = await submit({ items: [line(1), line(1, 'ginger-crush')] }, {}, env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
  }
});
test('only bindings for products in this cart are required', async () => {
  assert.equal((await submit({ items: [line(1)] }, {}, { STRIPE_PRICE_ORANGE_SPRITZ: 'price_fixture' })).status, 200);
});
test('server resolution retains corresponding prices and quantities internally', async () => {
  const { resolveCheckoutItems } = await import('./checkout/checkout-resolution.ts');
  const { items, totalBoxes } = resolveCheckoutItems(new Map([['orange-spritz', 2], ['ginger-crush', 1]]), bindings);
  assert.deepEqual({ items, totalBoxes }, {
    items: [{ price: bindings.STRIPE_PRICE_ORANGE_SPRITZ, quantity: 2 }, { price: bindings.STRIPE_PRICE_GINGER_CRUSH, quantity: 1 }],
    totalBoxes: 3,
  });
});

for (const [name, quantities, expectedBoxes, expectedAmount] of [
  ['one box', [['orange-spritz', 1]], 1, 600],
  ['two boxes', [['orange-spritz', 2]], 2, 0],
  ['three boxes', [['orange-spritz', 3]], 3, 0],
  ['larger cart', [['orange-spritz', 24], ['ginger-crush', 24]], 48, 0],
  ['mixed two-box cart', [['orange-spritz', 1], ['ginger-crush', 1]], 2, 0],
]) {
  test(`server selects exactly one native shipping rate for ${name}`, async t => {
    t.mock.method(globalThis, 'fetch', () => { throw new Error('No Stripe request expected'); });
    const { resolveCheckoutItems } = await import('./checkout/checkout-resolution.ts');
    const resolved = resolveCheckoutItems(new Map(quantities), bindings);
    assert.equal(resolved.totalBoxes, expectedBoxes);
    assert.equal(resolved.shippingOptions.length, 1);
    assert.deepEqual(resolved.shippingOptions[0], {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: expectedAmount, currency: 'eur' },
        display_name: expectedAmount === 0 ? 'Enviament gratuït' : 'Enviament estàndard',
      },
    });
    const response = await submit({ items: quantities.map(([id, quantity]) => line(quantity, id)) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'validated_only', totalBoxes: expectedBoxes });
  });
}
