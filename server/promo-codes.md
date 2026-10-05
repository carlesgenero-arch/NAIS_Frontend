# Promotion code setup

Apply `migrations/0002_promo_codes.sql` to the existing PROMO_DB database before deploying this handler. It preserves existing registrations; it does not backfill codes for old emails.

Configure server-only `STRIPE_SECRET_KEY` and `STRIPE_PROMO_COUPON_ID` in the Pages environment. The coupon must already exist, be valid, give 10% off, and belong to the same Stripe account and mode as the key. No new coupon is created.

D1 reserves each normalized email atomically. Only the winning request asks Stripe to generate a code, with one redemption and `first_time_transaction` enabled. Stripe enforces that restriction against its customer/payment history; it is not proof of first purchase by a unique person or ownership of the signup email. The code is not bound to a Stripe Customer.

Success requires both Stripe creation and D1 persistence. `delivery_status` remains `pending`; no email is sent. Future delivery must require non-null `stripe_promotion_code_id` and `promotion_code`, not just a pending delivery status.

Stripe and D1 cannot share a transaction. On failure the email reservation is retained and subsequent submissions cannot generate another code. A pending/incomplete new registration returns generic HTTP 503. Completed and legacy registrations return `already_registered`.

Incomplete registrations require operator reconciliation, not deletion/resubmission. The persisted `promotion_request_id` is included as Stripe metadata and as the SDK idempotency key. Find any existing Stripe code using that correlation and restore its ID/code in D1 only after checking the coupon and restrictions. Do not blindly retry creation: Stripe idempotency retention is finite. Automatic recovery and delivery are outside this change.
