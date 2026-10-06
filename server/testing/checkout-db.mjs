import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export const priceIds = {
  'orange-spritz': 'price_orangeFixture', 'passion-hugo': 'price_passionFixture',
  'ginger-crush': 'price_gingerFixture', 'tropical-hops': 'price_tropicalFixture', 'pack-variat': 'price_packFixture',
};

export function checkoutDb(t, prices = priceIds) {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0004_products.sql', '0005_seed_products.sql']) {
    sqlite.exec(readFileSync(new URL('../../migrations/' + file, import.meta.url), 'utf8'));
  }
  for (const [id, price] of Object.entries(prices)) {
    sqlite.prepare('UPDATE products SET stripe_price_id=? WHERE id=?').run(price, id);
  }
  t.after(() => sqlite.close());
  const db = { prepare(sql) { return {
    values: [], bind(...values) { this.values = values; return this; },
    async first() { return sqlite.prepare(sql).get(...this.values) ?? null; },
    async all() { return { success: true, results: sqlite.prepare(sql).all(...this.values) }; },
  }; } };
  return { db, sqlite };
}

export function stripePrice(id) {
  return { id, active: true, type: 'one_time', billing_scheme: 'per_unit', unit_amount: 3600, currency: 'eur' };
}
