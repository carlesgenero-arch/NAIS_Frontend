# Shipping confirmation

Only the successful conditional `preparing -> shipped` mutation calls
`sendShippingEmail`, using the historical D1 admin order snapshot. No catalogue
lookup or delivered/cancelled/preparing/pending email is performed.

Migration 0007 adds independent shipping_email_status and shipping_email_sent_at.
New orders and existing pending/preparing orders default to pending; historical
shipped/delivered/cancelled orders are skipped. Confirmation email state is untouched.

An atomic pending -> sending claim allows at most one automatic attempt. Fulfillment
concurrency checks still reject stale/repeated transitions. Provider acceptance
marks sent with UTC timestamp; this means accepted, not proven inbox delivery.
Failure marks failed; missing customer email marks skipped. Both produce a safe
shippingEmailWarning on the successful mutation response. Angular displays the
updated shipped state and a non-destructive status message, never a failed shipment.

No automatic retries. Crash or final D1 write failure can leave sending reserved.
Timeouts can be ambiguous: do not reset failed/sending blindly. A future recovery
mechanism must reconcile provider acceptance before resending. Errors never revert
fulfillment, expose provider details, or log personal data.

## Manual rollout

1. Keep existing Production RESEND_API_KEY, verified EMAIL_FROM and optional
   EMAIL_REPLY_TO. No new email variables are required.
2. From the repository run `npx wrangler login` if needed, then
   `npx wrangler d1 migrations list nais-promo-production --remote`.
3. Review all pending migrations; ensure 0001–0006 are already applied. Run
   `npx wrangler d1 migrations apply nais-promo-production --remote` before deploying.
   This applies all pending migrations, not only 0007. No remote changes were
   performed during implementation.
4. Deploy through the existing Pages Git workflow. Use a controlled test order/inbox
   in a test environment first. In the protected admin, change pending -> preparing:
   no email. Then preparing -> shipped: one shipping email and updated shipped UI.
5. Inspect only minimal state:

   ```sh
   npx wrangler d1 execute nais-promo-production --remote --command "SELECT order_number, fulfillment_status, shipping_email_status, shipping_email_sent_at FROM orders ORDER BY created_at DESC LIMIT 5"
   ```

6. Repeating the same PATCH must return 409 and send nothing; concurrent requests
   have one successful transition. Change shipped -> delivered: no additional email.
   Cancellation of a separate pending/preparing test order sends nothing.
7. Test provider failure only in the test environment: shipment stays shipped,
   email status failed, and the admin sees the warning. Missing email is skipped.
   Do not change production credentials to simulate an error.

Before promo email integration, define its independent persistent delivery claim
and recovery policy. Never reuse shipping or order-confirmation state for promos.
