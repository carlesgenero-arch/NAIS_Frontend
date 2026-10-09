import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import { requireAdmin } from './admin/admin-auth.ts';
import { onRequest } from '../functions/api/admin/email/test.ts';

const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test' }] });
const env = {
  ACCESS_TEAM_DOMAIN: 'https://nais-test.cloudflareaccess.com', ACCESS_AUD: 'fixture',
  ADMIN_EMAILS: 'admin@example.test', RESEND_API_KEY: 're_fixture_not_real',
  EMAIL_FROM: 'NAIS <sender@example.test>', EMAIL_TEST_TO: 'recipient@example.test',
};
async function token(email = env.ADMIN_EMAILS) {
  return new SignJWT({ email, type: 'app' }).setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject('fixture').setIssuedAt().setIssuer(env.ACCESS_TEAM_DOMAIN)
    .setAudience(env.ACCESS_AUD).setExpirationTime('5m').sign(privateKey);
}
async function run({ jwt, bindings = env, origin = 'https://nais.example', method = 'POST', body } = {}) {
  const context = {
    request: new Request('https://nais.example/api/admin/email/test', { method, body,
      headers: { ...(jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {}), ...(origin ? { Origin: origin } : {}) } }),
    env: bindings, data: {}, next: () => onRequest(context),
  };
  return requireAdmin(context, () => jwks);
}
function provider(t, status = 200) {
  return t.mock.method(globalThis, 'fetch', async () => Response.json(
    status === 200 ? { id: 'private-provider-id' } : { message: `${env.RESEND_API_KEY} ${env.EMAIL_TEST_TO}` }, { status }));
}
test('email test denies absent, forged and unauthorized JWTs without sending', async t => {
  const fetch = provider(t);
  for (const [jwt, status] of [[undefined, 401], ['forged', 401], [await token('other@example.test'), 403]]) {
    assert.equal((await run({ jwt })).status, status);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
test('email test requires same origin and POST', async t => {
  const fetch = provider(t); const jwt = await token();
  for (const origin of ['', 'https://other.example']) assert.equal((await run({ jwt, origin })).status, 403);
  const response = await run({ jwt, method: 'GET' });
  assert.equal(response.status, 405); assert.equal(response.headers.get('Allow'), 'POST');
  assert.equal(fetch.mock.callCount(), 0);
});
test('missing or invalid server email settings fail generically before provider', async t => {
  const fetch = provider(t); const jwt = await token();
  for (const changes of [
    { EMAIL_TEST_TO: undefined }, { EMAIL_TEST_TO: ' ' }, { EMAIL_TEST_TO: 'invalid' },
    { RESEND_API_KEY: undefined }, { EMAIL_FROM: undefined },
  ]) {
    const response = await run({ jwt, bindings: { ...env, ...changes } });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { status: 'unavailable' });
  }
  assert.equal(fetch.mock.callCount(), 0);
});
test('accepted test uses fixed content and only configured recipient, regardless of body', async t => {
  const fetch = provider(t); const jwt = await token();
  for (const body of [undefined, JSON.stringify({ to: 'attacker@example.test', recipient: 'attacker@example.test', subject: 'override', html: 'override' })]) {
    const response = await run({ jwt, body });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: 'accepted' });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  for (const call of fetch.mock.calls) {
    assert.deepEqual(JSON.parse(call.arguments[1].body), {
      from: env.EMAIL_FROM, to: [env.EMAIL_TEST_TO], subject: 'NAIS email test',
      html: '<p>Email infrastructure is working correctly.</p>', text: 'Email infrastructure is working correctly.',
    });
  }
});
test('provider unavailable returns only safe generic status without logging', async t => {
  provider(t, 500);
  const logs = ['log', 'warn', 'error', 'info', 'debug'].map(name => t.mock.method(console, name, () => {}));
  const response = await run({ jwt: await token() });
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { status: 'unavailable' });
  for (const log of logs) assert.equal(log.mock.callCount(), 0);
});
