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
   `TURNSTILE_SECRET_KEY` as a secret. They must belong to the same widget. Set the server-only text variable
   `TURNSTILE_EXPECTED_ACTION=promo_signup` in Production (also the default when omitted).
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

### Official dummy forced-interaction test

For Cloudflare's official dummy keys, set these local `.dev.vars` values:

```dotenv
TURNSTILE_SITE_KEY=3x00000000000000000000FF
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
TURNSTILE_EXPECTED_ACTION=test
SITE_URL=http://localhost:4200
```

These are public test credentials, never production credentials. Restart the single
Wrangler Pages dev instance after editing `.dev.vars`. Cloudflare's illustrative dummy response uses action `test` and hostname
`localhost`; actual responses can differ. Missing action or a hostname such as
`example.com` is still rejected by strict local validation. The existing
`SITE_URL` hostname check must still match the returned hostname. There is no hostname bypass. A separate real development widget
uses `TURNSTILE_EXPECTED_ACTION=promo_signup` instead.

Never deploy dummy credentials or `TURNSTILE_EXPECTED_ACTION=test` to Production.
Production requires the real widget/secret and `TURNSTILE_EXPECTED_ACTION=promo_signup`.
Cloudflare dummy keys simulate outcomes (including success and already-spent tokens);
use a real widget to validate real token expiry/single-use behavior. No expected action
comes from the browser; missing/incorrect response actions always fail verification.
Invalid configuration values fail closed. No changes to promotion eligibility or delivery.

## Request and validation

Payload: `{ "email": "user@example.com", "turnstileToken": "..." }`.
The token stays in memory and is never stored in D1 or browser storage.
Siteverify receives only the token and secret, with an 8-second timeout and no
redirect following. A successful response must match the server-configured action (default
`promo_signup`; explicitly `test` for official local dummy tests) and an
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
and registration. Each keyed attempt accepts a single token/result and ignores
late callbacks from prior attempts. The widget is removed as soon as its token
is handed to the signup request, so no completed challenge occupies form space.
Provider retry/refresh is `never`: the form owns fresh-widget retries after errors.
The browser request allows up to 120 seconds for serial Siteverify, Stripe SDK
calls/retries and email delivery, rather than aborting a valid registration at 15
seconds. It never automatically replays the HTTP request or reuses a token. Existing promotion eligibility and
delivery idempotency remain unchanged.

If adding CSP later, allow the official Turnstile script/frame at
`https://challenges.cloudflare.com` according to Cloudflare's CSP documentation.

References:
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/

- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
