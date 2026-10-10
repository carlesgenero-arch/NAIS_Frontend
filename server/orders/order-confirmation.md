# Order confirmation delivery

After a verified paid Checkout Session has been committed (order and all items),
the webhook calls `confirmOrderEmail`. Duplicate webhooks can also visit this
service without refetching Stripe. Only a D1 paid order can be claimed.

Migration `0006_order_confirmation.sql` adds status and nullable sent timestamp.
Existing orders become `skipped` to prevent historical replay from sending a backlog.
New orders default to `pending`.

One atomic conditional UPDATE claims `pending -> sending`. Only the winner may
send. The service reads the persisted snapshot, renders HTML-escaped Catalan HTML
and plain text, then calls the shared `sendEmail`. It never reads current products.
The email includes branding, name, order number, item quantities/unit/line amounts,
subtotal, shipping, discount, tax, paid total/currency and shipping address.
No internal D1/Stripe IDs are included (the public order number is included).

Provider acceptance sets `sent` and a UTC timestamp; this is not proof of inbox
delivery. Missing email/configuration or failed sending sets `failed`. A missing
Stripe customer email is stored as an empty string to preserve the paid order
under the existing NOT NULL schema. No other checkout/payment rules change.

Mail errors do not roll back the order or turn a successful order webhook into an
error. No automatic retry loop, public resend API, or additional logging exists.

## Recovery boundary

This provides at-most-one automatic attempt, not exactly-once external delivery.
If the process stops after claiming, or Resend accepts but the final D1 update
fails, the row remains `sending`. If an HTTP timeout is ambiguous it can be marked
`failed` even though Resend accepted the message. Never reset these blindly.
A future retry mechanism must reconcile provider acceptance and implement durable
provider idempotency before resending. Failed/pending/sending rows remain in D1;
no recovery UI or scheduled retry is implemented here.

## Production rollout (manual)

1. Verify Resend's sending domain and Production `RESEND_API_KEY`, `EMAIL_FROM`,
   optional `EMAIL_REPLY_TO`. `EMAIL_TEST_TO` is only for the smoke-test endpoint.
   Do not use the restricted Resend dev sender for real customer confirmations.
2. Authenticate with `npx wrangler login` if needed. Review pending migrations:
   `npx wrangler d1 migrations list nais-promo-production --remote`.
3. Ensure previously deployed migrations 0001–0005 are recorded as applied; then
   run `npx wrangler d1 migrations apply nais-promo-production --remote`.
   This applies all pending migrations, including 0006: review that list first.
   Apply before deploying the code. No remote migration was run by this task.
4. Deploy the code through the existing Pages Git workflow. Do not change webhook
   URL, signature verification, or Stripe mode to test this feature.
5. In a matching Stripe test-mode environment with a test D1 database, complete a
   checkout with a controlled inbox. Check webhook 200, persisted paid order and
   one NAIS confirmation. Never mix live prices/keys with test-mode sessions.
   Only make a real production payment if explicitly intended.
6. Inspect minimal state (no PII):

   ```sh
   npx wrangler d1 execute nais-promo-production --remote --command "SELECT order_number, confirmation_email_status, confirmation_email_sent_at FROM orders ORDER BY created_at DESC LIMIT 5"
   ```

7. Resend the same test webhook from Stripe. Confirm no second email. In the test
   environment simulate provider failure: order stays paid, webhook 200, state
   failed; replay must not send again. Avoid altering production credentials for
   a failure test.

Before fulfillment emails, add independent event-specific delivery state and
the same atomic claim principle; do not reuse confirmation status as a shipment
notification flag. Plan reconciliation/idempotent retry separately.
