# Promotional email registration (Pages Functions + D1)

POST /api/promo-signup accepts only JSON {"email":"user@example.com"} (maximum 2048 bytes).
Emails are trimmed, lowercased and validated. Alias dots/+tags are not rewritten.
201 registered grants one durable pending promotion entitlement; 200 already_registered does not grant another.
400 invalid_email/invalid_payload, 415 invalid_payload, 403 forbidden, 405 method_not_allowed,
and 503 unavailable contain no personal data or database details. Responses are never cached.

The D1 primary key and INSERT ... ON CONFLICT DO NOTHING make registration atomic.
Do not replace this with a separate read then write, or eventually consistent KV.
The only personal data stored is normalized email. created_at and delivery_status support later delivery.
This checks prior promotion registration, not purchase history or email ownership.

## Cloudflare setup required before this works online

1. In Cloudflare D1, create a database (for example nais-promotions).
2. Apply migrations/0001_promo_signups.sql to that database using its SQL console,
   or Wrangler D1 execute with --remote --file=migrations/0001_promo_signups.sql.
3. In the existing Pages project's Settings / Bindings, bind that database as PROMO_DB.
   Use a separate database for Preview; apply the migration there too.
4. After reviewing changes, deploy through the existing Pages Git integration.
   Keep ng build and dist/nais_frontend/browser. functions/ belongs at repository root,
   not in public/ or the Angular browser bundle. No database IDs/credentials go into Angular.
5. Verify POST responses and confirm only one database row exists for duplicate submissions.

No remote database, binding or deployment was created by this change. Missing binding fails closed (503).
No Wrangler configuration or new dependency is required for the current dashboard-managed Pages project.
The existing _redirects does not match /api/promo-signup. Pages generates function invocation routes.
Function response headers are set by the handler; static _headers do not apply to Functions.
ng serve alone does not provide this API: use a Pages preview/local Pages Functions runtime for integration.

## Delivery remains pending

No promotional code is generated and no email is sent. The popup explicitly says delivery is pending.
After delivery is implemented, replace that message with the normal check-your-email confirmation.
Use the existing pending row as the durable work item. A future sender must claim work atomically,
use a stable provider idempotency key and retry failed delivery without granting a second entitlement.
Do not issue a new code on duplicate API requests or treat an uncertain network response as a new registration.
Actual fulfillment, provider configuration, verified sending domain and delivery retries remain to implement.
Before public rollout, review rate limiting/abuse controls and the existing privacy copy for email retention.

## Local validation

- npm run test:promo (Node 24, built-in test runner and SQLite; tests actual migration/SQL)
- npm run check:server
- npm test -- --watch=false --include=src/app/features/components/promotion/promotion.spec.ts --include=src/app/services/promo-signup.service.spec.ts
- npm run build

References: https://developers.cloudflare.com/pages/functions/bindings/
and https://developers.cloudflare.com/d1/worker-api/prepared-statements/
