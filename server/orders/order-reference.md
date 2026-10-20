# Human-readable order references

Apply `0014_order_reference.sql` after 0013, before deploying the read projections.
No remote migration is applied by the code or tests.

New order reference: NAIS-YYYY-NNNN, with at least four sequence digits (10000 is
not truncated). YYYY is the UTC year of the stored, verified paid_at snapshot.
Late webhook delivery across New Year therefore uses the original payment year.
The counter is per database/year, not per Worker or browser. References are for
communication only: they are predictable and are never authentication tokens.

The additive migration creates nullable orders.order_reference, its unique index,
order_reference_counters and an AFTER INSERT trigger. SQLite's serialized writes
and atomic counter UPSERT allocate the reference inside the existing D1 batch.
Only actual new orders run the trigger. Duplicate Checkout Sessions do not consume
a counter, and a failed batch rolls the order, items, counter and reference back.
No SELECT MAX, remote numbering call, browser generation or new dependency.
Do not manually alter references/counters or reuse numbers after deleting orders.

Existing orders are left with NULL order_reference. All old UUID IDs, order_number,
Stripe identifiers, snapshots and webhook constraints remain unchanged. Public and
admin orderNumber remains the compatible display field: COALESCE(order_reference,
order_number). Confirmation/internal templates receive the same fallback through
their snapshot projection; shipping uses the admin projection. Thus admin list,
detail, success page and all three emails use the short reference without changing
routes, cart acknowledgement logic or frontend production components.

The current admin supports limit/cursor pagination, not order-number search. Its
UUID detail routes and cursor ordering remain unchanged; original order_number
remains available internally in D1. Any future reference search must be admin-only.

Deployment: reconcile previous migration drift first. Review `npx wrangler d1
migrations list nais-promo-production --remote`, apply only the reviewed pending
migrations in order, then deploy. Check Preview/Production database bindings
separately; a shared database needs only one migration run. Migration 0014 also
works with the previous application writer, so apply schema before read code.

Verify PRAGMA table_info('orders'), index orders_order_reference, table
order_reference_counters and trigger orders_assign_reference. Use Stripe TEST to
create two orders: references should advance; replay a webhook and verify no new
reference/counter increment. Check admin list/detail, success and the three emails.
Historical orders should retain their original displayed number. Verify on D1/
Cloudflare test deployment in addition to local SQLite tests; do not use LIVE data.
