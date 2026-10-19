# LOCAL Stripe TEST checkout

Production HTTP handlers, Access, rate limiting, shipping, payment verification and webhook logic are unchanged.
New local setup tests are included in npm run test:checkout.
There is NO local authentication/rate-limiter bypass. The local npm launchers refuse LIVE keys and non-loopback SITE_URL.
Never add --remote, deploy, --live, real card details, or production credentials to this workflow.

## Current inspection

- Root wrangler.toml already binds local PROMO_DB and the private CHECKOUT_RATE_LIMITER service.
- The private Worker must run separately; otherwise POST checkout returns fail-closed 503 before D1/Stripe.
- The existing local four active D1 price mappings match the configured TEST Prices and EUR 3600 amounts.
  Missing Stripe Product IDs do NOT block checkout and this task does not repair them.
- .dev.vars has a TEST key and local SITE_URL, but lacks STRIPE_WEBHOOK_SECRET. Stripe CLI was not installed.
  Without a signed forwarded checkout.session.completed event, success verification cannot become paid.
- STRIPE_PRICE_* is NOT the checkout source of truth. These non-secret setup inputs let the local helper
  link freshly migrated local D1 rows; new Sessions/webhooks use server-written D1 metadata.
- Local migrations already exist for products/orders/email delivery. No new migration is needed.

## Required local .dev.vars (project root, ignored by Git)

```dotenv
STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_OWN_TEST_KEY
SITE_URL=http://localhost:4200
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_LOCAL_STRIPE_LISTEN_SECRET
STRIPE_PRICE_ORANGE_SPRITZ=price_REPLACE_WITH_TEST_PRICE
STRIPE_PRICE_PASSION_HUGO=price_REPLACE_WITH_TEST_PRICE
STRIPE_PRICE_GINGER_CRUSH=price_REPLACE_WITH_TEST_PRICE
STRIPE_PRICE_PACK_VARIAT=price_REPLACE_WITH_TEST_PRICE
```

Use Prices from the SAME account/sandbox as the TEST key and CLI login. Each must be active, one-time,
per_unit, EUR and match that product's local D1 price_cents. Current local packs are EUR 3600.
Do not change production prices or reuse a LIVE Price with a TEST key. The helper only retrieves Prices;
it never creates/modifies Stripe objects. `sync-prices` writes only stripe_price_id in LOCAL D1,
using one statement after every Price passes validation. Product status, price, currency and orders are untouched.
`check` is read-only; exit 1 means missing webhook config or local mappings need syncing.
The optional STRIPE_PRICE_TROPICAL_HOPS is legacy compatibility only; it must not make that product purchasable.
No RETURN_URL/BASE_URL override is used: SITE_URL builds both fixed checkout return paths.

Keep existing Turnstile/promo variables if testing promo; they are not required by checkout.
Do not add Resend settings for a checkout-only test. Missing email configuration may mark confirmation delivery
failed, but never invalidates the paid order. Promo rules remain unchanged; any code tested must exist in TEST mode.
Do not paste keys into Angular, requests, terminal commands, screenshots, or this document.

## PowerShell: in order

### 1. One-time setup

```powershell
Set-Location 'C:\Users\CARLES\Desktop\NAIS\nais_frontend'
# Keep the existing .dev.vars; do not overwrite it.
if (-not (Test-Path -LiteralPath .dev.vars)) { Copy-Item .dev.vars.example .dev.vars }
notepad .dev.vars
npm run d1:local:migrate
npm run d1:local:tables
npm run checkout:local:sync-prices
```

All D1 commands above explicitly use --local. The production database name/UUID in wrangler.toml does not
turn a --local operation into a remote write. Do not change persistence directories between commands.
Both migrations and local API use .wrangler/state. Keep .wrangler/ and .dev.vars untracked.

### 2. Stripe CLI (dedicated terminal, keep running)

Install the official Windows CLI if `Get-Command stripe` cannot find it:
https://docs.stripe.com/stripe-cli . Reopen PowerShell after installing/adding it to PATH.
Then:

```powershell
Set-Location 'C:\Users\CARLES\Desktop\NAIS\nais_frontend'
stripe login
stripe listen --events checkout.session.completed --forward-to http://127.0.0.1:8788/api/stripe-webhook
```

Use the same Stripe TEST account/sandbox as .dev.vars. Do not add --live or --skip-verify.
Copy ONLY the listener's whsec_ value into STRIPE_WEBHOOK_SECRET in .dev.vars using your editor.
This is different from a Dashboard webhook endpoint secret. Restart Pages after editing .dev.vars.
Do not use `stripe trigger checkout.session.completed` as proof of this purchase: that creates unrelated fixtures.

### 3. Private limiter (another terminal)

```powershell
Set-Location 'C:\Users\CARLES\Desktop\NAIS\nais_frontend'
npm run dev:checkout:limiter
```

Local port 8790; actual native limiter emulated by Wrangler, 10/60, same Worker and service name.
Local clients may share checkout:anonymous. Wait at least 60 seconds after hitting 429.
No public Worker deployment, remote Service Binding, or production counters are involved.

