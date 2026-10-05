# Public checkout-session lookup

`GET /api/orders/checkout-session/:sessionId` returns only the public order summary after a webhook has stored an order in D1. It uses the existing `PROMO_DB` binding; no migration or Stripe API call is needed. A valid but unknown session returns 404/pending, invalid input 400, storage failure 503. Responses are private/no-store and expose no customer fields or internal identifiers.

This guest flow treats the complete, unguessable Stripe Checkout Session ID as a bearer reference, not as proof of payment or authenticated customer identity. Anyone given that full reference can view the minimal purchase summary. There is no lookup by order number, database ID or email, no listing endpoint and no cross-origin browser access. Do not publish/log full session URLs or add customer data to this response without stronger authorization.

The success page only confirms payment for a validated backend response with `paymentStatus: paid`. Missing/invalid references, pending orders, errors and non-paid statuses never clear the cart. A pending order requires reloading the page after webhook processing; no automatic polling is included.

Cart clearing uses an acknowledgement flag under `nais.checkout.cleared.<orderNumber>` in localStorage. It stores no customer data or Stripe/session identifiers. Existing cart entries remain IDs and quantities only. The flag prevents later refreshes from clearing a newly filled cart for the same order. If storage is unavailable or the cart changed while awaiting the response (including a different persisted cart from another tab), the cart is preserved. Flags are UI state, not payment evidence. Clearing browser storage also removes these acknowledgements.

Local Angular requests for `/api/orders/**` are proxied to the existing Pages development server on port 8788. Checkout creation, webhook handling, cancellation and D1 schema are unchanged.
