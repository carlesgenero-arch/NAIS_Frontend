# Server-only Stripe preparation

There is no /api/checkout endpoint, Session creation, webhook or email sending yet.
Nothing under server/ is imported by Angular. The official stripe package uses its fetch
HTTP client for the Cloudflare runtime. No Stripe.js dependency is needed for hosted redirect.

## Bindings

The existing project uses Cloudflare Pages dashboard configuration (no Wrangler file).
In Pages Settings / Variables and Secrets, add STRIPE_SECRET_KEY as an encrypted secret.
Add STRIPE_PRICE_ORANGE_SPRITZ, STRIPE_PRICE_PASSION_HUGO, STRIPE_PRICE_GINGER_CRUSH,
STRIPE_PRICE_TROPICAL_HOPS, STRIPE_PRICE_PACK_VARIAT and SITE_URL as server runtime variables.
Use test keys/Prices in Preview and live keys/Prices in Production; never mix the modes.
SITE_URL must be the approved site origin (for production, https://naisdrinks.com).
The future endpoint must validate this configured origin and construct fixed return paths;
it must not accept browser success/cancel URLs or derive them from untrusted headers.
PROMO_DB remains unchanged. STRIPE_WEBHOOK_SECRET is reserved for a later phase.

Local: copy .dev.vars.example to .dev.vars and replace its placeholders with test values.
.dev.vars and its environment variants are ignored by Git. No actual credentials are supplied.

## Catalogue and charging

checkout-catalogue.ts maps only five allowed internal IDs to environment binding names.
Unknown/prototype IDs and tropical-hops-harvest cannot resolve. Missing/malformed price
configuration raises a generic error. Real Price IDs are not committed.
Each Stripe Price should be active, one-time, EUR 3600 minor units per box of 16.
The future endpoint must verify configured Stripe Prices match these business rules
(active, currency, unit amount, one-time), and then charge with line_items.price + quantity.
Numeric constants must never replace a Stripe Price ID with browser-supplied price_data.

Future input is strictly {items:[{productId,quantity}]}. Reject additional pricing, currency,
discount, shipping and redirect fields. Validate IDs and integer quantities, merge duplicates
before enforcing the per-product maximum (currently 24 in the cart), and derive totalBoxes
by summing those validated quantities. No payload parser or endpoint is implemented here.

## Shipping and promotion codes

Use exactly one shipping_options entry from checkoutShippingOption(totalBoxes).
Stripe shipping_rate_data creates the fixed shipping rate natively: EUR 600 minor units
for one box, EUR 0 for at least two. Never offer both options for the customer to choose.
Do not enable adjustable quantities in hosted Checkout without revisiting this fixed-rate rule.
Shipping destination countries, address collection and tax treatment must be explicitly
configured during endpoint implementation; no country/tax assumptions are made here.

HOSTED_CHECKOUT_OPTIONS prepares mode: payment and allow_promotion_codes: true.
Stripe calculates the discount and validates the entered code. Do not accept coupon IDs,
discount percentages/amounts or discounts configuration from the browser.
A future 10% promotion must have its eligible customer/first-order and redemption restrictions
configured server-side/in Stripe. Merely enabling the code field does not enforce those rules.
D1 registration alone is not proof of first purchase or email ownership. Do not mint codes yet.
Actual Session creation and idempotency, payment confirmation/webhooks and fulfillment remain later work.

Validation: npm run check:server; npm run test:checkout; npm run build.
Sources: https://docs.stripe.com/payments/checkout/discounts
and https://docs.stripe.com/payments/during-payment/charge-shipping
