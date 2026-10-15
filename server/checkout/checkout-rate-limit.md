# Checkout rate limiting (Pages + private Worker)

Pages does not support native `ratelimits` configuration (Wrangler 4.148.0 rejects
that field for Pages). The supported arrangement is a Pages Service Binding to a
private Worker that owns the native Cloudflare Rate Limiting binding. No app/API
routes are moved. No WAF rule is consumed. Stripe webhook and admin adapters do
not import or call this service.

## Configuration and behavior

- Pages Service Binding: `CHECKOUT_RATE_LIMITER` -> `nais-checkout-rate-limiter`.
- Private Worker native binding: `CHECKOUT_RATE_LIMITER`.
- Worker config: `wrangler.checkout-rate-limiter.toml`.
- Dedicated namespace: `880501` (verify no other Worker in this account uses it).
- Native limit: 10 calls per 60 seconds per key per Cloudflare location.
- The binding is approximate/eventually consistent, not a global exact quota.
- Shared IPs (mobile/carrier NAT, offices) share a bucket; this is a deliberate
  anonymous-endpoint tradeoff. No login or customer data is used.

Only `POST /api/checkout` calls the service, before catalogue queries, body parsing
or Stripe requests. Existing checkout business/price validation follows unchanged.
Key: `checkout:<CF-Connecting-IP>` only when the request has Cloudflare runtime
`cf` metadata. Cloudflare sets the IP header at its edge; ordinary client headers
alone do not establish provenance. `X-Forwarded-For`, `X-Real-IP`, request body and
query parameters are never used as client identity. Do not put an untrusted proxy
in front of Pages that can manufacture/replace this trusted metadata/header.
Missing/invalid trusted IP falls into `checkout:anonymous`, a shared limited bucket.
There is no random key or local allow-all branch. No keys/IPs are logged or stored
in D1; only the platform's rate counters use them.

Rejected native decision: HTTP 429, `{ "status": "rate_limited" }`, `Cache-Control:
no-store`. No counter, IP, namespace or provider errors are exposed. Missing or
failed service/native binding fails closed with 503 `{ "status": "unavailable" }`.
Non-POST checkout requests retain their existing method validation.

## Production deployment (manual, in this order)

1. Check account-wide namespace `880501` is unused; change the helper config if
   necessary. Its namespace must be independent from all other limiters.
2. From the repo root, authenticate Wrangler to the intended Cloudflare account.
   Preview the helper bundle without publishing:
   `npx wrangler deploy --config wrangler.checkout-rate-limiter.toml --dry-run`.
3. Publish **only the private helper**:
   `npx wrangler deploy --config wrangler.checkout-rate-limiter.toml`.
   It has `workers_dev=false`, `preview_urls=false`, no routes, and no secrets/D1.
   Do not enable a public route, custom domain, workers.dev or preview URL for it.
4. Workers & Pages -> `nais-frontend` -> Settings -> Bindings -> Add -> Service
   binding. In **Production**, variable `CHECKOUT_RATE_LIMITER`, service
   `nais-checkout-rate-limiter`. Do this before deploying the Pages code.
5. For **Preview**, bind a separately deployed helper with its own Worker name and
   namespace if previews must not share production quotas. Do not silently omit
   the binding: that causes checkout to fail closed. Deploy the same code/config
   with those distinct values, then select it in Preview bindings.
6. Deploy Pages normally. Root `wrangler.toml` remains local-only; production
   bindings remain Dashboard-managed. No `pages_build_output_dir` was added.
7. Verify one controlled checkout reaches the existing Stripe test flow. Verify
   throttling using tests or safe invalid checkout bodies (for example `{}`),
   which cannot create a Stripe Session. Repeated POSTs from one location should
   eventually return generic 429. Do not create real payment Sessions just to
   exhaust the limit. Check signed webhook delivery still returns its normal
   response; leave the promo WAF rule unchanged.

## Local development (same enforcement, local counters)

From the repo root, in separate terminals:

```powershell
npx wrangler dev --config wrangler.checkout-rate-limiter.toml --port 8790
npx wrangler pages dev public --port 8788 --service CHECKOUT_RATE_LIMITER=nais-checkout-rate-limiter
npm start
```

The explicit `--service` also works when Pages bindings are configured only via
the Dashboard. Root `wrangler.toml` contains the matching local service binding.
Wrangler/Miniflare emulate the native rate limiter locally; no production counters
or production D1 are used. If the helper is not running, checkout fails closed.
Requests without trusted edge identity share the `checkout:anonymous` bucket;
wait for the 60-second window or restart the local helper to reset local state.
Do not add a fake production binding or a local bypass to make tests pass.
Automated tests mock the native binding and Stripe; they never contact production.

References:
- https://developers.cloudflare.com/pages/functions/bindings/#service-bindings
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/fundamentals/reference/http-headers/
