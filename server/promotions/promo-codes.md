# First-order promo code and email

Apply migration `0008_promo_email.sql` before deploying the handler. It rebuilds
only the promo table to extend its CHECK constraint, preserves registrations,
codes, timestamps and unique indexes, and adds nullable `email_sent_at`.
Legacy rows are not sent again; their unknown sent timestamp stays null.

Server-only Pages bindings: `PROMO_DB`, `STRIPE_SECRET_KEY`,
`STRIPE_PROMO_COUPON_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO`.
Use a valid existing 10% Stripe coupon in the same account/mode as Checkout.
No new coupon is created. Use a verified sender domain for production; Resend
sandbox senders/recipients are restricted. Never put these bindings in Angular.

The atomic normalized-email insert selects one winner. Only that winner creates
one Stripe-generated Promotion Code with `max_redemptions: 1` and
`first_time_transaction: true`, using the stored request UUID for Stripe
idempotency and metadata. Stripe enforces first-time eligibility against its
customer/payment history; this is not proof of email ownership or one promotion
per person. Codes are not bound to a Stripe Customer.

After persisting the code, delivery atomically claims pending -> sending, reads
the saved recipient/code, and calls the shared sendEmail service with HTML/text.
Provider acceptance records sent plus a timestamp and returns registered.
Sent means provider accepted, not guaranteed inbox delivery. A failed send
records failed and returns generic unavailable. Every repeated normalized email
returns already_registered without generating or sending again, including failed
and legacy registrations. No codes or Stripe/provider identifiers are returned.

Stripe, D1 and email cannot share a transaction. Interrupted code generation
remains pending with its durable request ID; interrupted/ambiguous delivery may
remain sending. Neither is retried automatically. Before future controlled
recovery, reconcile Stripe by request metadata/idempotency key and verify delivery
state. Never delete a reservation or blindly create a replacement. Stripe's
idempotency retention is finite. A failed delivery with a persisted code must
reuse that code; ambiguous acceptance needs reconciliation before retrying.

## Production (manual only)

1. Back up D1 and review pending migrations:
   `npx wrangler d1 migrations list nais-promo-production --remote`
2. Confirm earlier migrations are applied, then:
   `npx wrangler d1 migrations apply nais-promo-production --remote`
   This applies ALL pending migrations. No remote command was run by this change.
3. In Workers & Pages -> NAIS Pages -> Settings -> Variables and Secrets, configure
   the bindings above for Production. Keep Preview on isolated test resources.
4. Deploy the reviewed commit using the existing Pages Git deployment.
5. Submit a new controlled inbox through the popup: expect registered and the
   check-email message. Confirm the HTML and text email contain one public code.
6. Repeat with capitalization/whitespace: expect already_registered, no new code
   and no new email. Try the code in Stripe test-mode Checkout first (same mode
   as coupon); confirm the 10% discount and single-use/first-transaction rules.
7. Inspect minimal aggregate state without exposing recipients/codes:
   `npx wrangler d1 execute nais-promo-production --remote --command "SELECT delivery_status, count(*) AS signups, count(email_sent_at) AS timestamped FROM promo_signups GROUP BY delivery_status;"`

Before final privacy/security audit, review public signup abuse controls,
consent/privacy copy and retention, sender verification/SPF/DKIM, and controlled
reconciliation for failed or interrupted sends. No resend UI, campaigns or
checkout changes are included.
