import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { CHECKOUT_PACK_DESCRIPTION } from './checkout-presentation.ts';
import { createStripeClient } from './stripe-client.ts';

/** One-off repair for existing Stripe Products. Never creates Products/Prices or writes D1. */
export async function normalizeCheckoutPresentation(rows, client) {
  // Resolve and validate every mapping before making any presentation writes.
  const updates = [];
  const seen = new Set();
  for (const row of rows) {
    if (row.status !== 'active') continue;
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || !row.name.trim()
      || !Number.isSafeInteger(row.priceCents) || row.priceCents <= 0 || row.currency !== 'eur'
      || typeof row.stripePriceId !== 'string' || !/^price_[a-zA-Z0-9]+$/.test(row.stripePriceId)) {
      throw new Error('Invalid catalogue configuration');
    }
    const price = await client.prices.retrieve(row.stripePriceId);
    if (!price.active || price.type !== 'one_time' || price.billing_scheme !== 'per_unit'
      || price.id !== row.stripePriceId || price.unit_amount !== row.priceCents
      || price.currency !== row.currency) throw new Error('Invalid Stripe configuration');
    const id = typeof price.product === 'string' ? price.product : price.product?.id;
    if (!id || seen.has(id)) throw new Error('Ambiguous Stripe mapping');
    seen.add(id);
    const product = await client.products.retrieve(id);
    if (product.deleted || !product.active || product.id !== id
      || (product.metadata.nais_product_id && product.metadata.nais_product_id !== row.id)
      || (row.stripeProductId && row.stripeProductId !== id)) throw new Error('Invalid Stripe mapping');
    updates.push({ id, name: row.name });
  }
  for (const product of updates) {
    // Omit images explicitly: retain the existing Stripe imagery, including an empty image list.
    await client.products.update(product.id, { name: product.name, description: CHECKOUT_PACK_DESCRIPTION });
  }
  return updates.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || !args.includes('--apply')
      || args.filter(arg => arg === '--local' || arg === '--remote').length !== 1) {
      throw new Error('Explicit target required');
    }
    const client = createStripeClient({ STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY });
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const output = execFileSync(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
      'd1', 'execute', 'PROMO_DB', args.includes('--remote') ? '--remote' : '--local', '--json', '--command',
      `SELECT id, name, status, stripe_product_id AS stripeProductId, stripe_price_id AS stripePriceId,
        price_cents AS priceCents, currency FROM products WHERE status='active' ORDER BY id`],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const result = JSON.parse(output);
    if (!Array.isArray(result) || !result.length || result.some(part => !part.success || !Array.isArray(part.results))) {
      throw new Error('Catalogue unavailable');
    }
    const count = await normalizeCheckoutPresentation(result.flatMap(part => part.results), client);
    console.log(`Updated checkout presentation for ${count} active products.`);
  } catch {
    console.error('Checkout presentation synchronization failed. Check configuration and retry safely.');
    process.exitCode = 1;
  }
}
