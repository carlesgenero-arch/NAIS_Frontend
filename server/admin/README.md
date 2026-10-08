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
