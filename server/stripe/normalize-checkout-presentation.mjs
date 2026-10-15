import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { CHECKOUT_PACK_DESCRIPTION } from './checkout-presentation.ts';
import { createStripeClient } from './stripe-client.ts';

class NormalizationError extends Error {
  constructor(step, code, productId) {
    super(code);
    this.step = step;
    this.code = code;
    // Only internal catalogue IDs, never provider messages, payloads or headers.
    this.productId = typeof productId === 'string' && /^[a-z0-9-]{1,100}$/.test(productId) ? productId : undefined;
  }
}

export function normalizationDiagnostic(error, step) {
  if (error instanceof NormalizationError) return { step: error.step, code: error.code,
    ...(error.productId ? { productId: error.productId } : {}) };
  const codes = ['resource_missing', 'api_key_expired', 'invalid_api_key', 'rate_limit',
    'StripeAuthenticationError', 'StripePermissionError', 'StripeConnectionError', 'StripeAPIError',
    'StripeInvalidRequestError', 'StripeRateLimitError', 'ENOENT', 'EACCES', 'EPERM'];
  const code = codes.includes(error?.code) ? error.code : codes.includes(error?.type) ? error.type : 'unexpected_error';
  return { step, code };
}

/** One-off repair for existing Stripe Products. Never creates Products/Prices or writes D1. */
export async function normalizeCheckoutPresentation(rows, client, { dryRun = false } = {}) {
  // Resolve and validate every mapping before making any presentation writes.
  const updates = [];
  const seen = new Set();
  for (const row of rows) {
    if (row.status !== 'active') continue;
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || !row.name.trim()
      || !Number.isSafeInteger(row.priceCents) || row.priceCents <= 0 || row.currency !== 'eur'
      || typeof row.stripePriceId !== 'string' || !/^price_[a-zA-Z0-9]+$/.test(row.stripePriceId)) {
      throw new NormalizationError('catalogue_validation', 'invalid_catalogue_row', row.id);
    }
    let price;
    try { price = await client.prices.retrieve(row.stripePriceId); }
    catch (error) { throw new NormalizationError('stripe_price_lookup', normalizationDiagnostic(error, '').code, row.id); }
    if (!price.active || price.type !== 'one_time' || price.billing_scheme !== 'per_unit'
      || price.id !== row.stripePriceId || price.unit_amount !== row.priceCents
      || price.currency !== row.currency) throw new NormalizationError('stripe_price_validation',
        price.unit_amount !== row.priceCents ? 'price_amount_mismatch' : price.currency !== row.currency
          ? 'price_currency_mismatch' : 'invalid_stripe_price', row.id);
    const id = typeof price.product === 'string' ? price.product : price.product?.id;
    if (!id || seen.has(id)) throw new NormalizationError('stripe_mapping_validation', 'ambiguous_stripe_mapping', row.id);
    seen.add(id);
    let product;
    try { product = await client.products.retrieve(id); }
    catch (error) { throw new NormalizationError('stripe_product_lookup', normalizationDiagnostic(error, '').code, row.id); }
    if (product.deleted || !product.active || product.id !== id
      || (product.metadata.nais_product_id && product.metadata.nais_product_id !== row.id)
      || (row.stripeProductId && row.stripeProductId !== id)) throw new NormalizationError('stripe_product_validation', 'invalid_stripe_product_mapping', row.id);
    if (product.description !== CHECKOUT_PACK_DESCRIPTION) updates.push({ id });
  }
  if (dryRun) return updates.length;
  for (const product of updates) {
    // Update description only; preserve names, images and all payment configuration.
    try { await client.products.update(product.id, { description: CHECKOUT_PACK_DESCRIPTION }); }
    catch (error) { throw new NormalizationError('stripe_description_update', normalizationDiagnostic(error, '').code); }
  }
  return updates.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let step = 'arguments';
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args.filter(arg => arg === '--apply' || arg === '--dry-run').length !== 1
      || args.filter(arg => arg === '--local' || arg === '--remote').length !== 1) {
      throw new NormalizationError(step, 'use_explicit_target_and_apply_or_dry_run');
    }
    step = 'stripe_client_initialization';
    if (!process.env.STRIPE_SECRET_KEY?.trim()) throw new NormalizationError(step, 'stripe_secret_key_missing');
    const client = createStripeClient({ STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY });
    const root = fileURLToPath(new URL('../../', import.meta.url));
    step = 'd1_lookup';
    let output;
    try { output = execFileSync(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
      'd1', 'execute', 'PROMO_DB', args.includes('--remote') ? '--remote' : '--local', '--json', '--command',
      `SELECT id, name, status, stripe_product_id AS stripeProductId, stripe_price_id AS stripePriceId,
        price_cents AS priceCents, currency FROM products WHERE status='active' ORDER BY id`],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) {
      // Inspect captured CLI output privately; never print it (it can contain credentials).
      const captured = String(error.stdout ?? '') + String(error.stderr ?? '');
      const code = /necessary to set a CLOUDFLARE_API_TOKEN/i.test(captured) ? 'cloudflare_auth_required'
        : /Authentication error|Could not authenticate|code: 10000/i.test(captured) ? 'cloudflare_auth_failed'
        : /Cannot read directory|Acceso denegado|EPERM|EACCES/i.test(captured) ? 'local_filesystem_access_denied'
        : 'wrangler_command_failed';
      throw new NormalizationError(step, code);
    }
    step = 'd1_response_validation';
    const result = JSON.parse(output);
    if (!Array.isArray(result) || !result.length || result.some(part => !part.success || !Array.isArray(part.results))) {
      throw new NormalizationError(step, 'invalid_d1_response');
    }
    step = 'catalogue_validation';
    const dryRun = args.includes('--dry-run');
    const count = await normalizeCheckoutPresentation(result.flatMap(part => part.results), client, { dryRun });
    console.log(dryRun ? `Dry run: ${count} Stripe Product descriptions would change; no writes performed.`
      : `Updated checkout presentation for ${count} active products.`);
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', ...normalizationDiagnostic(error, step) }));
    process.exitCode = 1;
  }
}
