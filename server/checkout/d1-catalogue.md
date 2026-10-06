# D1 checkout catalogue

Checkout now requires `PROMO_DB` with migrations 0004 and 0005 applied.
Before deploying this change, populate `products.stripe_price_id` for every active
product using the real Price IDs from the existing environment bindings, in the
same Stripe account and test/live mode as `STRIPE_SECRET_KEY`. The seed deliberately
leaves these fields NULL; checkout returns a generic 503 until they are configured.
This change does not apply migrations or update production data.

`price_cents` and `currency` must match the corresponding active, one-time,
per-unit Stripe Price. NAIS currently uses 3600 cents and `eur` per box.
Never store binding names such as `STRIPE_PRICE_ORANGE_SPRITZ` in a Price ID field.
The compatibility map in `server/stripe/legacy-product-bindings.ts` documents which
existing binding belongs to each historical product. Keep these bindings for old
webhook Sessions without metadata; new checkout requests never use this map.
The obsolete hardcoded checkout resolver and fixed product-price constants have
been removed. D1 defines current product availability/prices, checked against Stripe.

Only active D1 products can be purchased. Requests still contain only productId
and quantity. The existing five-line and per-product quantity limits are retained.
Shipping remains 600 cents for one box and free for two or more. Stripe validates
promotion codes and calculates final charged totals.

New Sessions contain a server-written ID/Price mapping in metadata. The verified
webhook uses it for product identity; historical names, quantities and monetary
amounts continue to come exclusively from the retrieved Stripe Session/line items.
Old Sessions retain their previous metadata/binding resolution behavior.
No private catalogue fields are added to the public product API.
