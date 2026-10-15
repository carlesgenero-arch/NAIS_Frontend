# Promo Turnstile protection

Only the promotion popup and `POST /api/promo-signup` use Turnstile. No checkout,
webhook or admin authentication behavior changes. No dependency or migration is required.

## Cloudflare production setup

1. Cloudflare account dashboard -> Turnstile -> Add widget.
2. Name: `NAIS promo production`. Add hostnames `naisdrinks.com` and
   `www.naisdrinks.com`. Add `nais-frontend.pages.dev` only if that hostname should
   support the production promotion. Do not enable Any Hostname.
3. Choose **Managed**, leave pre-clearance disabled, and select Create.
4. Copy the public sitekey and keep the secret key private.
5. Workers & Pages -> `nais-frontend` -> Settings -> Variables and Secrets ->
   Production: add `TURNSTILE_SITE_KEY` as a text variable and
   `TURNSTILE_SECRET_KEY` as a secret. They must belong to the same widget.
6. Deploy frontend and Pages Functions together. `GET /api/promo-config` must
   return only `{ "siteKey": "..." }`; never the secret or other environment values.
7. Open the popup and submit a controlled inbox. Complete verification if prompted. Expect the existing registered/email flow. With a fresh challenge,
   submit the same normalized email: expect already_registered and no new code.
8. Use Turnstile Analytics to confirm Siteverify validations. Do not put tokens,
   secrets, email addresses or provider bodies in logs/screenshots.

Configuration is fail closed: deploying without the two bindings prevents signup.
Existing production bindings have NOT been changed by this implementation.

## Local / preview

Use a separate development widget with the specific development/preview hostnames
and keys in gitignored `.dev.vars`. Public key and secret are both runtime
bindings; neither needs to be copied into Angular environment files. Restart
Wrangler after changes. `SITE_URL=http://localhost:4200` lets verification check
the browser hostname while Angular proxies API calls to Wrangler.

Never use production secrets in public frontend code or introduce an authentication
bypass for development. Automated tests mock Cloudflare, Stripe, Resend and D1.

## Request and validation

Payload: `{ "email": "user@example.com", "turnstileToken": "..." }`.
The token stays in memory and is never stored in D1 or browser storage.
Siteverify receives only the token and secret, with an 8-second timeout and no
redirect following. A successful response must have `action=promo_signup` and an
expected hostname. Cloudflare enforces token expiry (5 minutes) and single use.
Invalid tokens return generic `verification_failed`; configuration/network errors
return generic `unavailable`. No provider diagnostics are returned.

The widget is mounted only after a valid form submission, then explicitly run
with `execution=execute`. Opening the popup makes no Turnstile request and
reserves no challenge space. The compact managed widget uses
`appearance=interaction-only`, so Cloudflare displays any required interaction. Its
150px-wide challenge fits narrow popup content without scaling controls. Existing
CAT/CAST copy and safe generic errors remain translated. Script/network failure
offers another submission through the existing CTA; dismissal removes the widget
and ignores stale results. Submission remains disabled throughout verification
and registration; the token is consumed once and the widget removed afterward. Existing promotion eligibility and
delivery idempotency remain unchanged.

If adding CSP later, allow the official Turnstile script/frame at
`https://challenges.cloudflare.com` according to Cloudflare's CSP documentation.

References:
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/
