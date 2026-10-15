# Checkout presentation

Hosted Checkout uses the Stripe Product attached to each existing Price. The server
catalogue synchronizer sets its name from D1 and its description to `Pack 16`.
Storefront marketing descriptions remain unchanged in D1. Existing Stripe images
are left intact, including products without images. Checkout still sends only the
server-resolved Price ID and validated quantity; no inline Price is created.

## Normalize existing Stripe Products once

Deploying code alone does not update previously stored Stripe descriptions.
From the repository root, with Wrangler authenticated and `STRIPE_SECRET_KEY`
securely available in the current process environment, run:

```sh
node server/stripe/normalize-checkout-presentation.mjs --remote --apply
```

Use the Stripe key for the same account/mode as the Prices in production D1.
For local D1/test Stripe resources use `--local --apply` instead. The database
target must always be explicit. Never commit or paste the secret into this file.

The tool reads active products from D1, verifies every mapped Price and Product,
then updates only Stripe Product descriptions; existing names are preserved. It does not write D1,
change images/metadata, create Products/Prices or change money, shipping or discounts.
Already normalized Products are skipped. It prints a count or a safe diagnostic
containing only step, code and optionally the internal catalogue product ID.
Provider messages, headers, secrets and subprocess output are never printed. Re-running is safe if interrupted.
Inactive products are not touched.

Afterward create a new Checkout Session (existing open sessions can retain their
previous presentation). Verify each active product shows its name, `Pack 16`,
quantity, original Price amount and existing image when present.

## Read-only diagnosis

Run first, without making Stripe or D1 writes:

```sh
node server/stripe/normalize-checkout-presentation.mjs --remote --dry-run
```

The script reads `STRIPE_SECRET_KEY` from the invoking shell, not automatically
from `.dev.vars`. Wrangler separately requires Cloudflare authentication (local
`npx wrangler login`, or an appropriately scoped `CLOUDFLARE_API_TOKEN` and
account selection). `--remote` queries production D1 through binding `PROMO_DB`
in `wrangler.toml` before any Stripe API reads. Stripe key account/mode must match
those Prices. Remote Cloudflare bindings do not inject secrets into this Node process.
The database lookup runs from the repository root derived from the script URL,
regardless of the invoking working directory. Module-type warnings are unrelated.

Diagnostic stages distinguish initialization, D1 lookup/response, individual
Stripe Price/Product lookups and mapping validation. `cloudflare_auth_required`
means Wrangler cannot authenticate; `resource_missing` during a Stripe lookup can
indicate an account/test/live mismatch. A dry run validates every active mapping,
even when its Product already has the desired description.
