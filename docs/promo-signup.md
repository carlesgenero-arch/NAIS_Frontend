# Promotional email registration (Pages Functions + D1)

POST /api/promo-signup accepts only JSON {"email":"user@example.com"} (maximum 2048 bytes).
Emails are trimmed, lowercased and validated. Alias dots/+tags are not rewritten.
201 registered means the unique promotion code was persisted and its email accepted by the provider; 200 already_registered does not generate or send another.
400 invalid_email/invalid_payload, 415 invalid_payload, 403 forbidden, 405 method_not_allowed,
and 503 unavailable contain no personal data or database details. Responses are never cached.

The D1 primary key and INSERT ... ON CONFLICT DO NOTHING make registration atomic.
Do not replace this with a separate read then write, or eventually consistent KV.
The only personal data stored is normalized email. created_at and delivery_status support later delivery.
This checks prior promotion registration, not purchase history or email ownership.

## Cloudflare setup and delivery

Use the existing PROMO_DB database, nais-promo-production. Apply migration 0008
before deploying. See [promotion setup and recovery](../server/promotions/promo-codes.md)
for required Stripe/Resend bindings, exact migration commands, production tests
and delivery failure semantics. Do not create another database.

The persisted code is emailed through the shared server email service. Delivery
moves pending -> sending -> sent/failed with an atomic claim. Duplicates never
send again. Failed and interrupted operations require controlled reconciliation;
there is no automatic retry or manual resend UI in this phase. Provider
acceptance does not guarantee inbox delivery.

## Local validation

- npm run test:promo (Node 24, built-in test runner and SQLite; tests actual migration/SQL)
- npm run check:server
- npm test -- --watch=false --include=src/app/features/components/promotion/promotion.spec.ts --include=src/app/services/promo-signup.service.spec.ts
- npm run build

References: https://developers.cloudflare.com/pages/functions/bindings/
and https://developers.cloudflare.com/d1/worker-api/prepared-statements/
