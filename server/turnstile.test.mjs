import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyPromoToken } from './promotions/turnstile.ts';
import { promoSignup } from './promotions/promo-signup.ts';
import { onRequest as config } from '../functions/api/promo-config.ts';

const request = () => new Request('https://naisdrinks.com/api/promo-signup');
const env = { TURNSTILE_SECRET_KEY: 'test-secret' };
const valid = { success: true, action: 'promo_signup', hostname: 'naisdrinks.com' };

test('valid token uses fixed Siteverify endpoint, action and hostname; sends no email or IP', async () => {
  let calls = 0;
  const result = await verifyPromoToken('test-token', request(), env, async (url, options) => {
    calls++;
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'manual');
    assert.deepEqual(JSON.parse(options.body), { secret: 'test-secret', response: 'test-token' });
    return Response.json(valid);
  });
  assert.equal(result, 'valid');
  assert.equal(calls, 1);
});

for (const token of [undefined, null, '', ' ', 42, {}, 'x'.repeat(2049)]) {
  test(`missing or invalid token is rejected before provider access: ${typeof token}`, async () => {
    assert.equal(await verifyPromoToken(token, request(), env, () => { throw Error('Must not fetch'); }), 'invalid');
  });
}

for (const response of [{ success: false, 'error-codes': ['invalid-input-response'] },
  { success: false, 'error-codes': ['timeout-or-duplicate'] },
  { ...valid, hostname: 'evil.example' }, { ...valid, action: 'checkout' }, { success: 'true' }]) {
  test('invalid, expired, reused or wrong-context provider response fails closed: ' + JSON.stringify(response), async () => {
    assert.equal(await verifyPromoToken('token', request(), env, async () => Response.json(response)), 'invalid');
  });
}

test('network, timeout, HTTP errors, malformed responses and missing secret fail closed', async () => {
  for (const send of [async () => { throw TypeError('private'); },
    async () => { throw new DOMException('private', 'TimeoutError'); },
    async () => Response.json({ private: 'details' }, { status: 503 }),
    async () => new Response('not JSON'), async () => Response.json(null)]) {
    assert.equal(await verifyPromoToken('token', request(), env, send), 'unavailable');
  }
  assert.equal(await verifyPromoToken('token', request(), {}), 'unavailable');
});

test('reusing a token fails when Siteverify reports it already consumed', async () => {
  let used = false;
  const send = async () => { const response = used ? { success: false, 'error-codes': ['timeout-or-duplicate'] } : valid; used = true; return Response.json(response); };
  assert.equal(await verifyPromoToken('token', request(), env, send), 'valid');
  assert.equal(await verifyPromoToken('token', request(), env, send), 'invalid');
});

test('rejected verification cannot reserve an email, create a Stripe code or send email', async () => {
  let touched = 0;
  const bindings = { ...env, PROMO_DB: { prepare() { touched++; throw Error('Must not access'); } } };
  for (const [token, send, status] of [[undefined, async () => Response.json(valid), 400],
    ['invalid', async () => Response.json({ success: false }), 400],
    ['token', async () => { throw Error('secret provider detail'); }, 503]]) {
    const response = await promoSignup(new Request(request().url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', ...(token ? { turnstileToken: token } : {}) }),
    }), bindings, () => { touched++; throw Error('Must not create Stripe client'); }, send);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { status: status === 400 ? 'verification_failed' : 'unavailable' });
  }
  assert.equal(touched, 0);
});

test('public configuration exposes only site key, not other bindings; GET only and uncached', async () => {
  const bindings = { TURNSTILE_SITE_KEY: '0x-public-site-key', TURNSTILE_SECRET_KEY: 'private', RESEND_API_KEY: 'private' };
  const response = config({ request: new Request('https://naisdrinks.com/api/promo-config'), env: bindings });
  assert.deepEqual(await response.json(), { siteKey: bindings.TURNSTILE_SITE_KEY });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(config({ request: new Request('https://naisdrinks.com/api/promo-config'), env: {} }).status, 503);
  assert.equal(config({ request: new Request('https://naisdrinks.com/api/promo-config', { method: 'POST' }), env: bindings }).status, 405);
});
