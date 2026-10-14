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
then updates only Stripe Product names/descriptions. It does not write D1,
change images/metadata, create Products/Prices or change money, shipping or discounts.
It prints only a count or a generic failure. Re-running is safe if interrupted.
Inactive products are not touched.

Afterward create a new Checkout Session (existing open sessions can retain their
previous presentation). Verify each active product shows its name, `Pack 16`,
quantity, original Price amount and existing image when present.
