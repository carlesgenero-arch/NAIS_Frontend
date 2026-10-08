# NAIS admin authentication foundation

## Choice
Cloudflare Access handles identity and its own session cookie. Use the team's Google/Microsoft identity provider with MFA (recommended), or Access email OTP for a small team. We never store passwords, tokens or authorization state in browser storage. A custom password/session system would add unnecessary credential, recovery and session-management work; an external auth platform is not needed for this scope.

`/admin/login` is an Angular explanatory screen with a full-page link to `/admin`. Access performs login on that navigation. `/admin` is an empty protected shell, with guards for the shell and future children. No products/orders CRUD is present. Public navigation is unchanged; storefront header/footer/promo do not render inside admin.

## Server boundary
Every `/api/admin/*` function runs the directory `_middleware.ts`, including the catch-all. It verifies the Access RS256 signature against the configured team's rotating JWKS, issuer, audience, expiry and required identity claims with jose. It never trusts an email header alone. Only an explicitly allowlisted email gets role `admin`. Future staff permissions need an explicit server authorization rule; they are not implicitly granted today.

Missing/invalid session -> 401. Valid identity not allowlisted -> 403. Missing configuration with a token -> 503. All failures are generic and uncached. No local bypass; direct pages.dev requests without a valid token fail too. Future non-read requests also require exact same-origin Origin. Keep all future admin endpoints in this protected directory and check any additional role permissions server-side.

`GET /api/admin/session` returns only `{ "role": "admin" }`. Angular makes a fresh request on guarded navigation, treats any failed/invalid response as denied, and stores no credentials. The guard is not security. Cloudflare's edge may return its own login redirect/denial before a request reaches the Function; the 401/403 contract above is the origin API contract.

## Required manual Cloudflare configuration (not performed)
1. Zero Trust -> Access -> Applications -> Add application -> Self-hosted.
2. Create one application/audience covering `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*` on the intended hostname. Include both naisdrinks.com and www.naisdrinks.com if admin will be used on both. Do not protect the whole storefront. `/admin/login` may also be protected by Access; its Angular screen is useful on local/unprotected hosts.
3. Allow only named team identities (no Everyone or Bypass policy). Choose Google/Microsoft login with MFA and a short session duration (e.g. 8 hours). For API requests, enable a non-interactive/401 denial option if available; never bypass authentication to avoid login redirects.
4. Workers & Pages -> nais-frontend -> Settings -> Variables and Secrets, Production: set `ACCESS_TEAM_DOMAIN` to `https://YOUR-TEAM.cloudflareaccess.com` (no trailing slash), `ACCESS_AUD` to this application's audience, `ADMIN_EMAILS` to the comma-separated authorized emails. These are server bindings, not Angular environment values. No real values belong in the repository.
5. Redeploy to pick up bindings. Configure Pages Functions to fail closed on quota exhaustion. Keep `/api/admin/*` included in Functions routing if `_routes.json` is introduced later. Existing public API routes are unchanged.
6. Preview: leave bindings unset to deny access, or use a separate Access application/audience and explicitly configure preview bindings. Never allow unprotected preview admin writes. Local Angular/Wrangler without Access remains denied; use an Access-protected preview for real login verification, not a fabricated header/dev bypass.
7. Verify login as an allowed user, deny another identity, deny direct API requests without a token, and verify the public shop/checkout/webhook remain public. Verify both hostnames and refresh `/admin`. JWT authentication is independently enforced even if hostname edge protection is misconfigured.

Reference: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

No D1 migration, secrets, CRUD, Stripe writes or uploads are included.

## Phase 8.2: read-only operational APIs

All routes below inherit `functions/api/admin/_middleware.ts`; authentication and authorization remain unchanged. Only GET is supported (other authenticated same-origin methods return 405). No mutation, Angular page, migration or extra binding is introduced.

- `GET /api/admin/products`: array of all products, sorted by slug, including active/coming-soon/draft/archived.
- `GET /api/admin/products/:id`: one product by its internal catalogue ID, not slug lookup.
- Product fields: id, slug, name, description, status, priceCents, currency, stripeProductId, stripePriceId, imageUrl, featureImageUrl, createdAt, updatedAt. Nullable fields remain null. Public product responses are unchanged.
- `GET /api/admin/orders?limit=25&cursor=...`: `{ items: AdminOrder[], nextCursor: string | null }`. Limit is an integer 1–100, default 25. Omit cursor for the first page; pass nextCursor URL-encoded for the next. Unknown/repeated query parameters and malformed cursors return 400.
- Orders sort by `(createdAt DESC, id DESC)` using keyset pagination, including deterministic ties. Cursor is an opaque base64-encoded timestamp/ID pair, not a secret or authorization token. SQL values are bound parameters. Newer orders do not shift subsequent pages; refresh the first page to see them.
- `GET /api/admin/orders/:id`: one order by UUID.
- Order fields: id, orderNumber, paymentStatus, fulfillmentStatus, totalAmount, currency, createdAt, paidAt, customer `{ name, email, phone }`, shippingAddress `{ name, line1, line2, postalCode, city, country }`, items `[{ productId, productName, quantity, unitAmount, lineTotalAmount }]`. Money is integer minor units. Items retain purchased snapshots. Stripe session/payment/customer/event identifiers are not returned.
- Unknown valid IDs return 404; malformed IDs return 400; D1/configuration/data errors return generic 503. Responses are no-store. No customer data is logged.

