import Stripe from 'stripe';
import { parseEnv } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = join(root, 'node_modules/wrangler/bin/wrangler.js');
const execute = promisify(execFile);
// Setup/legacy binding names only. Runtime checkout still resolves every value from D1.
const bindings = {
  'orange-spritz': 'STRIPE_PRICE_ORANGE_SPRITZ',
  'passion-hugo': 'STRIPE_PRICE_PASSION_HUGO',
  'ginger-crush': 'STRIPE_PRICE_GINGER_CRUSH',
  'pack-variat': 'STRIPE_PRICE_PACK_VARIAT',
};
const selection = `SELECT id,status,price_cents,currency,stripe_price_id FROM products WHERE id IN ('orange-spritz','passion-hugo','ginger-crush','pack-variat')`;

export function localSettings(env) {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith('sk_test_')) throw Error('test_key_required');
  let site;
  try { site = new URL(env.SITE_URL); } catch { throw Error('local_origin_required'); }
  if (site.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(site.hostname)
    || site.port !== '4200' || site.pathname !== '/' || site.search || site.hash || site.username || site.password) {
    throw Error('local_origin_required');
  }
  return { key, origin: site.origin, webhookReady: /^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET ?? '') };
}

export async function prepareLocalCatalogue(env, query, stripe, apply = false) {
  localSettings(env);
  const rows = await query(selection);
  const changes = [];
  // Validate ALL D1 rows and TEST prices before writing any mapping.
  for (const [id, binding] of Object.entries(bindings)) {
    const row = rows.find(product => product.id === id);
    const priceId = env[binding]?.trim();
    if (!row || row.status !== 'active' || !Number.isSafeInteger(row.price_cents) || row.price_cents <= 0
      || row.currency !== 'eur') throw Error('local_catalogue_invalid');
    if (!/^price_[A-Za-z0-9]+$/.test(priceId ?? '')) throw Error('test_price_binding_required');
    let price;
    try { price = await stripe.prices.retrieve(priceId); } catch { throw Error('stripe_test_price_lookup_failed'); }
    const productId = typeof price.product === 'string' ? price.product : price.product?.id;
    if (price.id !== priceId || price.livemode !== false || !price.active || price.type !== 'one_time'
      || price.billing_scheme !== 'per_unit' || price.currency !== row.currency || price.unit_amount !== row.price_cents
      || !/^prod_[A-Za-z0-9]+$/.test(productId ?? '')) throw Error('test_price_mismatch');
    if (row.stripe_price_id !== price.id) {
      changes.push({ id, priceId: price.id });
    }
  }
  if (apply && changes.length) {
    // One local-only SQL statement: no changes to price, currency, status or order snapshots.
    const prices = changes.map(p => `WHEN '${p.id}' THEN '${p.priceId}'`).join(' ');
    const ids = changes.map(p => `'${p.id}'`).join(',');
    await query(`UPDATE products SET stripe_price_id=CASE id ${prices} END WHERE id IN (${ids})`);
  }
  return { productsChecked: Object.keys(bindings).length, mappingsToUpdate: changes.length, applied: apply };
}

async function main() {
  const command = process.argv[2];
  if (!['check', 'sync-prices', 'api', 'limiter'].includes(command) || process.argv.length !== 3) throw Error('invalid_local_command');
  let env;
  try { env = parseEnv(await readFile(join(root, '.dev.vars'), 'utf8')); } catch { throw Error('dev_vars_required'); }
  const settings = localSettings(env);
  const childEnv = { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: join(root, '.wrangler/logs') };
  if (command === 'api' || command === 'limiter') {
    // This guard exists only in the local npm command, never in Pages/production code.
    if (command === 'api' && !settings.webhookReady) console.warn('Local webhook signing secret missing: paid-order verification cannot complete yet.');
    const args = command === 'api'
      ? ['pages', 'dev', 'public', '--local', '--ip', '127.0.0.1', '--port', '8788', '--persist-to', '.wrangler/state']
      : ['dev', '--config', 'wrangler.checkout-rate-limiter.toml', '--local', '--ip', '127.0.0.1', '--port', '8790'];
    const child = spawn(process.execPath, [wrangler, ...args], { cwd: root, env: childEnv, stdio: 'inherit' });
    child.on('error', () => { console.error('Local Pages startup failed.'); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code ?? 1; });
    return;
  }
  const query = async sql => {
    let output;
    try {
      output = await execute(process.execPath, [wrangler, 'd1', 'execute', 'PROMO_DB', '--config', 'wrangler.toml',
        '--local', '--persist-to', '.wrangler/state', '--json', '--command', sql],
        { cwd: root, env: childEnv, maxBuffer: 4 * 1024 * 1024 });
      const result = JSON.parse(output.stdout);
      if (!Array.isArray(result) || result.some(item => item.success !== true)) throw Error();
      return result.flatMap(item => item.results ?? []);
    } catch { throw Error('local_d1_query_failed'); }
  };
  const stripe = new Stripe(settings.key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 0, timeout: 15000 });
  const result = await prepareLocalCatalogue(env, query, stripe, command === 'sync-prices');
  console.log(JSON.stringify({ ...result, webhookConfigured: settings.webhookReady }));
  if (command === 'check' && (result.mappingsToUpdate || !settings.webhookReady)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const safe = new Set(['test_key_required','local_origin_required','local_catalogue_invalid','test_price_binding_required',
      'stripe_test_price_lookup_failed','test_price_mismatch','invalid_local_command','dev_vars_required','local_d1_query_failed']);
    console.error(JSON.stringify({ status: 'unavailable', step: safe.has(error?.message) ? error.message : 'local_setup_failed' }));
    process.exitCode = 1;
  });
}
