import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutDb } from './testing/checkout-db.mjs';
import { stripeCatalogue } from './testing/stripe-catalogue.mjs';
import { updateAdminProduct } from './catalogue/product-write.service.ts';
import { adminProductWrite } from './admin/admin-product-write.ts';
import { getPurchasableProducts } from './catalogue/product.service.ts';
import { checkout } from './checkout/checkout-session.ts';

function setup(t) {
  const { db, sqlite } = checkoutDb(t); const stripe = stripeCatalogue();
  const update = (id, patch) => updateAdminProduct(db, id, patch, () => stripe.client);
  const row = id => sqlite.prepare('SELECT * FROM products WHERE id=?').get(id);
  return { db, sqlite, stripe, update, row };
}
for (const status of ['draft', 'coming-soon']) test('activation from ' + status + ' creates and persists a verified mapping', async t => {
  const { sqlite, stripe, update, row } = setup(t);
  const id = 'tropical-hops-harvest';
  sqlite.prepare('UPDATE products SET status=? WHERE id=?').run(status, id);
  const p = await update(id, { status: 'active', priceCents: 3750, description: 'Fixture description' });
  assert.equal(p.status, 'active'); assert.equal(row(id).stripe_product_id, p.stripeProductId);
  assert.equal(row(id).stripe_price_id, p.stripePriceId); assert.equal(row(id).price_cents, 3750);
  const product = stripe.products.get(p.stripeProductId);
  assert.equal(product.metadata.nais_product_id, id); assert.equal(product.name, p.name);
  assert.equal(product.description, 'Fixture description');
  const price = stripe.prices.get(p.stripePriceId);
  assert.equal(price.unit_amount, 3750); assert.equal(price.currency, 'eur');
  assert.equal(price.type, 'one_time'); assert.equal(price.billing_scheme, 'per_unit');
  await update(id, { status: 'active' });
  assert.equal(stripe.calls.filter(c => c[0] === 'product.create').length, 1);
  assert.equal(stripe.calls.filter(c => c[0] === 'price.create').length, 1);
});
test('reuses an existing Product without Price and recovers legacy Product from Price', async t => {
  const { sqlite, stripe, update } = setup(t);
  sqlite.prepare("UPDATE products SET stripe_product_id='prod_existing' WHERE id='tropical-hops-harvest'").run();
  stripe.products.set('prod_existing', { id: 'prod_existing', active: true, metadata: {} });
  assert.equal((await update('tropical-hops-harvest', { status: 'active' })).stripeProductId, 'prod_existing');
  assert.equal((await update('orange-spritz', { status: 'active' })).stripeProductId, 'prod_orangespritz');
  assert.equal(stripe.calls.filter(c => c[0] === 'product.create').length, 0);
});
test('price switch is atomic and old Price is deactivated only after D1 commit; checkout uses new Price', async t => {
  const { db, row, stripe, update } = setup(t);
  const old = row('orange-spritz').stripe_price_id;
  const deactivate = stripe.client.prices.update;
  stripe.client.prices.update = async (id, params) => {
    assert.equal(id, old); assert.equal(params.active, false);
    assert.notEqual(row('orange-spritz').stripe_price_id, old);
    assert.equal(row('orange-spritz').price_cents, 3750);
    return deactivate(id, params);
  };
  const p = await update('orange-spritz', { priceCents: 3750 });
  assert.equal(stripe.prices.get(old).unit_amount, 3600); assert.equal(stripe.prices.get(old).active, false);
  assert.equal(stripe.calls.filter(c => c[0] === 'product.create').length, 0);
  assert.equal((await getPurchasableProducts(db, ['orange-spritz']))[0].stripePriceId, p.stripePriceId);
  let session;
  const response = await checkout(new Request('https://nais.example/api/checkout', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ productId: p.id, quantity: 1 }] }) }),
    { PROMO_DB: db, SITE_URL: 'https://nais.example', STRIPE_SECRET_KEY: 'sk_test_fixture' },
    () => ({ prices: stripe.client.prices, checkout: { sessions: { create: async params => {
      session = params; return { url: 'https://checkout.stripe.com/c/pay/fixture' };
    } } } }));
  assert.equal(response.status, 200); assert.equal(session.line_items[0].price, p.stripePriceId);
});
for (const operation of ['products.update', 'prices.create', 'prices.retrieve']) {
  test('Stripe failure in ' + operation + ' preserves exact D1 snapshot and returns generic error', async t => {
    const { db, row, stripe } = setup(t); const before = row('orange-spritz');
    const [resource, method] = operation.split('.');
    stripe.client[resource][method] = async () => { throw Error('private Stripe failure'); };
    const response = await adminProductWrite({ data: { admin: {} }, params: { id: 'orange-spritz' }, env: { PROMO_DB: db },
      request: new Request('https://nais.example/api/admin/products/orange-spritz', { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceCents: 3750 }) }) }, 'update', () => stripe.client);
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { status: 'unavailable' });
    assert.deepEqual(row('orange-spritz'), before);
    assert.equal(stripe.calls.filter(c => c[0] === 'price.update').length, 0);
  });
}
test('failed activation never exposes an active product with missing mapping', async t => {
  const { stripe, update, row } = setup(t); const before = row('tropical-hops-harvest');
  stripe.client.prices.create = async () => { throw Error('Stripe offline'); };
  await assert.rejects(update('tropical-hops-harvest', { status: 'active' }));
  assert.deepEqual(row('tropical-hops-harvest'), before);
});
test('failed D1 commit can retry without duplicate Product/Price even without an idempotency cache', async t => {
  const { db, stripe, update, row } = setup(t); const before = row('tropical-hops-harvest');
  const failedDb = { prepare(sql) { if (sql.startsWith('UPDATE products SET slug=')) throw Error('D1 unavailable'); return db.prepare(sql); } };
  await assert.rejects(updateAdminProduct(failedDb, 'tropical-hops-harvest', { status: 'active' }, () => stripe.client));
  assert.deepEqual(row('tropical-hops-harvest'), before);
  await update('tropical-hops-harvest', { status: 'active' });
  assert.equal(stripe.calls.filter(c => c[0] === 'product.create').length, 1);
  assert.equal(stripe.calls.filter(c => c[0] === 'price.create').length, 1);
});
test('concurrent price changes cannot overwrite the winning D1 configuration or deactivate its Price', async t => {
  const { stripe, update, row } = setup(t);
  const results = await Promise.allSettled([update('orange-spritz', { priceCents: 3750 }), update('orange-spritz', { priceCents: 3800 })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'product_changed');
  const p = row('orange-spritz'); const price = stripe.prices.get(p.stripe_price_id);
  assert.equal(price.active, true); assert.equal(price.unit_amount, p.price_cents);
});
test('invalid activation and client Stripe identifiers cause no Stripe operations', async t => {
  const { stripe, update } = setup(t);
  for (const patch of [{ status: 'active', priceCents: 0 }, { priceCents: 1.5 }, { currency: 'usd' },
    { stripePriceId: 'price_attack' }, { stripeProductId: 'prod_attack' }, { stripe_price_id: 'price_attack' }]) {
    await assert.rejects(update('tropical-hops-harvest', patch), error => error.status === 400);
  }
  assert.equal(stripe.calls.length, 0);
});
test('simultaneous activation never creates multiple Stripe objects for one product', async t => {
  const { stripe, update, row } = setup(t);
  await Promise.allSettled([update('tropical-hops-harvest', { status: 'active' }), update('tropical-hops-harvest', { status: 'active' })]);
  await update('tropical-hops-harvest', { status: 'active' });
  assert.equal(row('tropical-hops-harvest').status, 'active');
  assert.equal([...stripe.products.values()].filter(p => p.metadata.nais_product_id === 'tropical-hops-harvest').length, 1);
  assert.equal([...stripe.prices.values()].filter(p => p.metadata?.nais_product_id === 'tropical-hops-harvest').length, 1);
});
test('a Price still referenced by another D1 product is not deactivated', async t => {
  const { sqlite, stripe, update } = setup(t);
  sqlite.prepare("UPDATE products SET stripe_price_id='price_orangeFixture' WHERE id='ginger-crush'").run();
  await update('orange-spritz', { priceCents: 3750 });
  assert.equal(stripe.prices.get('price_orangeFixture').active, true);
  assert.equal(stripe.calls.filter(c => c[0] === 'price.update').length, 0);
});
test('mapped Stripe Product belonging to another NAIS product is rejected', async t => {
  const { stripe, update, row } = setup(t); const before = row('orange-spritz');
  stripe.products.get('prod_orangespritz').metadata.nais_product_id = 'other-product';
  await assert.rejects(update('orange-spritz', { priceCents: 3750 }));
  assert.deepEqual(row('orange-spritz'), before); assert.equal(stripe.calls.length, 0);
});
test('invalid newly created Price is never committed', async t => {
  const { stripe, update, row } = setup(t); const before = row('orange-spritz');
  const retrieve = stripe.client.prices.retrieve;
  stripe.client.prices.retrieve = async id => ({ ...await retrieve(id), currency: 'usd' });
  await assert.rejects(update('orange-spritz', { priceCents: 3750 }));
  assert.deepEqual(row('orange-spritz'), before);
});
test('cleanup failure keeps the new valid D1 mapping; never rolls back to a possibly inactive Price', async t => {
  const { stripe, update, row } = setup(t);
  stripe.client.prices.update = async () => { throw Error('cleanup failed'); };
  await assert.rejects(update('orange-spritz', { priceCents: 3750 }));
  const p = row('orange-spritz'); assert.equal(p.price_cents, 3750);
  assert.equal(stripe.prices.get(p.stripe_price_id).active, true);
  await update('orange-spritz', { priceCents: 3750 });
  assert.equal(stripe.calls.filter(c => c[0] === 'price.create').length, 1);
});
