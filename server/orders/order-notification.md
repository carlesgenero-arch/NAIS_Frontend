# Internal paid-order notification

Apply `0013_order_notification.sql` before deploying the webhook change. It adds
`orders.notification_email_status` (pending/sending/sent/failed/skipped) and
`notification_email_sent_at`. Existing orders are skipped to prevent a backlog.

Set server-only `ORDER_NOTIFICATION_EMAIL=comandes@naisdrinks.com` in each intended
Cloudflare Pages environment. Keep existing RESEND_API_KEY, EMAIL_FROM and optional
EMAIL_REPLY_TO. Redeploy after binding changes. No Angular configuration is needed.
The mailbox receives customer contact/address data: restrict mailbox access and
apply the business retention policy. No provider IDs or bodies are logged.

After verified payment and transactional D1 persistence, the webhook separately
attempts customer confirmation and internal notification using sendEmail. Both new
and duplicate events may reach the notification service, but an atomic paid +
pending -> sending UPDATE grants only one sender. Snapshot content comes from D1.
Missing recipient/provider configuration and send/read failures become failed;
provider acceptance records sent + timestamp. All failures preserve webhook success
and the paid order. Provider acceptance is not proof of inbox delivery.

No automatic retries, queue, resend endpoint or UI are introduced. Failed rows
remain available for a future controlled retry mechanism. Never reset sending
blindly: provider acceptance followed by a state-write failure is ambiguous and
must be reconciled first. Exactly-once delivery across D1/provider is not guaranteed;
the claim deliberately favors avoiding duplicate sends over automatic recovery.

Test on an Access-protected/test deployment with Stripe TEST, synthetic customer
information and a controlled internal mailbox. Complete one payment, verify one
customer email and one internal email, then replay the signed webhook: neither
should duplicate. Verify notification state in D1 without selecting customer data.
