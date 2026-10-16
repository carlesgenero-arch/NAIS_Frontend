# Public visibility and purchasability

Public catalogue/list/detail: `active` and `sold-out` only.
Cart and checkout: `active` only. Never infer purchasability from public visibility.
`coming-soon`, `draft` and `archived` remain hidden. This includes Tropical Hops.

Migration `0011_harvest_sold_out.sql` extends the existing products CHECK constraint
by copying every product column into a replacement table, preserving the slug UNIQUE
constraint and status index. It changes only coming-soon Tropical Hops Harvest to
sold-out. Prices, Stripe IDs, images and other product statuses are preserved.
Orders and order_items are not modified; order_items has no foreign key to products.
Historical seed migrations remain unchanged.

Deploy the compatible application first, then apply migrations through the normal
D1 migration workflow. No migration has been applied remotely by this change.

Local: `npm run d1:local:migrate`
Production (manual): `npx wrangler d1 migrations apply PROMO_DB --remote`
Verify Home, Shop and direct Harvest detail show SOLD OUT, adding Harvest fails,
and the checkout API returns 400 for its ID before Stripe is called.
