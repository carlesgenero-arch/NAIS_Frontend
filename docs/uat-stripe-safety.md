# UAT Stripe TEST-mode safety

Set the server-side Cloudflare Pages **Preview** variable `NAIS_ENVIRONMENT=uat`.
Use `STRIPE_SECRET_KEY` from the intended TEST account/sandbox and the UAT webhook
endpoint's own `STRIPE_WEBHOOK_SECRET`. Redeploy Preview after changing bindings.
Do not set this opt-in on Production; an absent indicator preserves existing behavior.
The indicator comes only from trusted environment bindings, never request data.

UAT requires a nonempty `sk_test_` credential before constructing a Stripe client.
Every supported Product, Price, Coupon, Promotion Code and Checkout Session SDK
response must explicitly report `livemode=false`. Lists validate each member;
expanded mode-bearing objects are checked too. Missing proof fails closed.
Signed webhook events also require TEST mode before persistence, including replay.
Errors remain generic and never include credentials or provider payloads.

This protects checkout, admin synchronization/price updates/cleanup, promotion
creation and webhooks through a shared server-only Stripe boundary. It does not
change D1 schema, pricing, shipping, auth or payment truth. Public verification
continues to read persisted order state; it makes no Stripe calls.

## Limits

This opt-in must actually be configured in Preview. Omitting it retains the old
behavior; no hostname inference is used. This is a TEST/LIVE guard, not ownership
isolation: other compatible TEST sessions in a shared Stripe account can still
reach the UAT webhook. Dedicated UAT Products/Prices and a separate sandbox or
session-ownership policy remain necessary for complete environment isolation.
No Stripe/D1 resources are provisioned or changed by adding this guard.
