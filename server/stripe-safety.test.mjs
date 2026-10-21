import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardedStripeClient, assertStripeTestObject } from './stripe/stripe-safety.ts';
import { createStripeClient } from './stripe/stripe-client.ts';

const uat = { NAIS_ENVIRONMENT: 'uat', STRIPE_SECRET_KEY: 'sk_test_fixture' };
for (const key of ['sk_live_fixture', 'rk_live_fixture', '', undefined, 'invalid', 'sk_test_']) {
  test('UAT rejects invalid/non-TEST configuration before factory: ' + String(key), () => {
    assert.throws(() => guardedStripeClient({ ...uat, STRIPE_SECRET_KEY: key }, () => { assert.fail('Factory must not run'); }));
  });
}
test('production leaves original client and LIVE configuration unchanged', () => {
  const client = { prices: { retrieve() { return { livemode: true }; } } };
  assert.equal(guardedStripeClient({ STRIPE_SECRET_KEY: 'sk_live_fixture' }, () => client), client);
  assert.ok(createStripeClient({ STRIPE_SECRET_KEY: 'sk_live_fixture' }));
  assert.throws(() => createStripeClient({ ...uat, STRIPE_SECRET_KEY: 'sk_live_fixture' }));
});
for (const [resource, methods] of Object.entries({ products: ['retrieve', 'create', 'update'], prices: ['retrieve', 'create', 'update'],
  coupons: ['retrieve'], promotionCodes: ['create'], sessions: ['retrieve', 'create'] })) {
  for (const method of methods) test('UAT validates ' + resource + '.' + method + ' responses', async () => {
    let result = { livemode: false };
    const api = { async [method]() { return result; } };
    const client = guardedStripeClient(uat, () => resource === 'sessions' ? { checkout: { sessions: api } } : { [resource]: api });
    const target = resource === 'sessions' ? client.checkout.sessions : client[resource];
    assert.equal((await target[method]()).livemode, false);
    for (const invalid of [{ livemode: true }, {}, null]) {
      result = invalid; await assert.rejects(target[method]());
    }
  });
}
test('lists validate every Price and expanded line-item object', async () => {
  let price = { object: 'price', livemode: false, product: { object: 'product', livemode: false } };
  const client = guardedStripeClient(uat, () => ({ prices: { async list() { return { data: [price] }; } },
    checkout: { sessions: { async listLineItems() { return { data: [{ object: 'item', price }] }; } } } }));
  await client.prices.list(); await client.checkout.sessions.listLineItems();
  price.product.livemode = true;
  await assert.rejects(client.prices.list()); await assert.rejects(client.checkout.sessions.listLineItems());
  delete price.product.livemode;
  await assert.rejects(client.checkout.sessions.listLineItems());
});
test('signed event TEST proof is required, including expanded event objects', () => {
  assert.doesNotThrow(() => assertStripeTestObject(uat, { object: 'event', livemode: false }));
  for (const value of [{ livemode: true }, {}, { livemode: false, data: { object: { object: 'checkout.session' } } }]) {
    assert.throws(() => assertStripeTestObject(uat, value));
  }
});

test('UAT reconciliation refuses a LIVE stale Price and leaves cleanup pending', async t => {
  const { checkoutDb } = await import('./testing/checkout-db.mjs');
  const { reconcileAdminProductPrices } = await import('./catalogue/product-write.service.ts');
  const { db, sqlite } = checkoutDb(t);
  sqlite.prepare("UPDATE products SET stripe_price_cleanup_ids='[\"price_stale\"]' WHERE id='orange-spritz'").run();
  let writes = 0;
  const client = guardedStripeClient(uat, () => ({ prices: {
    async retrieve() { return { id: 'price_stale', active: true, livemode: true }; },
    async update() { writes++; throw new Error('Must not deactivate'); },
  } }));
  const result = await reconcileAdminProductPrices(db, 'orange-spritz', () => client);
  assert.equal(result.stripePriceCleanupPending, true); assert.equal(writes, 0);
  assert.equal(sqlite.prepare("SELECT stripe_price_cleanup_ids ids FROM products WHERE id='orange-spritz'").get().ids, '["price_stale"]');
});
