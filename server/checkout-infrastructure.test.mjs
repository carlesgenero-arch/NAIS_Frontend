import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS_PER_BOX, SHIPPING_PRICE_EUR, FREE_SHIPPING_MIN_BOXES,
  HOSTED_CHECKOUT_OPTIONS, checkoutShippingOption } from './checkout/checkout-rules.ts';
import { createStripeClient } from './stripe/stripe-client.ts';

test('business constants describe a box, not a single can', () => {
  assert.equal(UNITS_PER_BOX, 16);
  assert.equal(36);
  assert.equal(3600);
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
