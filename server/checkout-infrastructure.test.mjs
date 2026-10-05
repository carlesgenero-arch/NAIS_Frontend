import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKOUT_CATALOGUE, isCheckoutProductId, resolveCheckoutPrice } from './checkout/checkout-catalogue.ts';
import { BOX_PRICE_EUR, UNITS_PER_BOX, SHIPPING_PRICE_EUR, FREE_SHIPPING_MIN_BOXES,
  EXPECTED_BOX_PRICE_CENTS, HOSTED_CHECKOUT_OPTIONS, checkoutShippingOption } from './checkout/checkout-rules.ts';
import { createStripeClient } from './stripe/stripe-client.ts';

const mappings = {
  'orange-spritz': 'STRIPE_PRICE_ORANGE_SPRITZ',
  'passion-hugo': 'STRIPE_PRICE_PASSION_HUGO',
  'ginger-crush': 'STRIPE_PRICE_GINGER_CRUSH',
  'tropical-hops': 'STRIPE_PRICE_TROPICAL_HOPS',
  'pack-variat': 'STRIPE_PRICE_PACK_VARIAT',
};

test('catalogue contains exactly the five approved products', () => {
  assert.deepEqual(CHECKOUT_CATALOGUE, mappings);
  assert.ok(Object.isFrozen(CHECKOUT_CATALOGUE));
});
for (const [id, binding] of Object.entries(mappings)) {
  test(`resolves ${id} only through its server binding`, () => {
    assert.ok(isCheckoutProductId(id));
    assert.equal(resolveCheckoutPrice(id, { [binding]: 'price_testFixture' }), 'price_testFixture');
  });
}
test('unknown, coming-soon and prototype IDs never resolve', () => {
  for (const id of ['tropical-hops-harvest', 'unknown', '__proto__', 'constructor', 'toString', '', null, 1, {}]) {
    assert.equal(isCheckoutProductId(id), false);
    assert.equal(resolveCheckoutPrice(id, {}), null);
  }
});
test('missing or malformed server Price bindings fail closed', () => {
  for (const value of [undefined, null, 12, '', 'prod_test', 'price_', ' price_test', 'price_test ']) {
    assert.throws(() => resolveCheckoutPrice('orange-spritz', { STRIPE_PRICE_ORANGE_SPRITZ: value }), /binding/);
  }
});
test('business constants describe a box, not a single can', () => {
  assert.equal(UNITS_PER_BOX, 16);
  assert.equal(BOX_PRICE_EUR, 36);
  assert.equal(EXPECTED_BOX_PRICE_CENTS, 3600);
  assert.equal(SHIPPING_PRICE_EUR, 6);
  assert.equal(FREE_SHIPPING_MIN_BOXES, 2);
});
test('one box receives only a paid native shipping option', () => {
  const rate = checkoutShippingOption(1).shipping_rate_data;
  assert.equal(rate.type, 'fixed_amount');
  assert.deepEqual(rate.fixed_amount, { amount: 600, currency: 'eur' });
});
test('two or more boxes receive free native shipping', () => {
  for (const boxes of [2, 3, 24, 120]) {
    assert.deepEqual(checkoutShippingOption(boxes).shipping_rate_data.fixed_amount, { amount: 0, currency: 'eur' });
  }
});
test('shipping rejects invalid box counts', () => {
  for (const boxes of [0, -1, 1.5, NaN, Infinity, '2', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => checkoutShippingOption(boxes), /positive integer/);
  }
});
test('promotion codes are delegated to Stripe without manual discounts', () => {
  assert.deepEqual(HOSTED_CHECKOUT_OPTIONS, { mode: 'payment', allow_promotion_codes: true });
  assert.ok(Object.isFrozen(HOSTED_CHECKOUT_OPTIONS));
});
test('Stripe client rejects missing secrets', () => {
  for (const key of [undefined, null, '', '   ']) {
    assert.throws(() => createStripeClient({ STRIPE_SECRET_KEY: key }), /secret binding/);
  }
});
test('Stripe client construction performs no network requests', t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', () => { calls++; throw new Error('Unexpected network request'); });
  const client = createStripeClient({ STRIPE_SECRET_KEY: 'sk_test_placeholder' });
  assert.ok(client.checkout.sessions);
  assert.equal(calls, 0);
});
