# Stripe order webhook

`POST /api/stripe-webhook` uses `STRIPE_WEBHOOK_SECRET` to verify the original UTF-8 request body, with Stripe's default timestamp tolerance and Web Crypto. No browser origin/CORS permission is required for a Stripe server request.

## Deployment

1. Identify the existing database attached to the Pages `PROMO_DB` binding. The repository does not contain its remote name/ID. Do not create a second database.
2. From the repository run `npx wrangler login` if needed, then `npx wrangler d1 list` to find that database.
3. Apply only this new migration to that database:

   ```sh
   npx wrangler d1 execute <EXISTING_PROMO_DB_DATABASE_NAME> --remote --file=migrations/0003_orders.sql
   ```

   Replace the angle-bracket placeholder with the database's actual name, not the binding name unless they happen to match. Apply once; do not reset tables or rerun raw SQL after success.
4. Deploy the Pages Function. In Stripe create an endpoint at `https://naisdrinks.com/api/stripe-webhook`, subscribed to `checkout.session.completed`. Configure the endpoint signing secret as the Pages server secret `STRIPE_WEBHOOK_SECRET` and retain the existing `STRIPE_SECRET_KEY` and price bindings, in the same Stripe account/mode. Redeploy after updating bindings. Nothing is deployed automatically by this change.
5. Use separate test data and secrets for previews. Stripe CLI forwarding uses its own signing secret, distinct from the dashboard endpoint's secret.

## Snapshot and idempotency

The handler re-fetches the Session and all line-item pages with the official SDK, requires `mode=payment`, `status=complete`, and `payment_status=paid`, and stores Stripe values in integer minor units. Item names come from Checkout line descriptions, never the Angular catalogue or mutable Product name. Line totals include Stripe's line discounts/taxes. `paid_at` records the signed completion event timestamp (not bank settlement time). Customer and shipping recipient names are stored separately.

Only internal product identity may fall back to the current server Price-ID mapping. To support delayed delivery after rotating price bindings, keep `nais_product_id` metadata on the associated Stripe Products (for example `orange-spritz`). Metadata is server-controlled in Stripe, not supplied by Angular. Old prices without metadata and without a matching binding fail safely for operator correction; their historical amounts are never rebuilt from today's catalogue.

`orders.stripe_checkout_session_id` is unique. A D1 transactional batch inserts the order and its children together. Racing duplicates use a fresh candidate order UUID; children are inserted only if that UUID actually won the parent insert. A retry never updates an existing order snapshot. The first Stripe event ID is retained for traceability, and no raw event/customer payload is logged.

Incomplete/unpaid sessions and unrelated event types are acknowledged without a paid order. Async payment success handling is intentionally deferred; enable it in the event dispatch only when implemented/tested. Failures to fetch or persist return generic 503 so Stripe can retry. Invalid signatures/payloads return generic 400.

No admin UI, confirmation email, Angular changes, cart clearing or fulfillment action is included. Restrict access to the D1 database because order snapshots contain personal data.