Before Phase 8.3, deploy normally and verify the existing Access application covers these paths, its allowlist is correct, and the production Pages environment has PROMO_DB. No new schema or Cloudflare binding is needed. Verify an allowed user can GET these routes and another identity cannot, on every supported hostname/preview. Use synthetic fixtures for development; do not place customer responses in source control.

## Phase 8.4A: protected product mutations

The existing parent Access middleware (including same-origin Origin checks for writes) is unchanged. All existing GET contracts remain available.

- POST /api/admin/products: JSON with required slug, name, priceCents. Defaults: status draft, currency eur, description/imageUrl/featureImageUrl null. Returns 201 with the admin product. ID is a generated UUID and remains stable across slug edits. Stripe columns start null, so creating active products is rejected in this phase.
- PATCH /api/admin/products/:id: nonempty JSON with only supplied editable fields; omitted fields are preserved. Returns 200 with the admin product.
- POST /api/admin/products/:id/archive: no body or empty JSON object. Sets archived, updates updatedAt, returns 200 with product; repeating is safe. No deletes or order changes.
- Only slug, name, description, status, priceCents, currency, imageUrl, featureImageUrl are accepted. Extra fields (including either Stripe ID, id, timestamps) are rejected.
- Slug is trimmed/lowercased and must contain lowercase alphanumeric hyphen-separated words, max 200 characters; name trimmed, required, max 200; nullable description max 10000. Currency must be exactly eur. Price is a nonnegative safe integer for non-active products and strictly positive for active products. Status must be active/coming-soon/draft/archived. Images may be null, safe images/ or /images/ paths, or HTTPS URLs without credentials; no uploads/fetches are performed.
- JSON requests are bounded to 32 KiB. Invalid payload/content type/ID -> 400; absent product -> 404; conflicting slug -> 409. SQLite UNIQUE enforces concurrent slug conflicts. Concurrent updates detected against the full previous snapshot return 409 product_changed instead of overwriting changes.
- Any update leaving a product active requires an existing server-controlled Stripe Price ID. The server reads that Price with the existing STRIPE_SECRET_KEY and verifies active, one_time, per_unit, currency and exact amount against the proposed product. This is read-only, with no Stripe product/price writes. Invalid configuration/mismatch -> 400 product_not_purchasable; unavailable Stripe/D1/configuration -> generic 503. All responses remain no-store, with no provider details/logging.

Before Phase 8.4B: verify the existing production STRIPE_SECRET_KEY can read the stored Prices and uses the same Stripe mode, and verify authenticated same-origin mutations in a safe preview/local D1 environment. New products remain draft/coming-soon until server-side Stripe provisioning exists. No new migrations or bindings are required. No production data was changed during implementation.

## Phase 8.5A: server-side catalogue synchronization

This supersedes the read-only Stripe validation described in Phase 8.4A. No new endpoint or request field is introduced: protected `PATCH /api/admin/products/:id` now synchronizes Stripe when the resulting status is active. Create a product as draft/coming-soon first, then activate its stable D1 identity. Angular remains unchanged in this phase.

- Validate the managed fields before calling Stripe; client-supplied Stripe identifiers are still rejected. EUR, positive integer cents, one-time/per-unit Prices only.
- Reuse the stored Stripe Product, or recover it from a legacy stored Price. Otherwise use a deterministic server-generated Stripe Product ID. Verify ownership metadata when present and write `nais_product_id`, name and description. Images are not synchronized.
- Reuse a valid matching Price; otherwise create a new Price and retrieve/verify it. A deterministic unique lookup key based on the prior D1 revision and target amount recovers prepared Prices after a failed D1 write. Stripe idempotency keys also protect create retries. Product IDs/lookup keys extend duplicate protection beyond Stripe's temporary idempotency cache; do not transfer these lookup keys in Dashboard.
- Commit managed fields, both Stripe IDs and active status together in one conditional D1 UPDATE. The full previous snapshot must still match; otherwise return `409 product_changed`. A concurrent loser never deactivates its prepared Price or overwrites the winning D1 mapping. Stripe may retain an unused prepared Price, which is not a purchasable D1 mapping.
- Only after D1 commits, deactivate the previous Price if no catalogue row references it. Never delete a Product/Price or modify historical order snapshots. A failure before commit leaves D1 unchanged. A cleanup failure after commit returns generic `503 unavailable` but retains the new valid configuration; reload before retrying. The old Price can remain active in Stripe without being selected by checkout. Do not roll back to a Price whose deactivation outcome is uncertain.
- There is no distributed transaction between D1 and Stripe. A failed/conflicting operation can leave Stripe descriptive fields or prepared objects ahead of D1; a subsequent successful PATCH of the current D1 fields resynchronizes them. D1 remains the checkout source of truth and all monetary configuration is committed atomically.

Before Phase 8.5B: verify `STRIPE_SECRET_KEY` has Products read/write and Prices read/write permissions in the same Stripe account/mode as existing mappings. Test activation and price replacement using an Access-protected test deployment and test-mode resources. No migration or new secret binding is required. No real Stripe calls, deployment or remote D1 writes are made by automated tests.

Stripe references: https://docs.stripe.com/api/products/create and https://docs.stripe.com/api/prices/create and https://docs.stripe.com/api/idempotent_requests
