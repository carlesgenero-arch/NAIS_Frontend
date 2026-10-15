import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutDb } from './testing/checkout-db.mjs';
import { stripeCatalogue } from './testing/stripe-catalogue.mjs';
import { normalizeCheckoutPresentation, normalizationDiagnostic } from './stripe/normalize-checkout-presentation.mjs';
import { updateAdminProduct } from './catalogue/product-write.service.ts';

test('normalization changes only descriptions and preserves names, prices, D1 and images', async t => {
  const { sqlite } = checkoutDb(t);
  const stripe = stripeCatalogue();
  const rows = sqlite.prepare(`SELECT id,name,status,stripe_product_id AS stripeProductId,
    stripe_price_id AS stripePriceId,price_cents AS priceCents,currency FROM products`).all();
  const before = sqlite.prepare('SELECT * FROM products').all();
  const oldPrices = structuredClone([...stripe.prices]);
  for (const product of stripe.products.values()) {
    product.name = 'Existing Stripe name ' + product.id;
    product.description = 'Long marketing copy';
    product.images = product.id.includes('ginger') ? ['https://nais.example/ginger.png'] : [];
  }
  const previousProducts = structuredClone([...stripe.products]);
  const count = await normalizeCheckoutPresentation(rows, stripe.client);
  assert.equal(count, rows.filter(p => p.status === 'active').length);
  for (const row of rows.filter(p => p.status === 'active')) {
    const product = stripe.products.get(stripe.prices.get(row.stripePriceId).product);
    assert.equal(product.description, 'Pack 16');
    assert.equal(product.name, 'Existing Stripe name ' + product.id);
  }
  assert.deepEqual([...stripe.prices], oldPrices);
  assert.deepEqual([...stripe.products], previousProducts.map(([id, product]) => [id,
    rows.some(row => row.status === 'active' && stripe.prices.get(row.stripePriceId).product === id)
      ? { ...product, description: 'Pack 16' } : product]));
  for (const call of stripe.calls) {
    assert.equal(call[0], 'product.update');
    assert.deepEqual(call[2], { description: 'Pack 16' });
  }
  assert.deepEqual(sqlite.prepare('SELECT * FROM products').all(), before);
  const callsBeforeRepeat = stripe.calls.length;
  assert.equal(await normalizeCheckoutPresentation(rows, stripe.client), 0);
  assert.equal(stripe.calls.length, callsBeforeRepeat);
  assert.equal(stripe.calls.some(c => c[0] === 'price.create' || c[0] === 'product.create'), false);
});

test('subsequent admin marketing edits cannot restore long checkout descriptions or replace images', async t => {
  const { db } = checkoutDb(t); const stripe = stripeCatalogue();
  stripe.products.get('prod_gingercrush').images = ['https://nais.example/ginger.png'];
  await updateAdminProduct(db, 'ginger-crush', { description: 'Long storefront marketing copy' }, () => stripe.client);
  assert.equal(stripe.products.get('prod_gingercrush').description, 'Pack 16');
  assert.deepEqual(stripe.products.get('prod_gingercrush').images, ['https://nais.example/ginger.png']);
});

test('missing or mismatched price mapping fails before any Product writes', async () => {
  for (const priceCents of [1, 3600]) {
    const stripe = stripeCatalogue();
    const rows = [{ id: 'orange-spritz', name: 'Orange', status: 'active',
      stripePriceId: priceCents === 1 ? 'price_orangeFixture' : 'price_missing', priceCents, currency: 'eur' }];
    await assert.rejects(normalizeCheckoutPresentation(rows, stripe.client));
    assert.equal(stripe.calls.length, 0);
  }
});

test('a later invalid mapping prevents writes to previously validated Products', async t => {
  const { sqlite } = checkoutDb(t); const stripe = stripeCatalogue();
  const rows = sqlite.prepare(`SELECT id,name,status,stripe_product_id AS stripeProductId,
    stripe_price_id AS stripePriceId,price_cents AS priceCents,currency FROM products WHERE status='active'`).all();
  assert.ok(rows.length > 1);
  rows[rows.length - 1].stripePriceId = 'price_missing';
  await assert.rejects(normalizeCheckoutPresentation(rows, stripe.client));
  assert.equal(stripe.calls.length, 0);
});

test('dry run validates every active mapping without any Stripe writes or D1 changes', async t => {
  const { sqlite } = checkoutDb(t); const stripe = stripeCatalogue();
  const rows = sqlite.prepare(`SELECT id,name,status,stripe_product_id AS stripeProductId,
    stripe_price_id AS stripePriceId,price_cents AS priceCents,currency FROM products WHERE status='active'`).all();
  const before = sqlite.prepare('SELECT * FROM products').all();
  const checked = [];
  const retrieve = stripe.client.prices.retrieve;
  stripe.client.prices.retrieve = async id => { checked.push(id); return retrieve(id); };
  assert.equal(await normalizeCheckoutPresentation(rows, stripe.client, { dryRun: true }), rows.length);
  assert.deepEqual(checked, rows.map(row => row.stripePriceId));
  assert.deepEqual(stripe.calls, []);
  assert.deepEqual(sqlite.prepare('SELECT * FROM products').all(), before);
});

test('safe diagnostics identify the failing product and stage without leaking provider messages', async t => {
  const { sqlite } = checkoutDb(t); const stripe = stripeCatalogue();
  const rows = sqlite.prepare(`SELECT id,name,status,stripe_product_id AS stripeProductId,
    stripe_price_id AS stripePriceId,price_cents AS priceCents,currency FROM products WHERE status='active'`).all();
  rows[0].priceCents += 1;
  await assert.rejects(normalizeCheckoutPresentation(rows, stripe.client, { dryRun: true }), error => {
    assert.deepEqual(normalizationDiagnostic(error, ''), { step: 'stripe_price_validation', code: 'price_amount_mismatch', productId: rows[0].id });
    return true;
  });
  rows[0].priceCents -= 1;
  stripe.client.prices.retrieve = async () => { throw Object.assign(new Error('Authorization: Bearer SECRET recipient@example.com'), { code: 'resource_missing' }); };
  await assert.rejects(normalizeCheckoutPresentation(rows, stripe.client, { dryRun: true }), error => {
    const diagnostic = normalizationDiagnostic(error, '');
    assert.deepEqual(diagnostic, { step: 'stripe_price_lookup', code: 'resource_missing', productId: rows[0].id });
    assert.doesNotMatch(JSON.stringify(diagnostic), /SECRET|Authorization|recipient/);
    return true;
  });
  assert.deepEqual(normalizationDiagnostic({ code: 'SECRET', type: 'SECRET', message: 'SECRET' }, 'stripe_client_initialization'),
    { step: 'stripe_client_initialization', code: 'unexpected_error' });
  assert.deepEqual(stripe.calls, []);
});
