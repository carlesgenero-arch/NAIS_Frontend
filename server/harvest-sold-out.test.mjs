import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkoutDb } from './testing/checkout-db.mjs';
import { onRequest as list } from '../functions/api/products/index.ts';
import { onRequest as detail } from '../functions/api/products/[slug].ts';
import { listAdminProducts } from './catalogue/product.service.ts';
import { validateCheckout } from './checkout/checkout-validation.ts';
import { checkout } from './checkout/checkout-session.ts';
import { updateAdminProduct } from './catalogue/product-write.service.ts';
const migration = readFileSync(new URL('../migrations/0011_harvest_sold_out.sql', import.meta.url), 'utf8');
const cleanupMigration = readFileSync(new URL('../migrations/0012_stripe_price_cleanup.sql', import.meta.url), 'utf8');
const hideHops = readFileSync(new URL('../migrations/0009_hide_tropical_hops.sql', import.meta.url), 'utf8');
const harvest = 'tropical-hops-harvest';

test('migration adds sold-out while preserving every price, mapping, asset and other product', t => {
  const { sqlite } = checkoutDb(t, undefined, { priceCleanup: false });
  sqlite.exec(hideHops);
  const before = sqlite.prepare('SELECT * FROM products ORDER BY id').all();
  sqlite.exec(migration);
  const after = sqlite.prepare('SELECT * FROM products ORDER BY id').all();
  assert.equal(after.length, before.length);
  for (const [i, row] of after.entries()) assert.deepEqual({ ...row }, row.id === harvest
    ? { ...before[i], status: 'sold-out', updated_at: row.updated_at } : { ...before[i] });
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  assert.throws(() => sqlite.prepare("UPDATE products SET status='invalid' WHERE id=?").run(harvest));
  assert.throws(() => sqlite.exec("UPDATE products SET slug='orange-spritz' WHERE id='ginger-crush'"));
  // The migration also preserves its result when replayed in an isolated test database.
  sqlite.exec(migration);
  assert.deepEqual(sqlite.prepare('SELECT * FROM products ORDER BY id').all(), after);
});

test('sold-out Harvest is public in list/detail, retained in admin and not purchasable', async t => {
  const { db, sqlite } = checkoutDb(t, undefined, { priceCleanup: false });
  sqlite.exec(hideHops); sqlite.exec(migration); sqlite.exec(cleanupMigration);
  const context = { request: new Request('https://naisdrinks.com/api/products'), env: { PROMO_DB: db }, params: { slug: harvest } };
  const products = await (await list(context)).json();
  assert.equal(products.find(p => p.id === harvest)?.status, 'sold-out');
  assert.equal(products.some(p => p.id === 'tropical-hops'), false);
  const response = await detail(context);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'sold-out');
  assert.equal((await listAdminProducts(db)).find(p => p.id === harvest)?.status, 'sold-out');
  for (const status of ['sold-out', 'coming-soon', 'draft', 'archived']) {
    sqlite.prepare('UPDATE products SET status=? WHERE id=?').run(status, harvest);
    const rejected = await checkout(new Request('https://naisdrinks.com/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: harvest, quantity: 1 }] }),
    }), context.env, () => { assert.fail('Non-purchasable products must not reach Stripe'); });
    assert.ok(rejected instanceof Response); assert.equal(rejected.status, 400);
  }
  const active = await validateCheckout(new Request('https://naisdrinks.com/api/checkout', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'orange-spritz', quantity: 1 }] }),
  }), context.env);
  assert.equal(active instanceof Response, false);
});

test('admin may edit sold-out metadata without calling Stripe or losing its status', async t => {
  const { db, sqlite } = checkoutDb(t, undefined, { priceCleanup: false }); sqlite.exec(migration); sqlite.exec(cleanupMigration);
  const product = await updateAdminProduct(db, harvest, { name: 'Harvest editorial' }, () => { assert.fail('No Stripe writes for sold-out'); });
  assert.equal(product.status, 'sold-out'); assert.equal(product.name, 'Harvest editorial');
});