### 4. Pages Functions (another terminal)

```powershell
Set-Location 'C:\Users\CARLES\Desktop\NAIS\nais_frontend'
npm run checkout:local:check
npm run dev:checkout:api
```

API 127.0.0.1:8788. Root config is autodetected; Pages does not accept an explicit --config path.
The local launcher fixes --local and local persistence, validates the TEST key/origin and keeps Wrangler logs in
ignored .wrangler/logs. Without the running limiter, checkout still fails closed.

### 5. Angular (another terminal)

```powershell
Set-Location 'C:\Users\CARLES\Desktop\NAIS\nais_frontend'
npm start -- --host localhost --port 4200
```

All /api requests are proxied to 127.0.0.1:8788. Open localhost:4200, not 8788, for the app.
Do not switch to a different browser origin during the flow: the cart and safe clear-once marker are origin-scoped.

### 6. Read-only API check and one optional Session

```powershell
Invoke-RestMethod 'http://localhost:4200/api/products' | Select-Object id,status,priceCents
# Optional: creates one unpaid TEST Session, no charge/order. Do not use this loop to exhaust the limiter.
$checkoutBody = @{ items = @(@{ productId = 'orange-spritz'; quantity = 1 }); locale = 'ca' } | ConvertTo-Json -Depth 4
$checkoutResult = Invoke-RestMethod -Method Post -Uri 'http://localhost:4200/api/checkout' -ContentType 'application/json' -Body $checkoutBody
# Prefer the browser/cart flow below to verify cart clearing; an API-created Session did not submit the cart.
Start-Process 'http://localhost:4200/products'
```

Use the Angular origin for requests with Origin headers. Do not weaken same-origin checks or forge CF IP headers.
`GET /api/products` alone does not prove Stripe or the limiter is ready.

## Browser TEST acceptance checklist

Use fake customer/address data and a Stripe TEST card only (4242 4242 4242 4242, future expiry, any test CVC).
Stripe collects shipping/name/phone; use an ES test address. No real payment is performed in TEST mode.

1. Add one EUR 36 pack: cart subtotal EUR 36 + shipping EUR 6 = EUR 42, without a promo code.
2. Click Checkout twice quickly: only one in-flight request from the drawer, then SAME-TAB Stripe Checkout.
3. Confirm Checkout says TEST mode, EUR 42, expected product/quantity; pay with the TEST card.
4. Listener should show this actual checkout.session.completed forwarded to /api/stripe-webhook with HTTP 200.
5. Stripe returns to http://localhost:4200/checkout/success?session_id=cs_test_...
   Initial verification is calm/loading. Only D1's verified paid order can clear the cart and suppress the promo.
   Retry schedule is immediate, +1s, +2s, +4s, +6s (five attempts over about 13s plus request time).
   If the webhook takes longer, the bounded pending state is expected; do not pay again.
6. Refresh success: verified order still appears; the clear-once marker must not clear a newly created cart.
7. New attempt with two boxes: subtotal/total EUR 72, shipping free. Cancel using Stripe's back/cancel action:
   return /checkout/cancel, with the cart unchanged. Browser close alone is not proof of the cancel route.
8. Safe rejection checks (not more than 10 requests/minute): unknown ID, empty items, tampered price field,
   and tropical-hops-harvest must return 400; coming-soon/draft/archived remain rejected. No Stripe Session.
9. A brief pending response can occur naturally before the signed webhook finishes. Keep the listener running.
   The deterministic pending -> paid and timeout cases are covered by automated tests; do not stop forwarding,
   edit D1 payment status, or resend events to unrelated Dashboard endpoints just to manufacture the delay.

Automated tests cover the deterministic pending -> paid case, retry exhaustion/cancellation, duplicate clicks,
shipping, invalid carts, fail-closed limiter and webhook/order idempotency without real provider calls.

## Troubleshooting

- 503 before D1/Stripe: start the local Worker first and verify the Pages CHECKOUT_RATE_LIMITER local service binding.
- 429: shared local bucket, wait for its window. Do not bypass it or invent random client keys.
- 400 invalid_product: D1 eligibility, missing price mapping, or unknown product. Check local migrations/setup.
- 502 checkout_unavailable: invalid key/mode/account, Stripe network error, or invalid Checkout response.
- 503 after product lookup: D1/Stripe amount/currency mismatch. Do not change validation to make it pass.
- Success remains pending: local listener absent, wrong whsec_, event forwarding error, wrong DB persistence path,
  or a TEST Session from a different Stripe account. Check signed webhook status, not the redirect alone.
- 403: keep browser API requests same-origin via Angular proxy; do not relax production origin checks.
- `Cannot read directory ../../..: Acceso denegado`: local OS/sandbox permission error in esbuild/Wrangler,
  not a Stripe/API response. Run these commands in your normal project PowerShell with filesystem access.

Sources: https://developers.cloudflare.com/pages/functions/local-development/
and https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
and https://docs.stripe.com/webhooks and https://docs.stripe.com/testing .
