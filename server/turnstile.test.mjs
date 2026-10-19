import { test, mock } from 'node:test';
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

test('official local dummy action passes only when explicitly configured, with hostname still checked', async () => {
  const localRequest = new Request('http://127.0.0.1:8788/api/promo-signup');
  const localEnv = { TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    TURNSTILE_EXPECTED_ACTION: 'test', SITE_URL: 'http://localhost:4200' };
  const dummy = { success: true, action: 'test', hostname: 'localhost' };
  assert.equal(await verifyPromoToken('XXXX.DUMMY.TOKEN.XXXX', localRequest, localEnv, async () => Response.json(dummy)), 'valid');
  for (const response of [{ ...dummy, action: 'promo_signup' }, { ...dummy, action: 'other' },
    { ...dummy, hostname: 'evil.example' }, { ...dummy, success: false }, { success: true, hostname: 'localhost' }]) {
    assert.equal(await verifyPromoToken('token', localRequest, localEnv, async () => Response.json(response)), 'invalid');
  }
});

test('production configured or default action requires promo_signup and rejects dummy action', async () => {
  for (const bindings of [env, { ...env, TURNSTILE_EXPECTED_ACTION: 'promo_signup' }]) {
    assert.equal(await verifyPromoToken('token', request(), bindings, async () => Response.json(valid)), 'valid');
    assert.equal(await verifyPromoToken('token', request(), bindings, async () => Response.json({ ...valid, action: 'test' })), 'invalid');
    assert.equal(await verifyPromoToken('token', request(), bindings, async () => Response.json({ ...valid, hostname: 'localhost' })), 'invalid');
  }
});

test('empty, arbitrary or malformed expected action configuration fails closed before Siteverify', async () => {
  for (const action of ['', ' ', '*', 'checkout', ' promo_signup ', null, 1]) {
    assert.equal(await verifyPromoToken('token', request(), { ...env, TURNSTILE_EXPECTED_ACTION: action },
      () => { throw Error('Must not fetch'); }), 'unavailable');
  }
});

test('local dummy responses with missing action or unexpected hostname remain rejected', async () => {
  const local = new Request('http://127.0.0.1:8788/api/promo-signup');
  const bindings = { ...env, TURNSTILE_EXPECTED_ACTION: 'test', SITE_URL: 'http://localhost:4200' };
  for (const value of [
    { success: true, hostname: 'example.com' },
    { success: true, hostname: 'localhost' },
    { success: true, action: 'test', hostname: 'example.com' },
  ]) assert.equal(await verifyPromoToken('XXXX.DUMMY.TOKEN.XXXX', local, bindings, async () => Response.json(value)), 'invalid');
});


test('real local handler logs only safe Siteverify fields before returning verification_failed', async () => {
  const logs = [];
  const logger = mock.method(console, 'info', line => logs.push(JSON.parse(line)));
  try {
    const providerResult = { success: true, 'error-codes': [], hostname: 'example.com', action: 'test',
      secret: 'DO_NOT_LOG_SECRET', token: 'DO_NOT_LOG_TOKEN', email: 'do-not-log@example.com' };
    const result = await promoSignup(new Request('http://127.0.0.1:8788/api/promo-signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'do-not-log@example.com', turnstileToken: 'DO_NOT_LOG_TOKEN' }),
    }), { TURNSTILE_SECRET_KEY: 'DO_NOT_LOG_SECRET', TURNSTILE_EXPECTED_ACTION: 'test',
      SITE_URL: 'http://localhost:4200' }, () => { throw Error('Must not create Stripe client'); }, async () => {
      assert.equal(logs.length, 0);
      return Response.json(providerResult);
    });
    assert.equal(result.status, 400);
    assert.deepEqual(await result.json(), { status: 'verification_failed' });
    assert.deepEqual(logs, [{ success: true, 'error-codes': [], hostname: 'example.com', action: 'test' }]);
  } finally { logger.mock.restore(); }
});

