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
