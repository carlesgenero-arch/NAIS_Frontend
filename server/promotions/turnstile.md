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
Wrangler Pages dev instance after editing `.dev.vars`. Official always-pass and forced-interaction
test responses can use `hostname: "example.com"` with missing/null `action`.
Only that synthetic context is accepted when ALL four server-owned settings above
match: test sitekey `1x00000000000000000000AA` or `3x00000000000000000000FF`,
official always-pass test secret, expected
action `test`, and a loopback `SITE_URL` (`localhost`, `127.0.0.1`, or `[::1]`).
No mode is inferred from the request hostname, headers or token. Siteverify must
still return HTTP success and `success === true`; invalid/missing tokens and
provider failures are not bypassed. All other contexts use the existing strict
hostname/action checks. A real development widget uses
`TURNSTILE_EXPECTED_ACTION=promo_signup` and its actual keys instead.

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


### Temporary local Wrangler diagnostic

On loopback API URLs (`localhost`, `127.0.0.1`, `[::1]`), the verifier emits one
`console.info` JSON line with only `success`, `error-codes`, `hostname`, and `action`
before evaluating the Siteverify result. It also emits null metadata for a token
rejected before Siteverify. No diagnostic environment flag is required. Restart
Wrangler after updating this server module, submit again, and inspect the Wrangler
terminal (not the Angular terminal or browser console). Keep the default Wrangler
log level, or use `--log-level info` if it was previously set to `warn`/`error`.
There is no diagnostic output on production hostnames. Responses and validation
are unchanged; unknown error codes and malformed metadata are sanitized.