test('local invalid token and Siteverify failure paths both log before returning invalid', async () => {
  const logs = [];
  const logger = mock.method(console, 'info', line => logs.push(JSON.parse(line)));
  try {
    const local = new Request('http://localhost:8788/api/promo-signup');
    assert.equal(await verifyPromoToken(undefined, local, env), 'invalid');
    assert.equal(await verifyPromoToken('token', local, env, async () => Response.json({
      success: false, 'error-codes': ['timeout-or-duplicate', 'DO_NOT_LOG_SECRET'],
      hostname: 'customer@example.com', action: 'DO.NOT.LOG.TOKEN',
    })), 'invalid');
    assert.deepEqual(logs, [
      { success: null, 'error-codes': [], hostname: null, action: null },
      { success: false, 'error-codes': ['timeout-or-duplicate', 'unknown-error'], hostname: null, action: null },
    ]);
  } finally { logger.mock.restore(); }
});

test('production verification does not emit local diagnostics or change validation', async () => {
  const logger = mock.method(console, 'info', () => {});
  try {
    assert.equal(await verifyPromoToken('token', request(), env, async () => Response.json({ ...valid, action: 'test' })), 'invalid');
    assert.equal(logger.mock.callCount(), 0);
  } finally { logger.mock.restore(); }
});


const officialLocalTest = {
  TURNSTILE_SITE_KEY: '3x00000000000000000000FF',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  TURNSTILE_EXPECTED_ACTION: 'test', SITE_URL: 'http://localhost:4200',
};
const syntheticTestResult = { success: true, 'error-codes': [], hostname: 'example.com', action: null };

for (const siteKey of ['1x00000000000000000000AA', '3x00000000000000000000FF']) {
test(`official local synthetic response with ${siteKey} is accepted only after successful Siteverify`, async () => {
  const bindings = { ...officialLocalTest, TURNSTILE_SITE_KEY: siteKey };
  // Deliberately unrelated request hostname: local mode comes only from bindings.
  const localRequest = new Request('https://untrusted-request.example/api/promo-signup');
  for (const action of [null, undefined]) {
    let calls = 0;
    assert.equal(await verifyPromoToken('test-token', localRequest, bindings, async (url, options) => {
      calls++;
      assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      assert.equal(JSON.parse(options.body).response, 'test-token');
      return Response.json({ ...syntheticTestResult, action });
    }), 'valid');
    assert.equal(calls, 1);
  }
  for (const success of [false, 'true', 1, null]) {
    assert.equal(await verifyPromoToken('token', localRequest, bindings,
      async () => Response.json({ ...syntheticTestResult, success })), 'invalid');
  }
  assert.equal(await verifyPromoToken(undefined, localRequest, bindings,
    () => { throw Error('Must not call Siteverify without a token'); }), 'invalid');
  assert.equal(await verifyPromoToken('token', localRequest, bindings,
    async () => { throw Error('Provider unavailable'); }), 'unavailable');
});
}

test('synthetic response allowance requires every local configuration guard and exact dummy context', async () => {
  const localRequest = new Request('http://localhost:8788/api/promo-signup');
  for (const change of [
    { TURNSTILE_SITE_KEY: undefined }, { TURNSTILE_SITE_KEY: 'real-public-key' },
    { TURNSTILE_SECRET_KEY: 'real-secret' }, { TURNSTILE_EXPECTED_ACTION: 'promo_signup' },
    { SITE_URL: undefined }, { SITE_URL: 'https://naisdrinks.com' },
  ]) {
    assert.equal(await verifyPromoToken('token', localRequest, { ...officialLocalTest, ...change },
      async () => Response.json(syntheticTestResult)), 'invalid');
  }
  for (const change of [{ hostname: 'evil.example' }, { action: 'checkout' }, { action: '' }]) {
    assert.equal(await verifyPromoToken('token', localRequest, officialLocalTest,
      async () => Response.json({ ...syntheticTestResult, ...change })), 'invalid');
  }
});

test('production retains strict hostname/action checks including absent and null actions', async () => {
  const production = { ...env, TURNSTILE_SITE_KEY: 'real-public-key',
    TURNSTILE_EXPECTED_ACTION: 'promo_signup', SITE_URL: 'https://naisdrinks.com' };
  assert.equal(await verifyPromoToken('token', request(), production, async () => Response.json(valid)), 'valid');
  for (const response of [syntheticTestResult, { ...valid, hostname: 'example.com' },
    { ...valid, action: 'test' }, { ...valid, action: null },
    { success: true, hostname: valid.hostname }]) {
    assert.equal(await verifyPromoToken('token', request(), production, async () => Response.json(response)), 'invalid');
  }
});
