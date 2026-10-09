# Server email infrastructure

Future order, promotion and fulfillment services call `sendEmail(message, env)` from
`email.service.ts`. Nothing sends email automatically in this phase. A temporary
protected admin smoke-test endpoint is available; there is no Angular integration.
No additional dependencies are required.

## Boundary

- `email.types.ts`: one-recipient message (`to`, `subject`, `html`, optional `text`
  and `replyTo`), environment and provider-independent result contracts.
- `email.service.ts`: configuration/message validation and safe result projection.
- `resend.transport.ts`: Cloudflare-native fetch transport for Resend's HTTPS API.
  Only this file knows the provider wire format. A transport can be injected in tests.
- Results: `accepted`, `not_configured`, `invalid_message`, or `unavailable`.
  Accepted means queued by the provider, **not delivered**. Future HTTP adapters
  must map failures to generic responses, never return provider errors.
- Sender comes only from server configuration; message `replyTo` overrides the
  optional configured reply-to. Recipient and reply-to are single bare addresses.
- No logging, provider error bodies/IDs returned, or automatic retries. Requests
  have a 10-second timeout and reject redirects. A timeout can happen after provider
  acceptance; future business flows need persisted idempotency before adding retries.
- Templates belong to future business features. Escape user-derived values before
  inserting them into HTML; this transport does not sanitize business templates.

## Configuration (server only)

- `RESEND_API_KEY`: required Cloudflare secret, never an Angular environment value.
- `EMAIL_FROM`: required verified sender, e.g. `NAIS <orders@naisdrinks.com>` once
  that domain is verified. A bare email address is also accepted.
- `EMAIL_REPLY_TO`: optional existing inbox for replies; omit it when unused.
- `EMAIL_TEST_TO`: server-only recipient required by the temporary admin smoke test.

Until the NAIS sending domain is ready, `NAIS <onboarding@resend.dev>` can be used
for development within Resend's test-sender restrictions (your account email or
supported test recipients). It is not a production sender for arbitrary customers.

## Manual setup, when ready

1. In Resend, open **Domains -> Add domain** and add the chosen sending domain.
   Copy the exact DNS records Resend supplies into Cloudflare **DNS -> Records**.
   Verify the domain in Resend. Preserve existing receiving-mail MX records; add
   sending records at the exact hostnames supplied by Resend.
2. Open **API Keys -> Create API key**. Prefer **Sending access**, scoped to the
   verified sending domain. Keep the value private.
3. In Cloudflare, open **Workers & Pages -> nais-frontend -> Settings -> Variables
   and Secrets**. Select **Production**. Add `RESEND_API_KEY` as a secret and
   `EMAIL_FROM` plus optional `EMAIL_REPLY_TO` as server environment variables.
4. Configure Preview separately with a development key/sender if email testing is
   needed there. Do not copy production credentials into Angular or commit them.
5. Redeploy the Pages project manually so Functions receive the new bindings.
   This task does not deploy, alter DNS, or change dashboard configuration.
6. For local development, add the same names to the already-ignored `.dev.vars`
   file and restart Wrangler Pages dev. Never commit that file. Example values:

   ```dotenv
   RESEND_API_KEY=replace_with_private_development_key
   EMAIL_FROM="NAIS <onboarding@resend.dev>"
   EMAIL_REPLY_TO=replace_with_your_real_inbox@example.com
   ```

7. For a production smoke test, configure `EMAIL_TEST_TO` in the same Production
   variables (prefer a secret to keep this address private), then redeploy with
   `functions/api/admin/email/test.ts` included. Keep existing Access protection
   for `/api/admin/*` and the `ADMIN_EMAILS` allowlist enabled.
8. Sign in to `https://naisdrinks.com/admin` with an allowlisted identity. From
   that page's browser developer console, run the following once. Browser cookies
   authenticate with Access and the browser sends the same-origin Origin header.

   ```js
   const response = await fetch('/api/admin/email/test', {
     method: 'POST', credentials: 'same-origin'
   });
   console.log(response.status, await response.json());
   ```

   Expect `200 {"status":"accepted"}`, then check the configured inbox for
   **NAIS email test**. Acceptance does not prove delivery; check Resend's dashboard
   if the message does not arrive. With the test sender, use your Resend account's
   email as `EMAIL_TEST_TO`.
9. The temporary test endpoint returns 503 `unavailable` with a safe `diagnostic`
   category on email failures. Other consumers retain generic results. Categories:
   - `not_configured`: required configuration missing or invalid (including sender
     or optional reply-to); no request was made. Check Production variables and redeploy.
   - `invalid_message`: message validation failed, e.g. malformed `EMAIL_TEST_TO`.
   - `network_error`: fetch failed before receiving a response.
   - `timeout`: the outbound request timed out.
   - `provider_http_error`: Resend returned a non-2xx response; no body is exposed.
   - `unexpected_error`: unexpected exception or malformed successful provider response.
   Exceptions additionally include only `exception`: `TypeError`, `AbortError`,
   `TimeoutError` or `OtherError` (arbitrary exception names are never exposed).
   No diagnostic logs are written. The provider URL is `https://api.resend.com/emails`,
   with `Authorization: Bearer <RESEND_API_KEY>` and `Content-Type: application/json`.
   After deploying these diagnostics, run step 8 once and inspect only status/category.
   A generic 503 without a category can still originate in admin authentication
   middleware before this endpoint runs; its security behavior is unchanged.
   Authentication failures return 401; unauthorized identities or
   cross-origin writes return 403; non-POST methods return 405 after authentication.
   Request bodies are ignored and cannot override recipient or content. Do not
   repeatedly retry an ambiguous failure: the provider may already have accepted it.
   Automated tests use mocked fetch and send no real mail.

Remove the temporary `functions/api/admin/email/test.ts` route and
`server/admin-email.test.mjs` when the smoke test is no longer needed; the reusable
email infrastructure is independent of this endpoint.

Cloudflare transport regression: `redirect: 'error'` is rejected with TypeError
by workerd before outbound dispatch. Use `redirect: 'manual'`; all 3xx responses
fail safely without forwarding credentials. The 10-second AbortSignal timeout is
supported and retained. `email-runtime.test.mjs` executes the actual transpiled
transport in Wrangler's installed Miniflare/workerd with synthetic outbound replies.
It reproduces the old failure, verifies the fixed request, and checks redirects
are not followed. Production compatibility settings remain dashboard-managed;
the runtime test uses the repository's local compatibility date, 2026-09-01.

## Verification

```sh
node --test server/email.test.mjs
node --test server/*.test.mjs
npm run check:server
npm run build
```

Official references:
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/domains/introduction
- https://resend.com/docs/api-reference/api-keys/create-api-key
- https://developers.cloudflare.com/pages/functions/bindings/
