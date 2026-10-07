import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import { requireAdmin } from './admin/admin-auth.ts';
import { onRequest as session } from '../functions/api/admin/session.ts';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test' }] });
const env = { ACCESS_TEAM_DOMAIN: 'https://nais-test.cloudflareaccess.com', ACCESS_AUD: 'test-audience', ADMIN_EMAILS: 'owner@example.test' };
async function token(overrides = {}, issuer = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD) {
  return new SignJWT({ email: 'owner@example.test', type: 'app', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setSubject('test-user')
    .setIssuedAt().setIssuer(issuer).setAudience(aud).setExpirationTime('5m').sign(privateKey);
}
async function run(jwt, bindings = env, method = 'GET', origin, path = '/api/admin/session') {
  let calls = 0;
  const context = { request: new Request(`https://nais.example${path}`, { method,
    headers: { ...(jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {}), ...(origin ? { Origin: origin } : {}) } }),
    env: bindings, data: {}, next: async () => { calls++; return session(context); } };
  const response = await requireAdmin(context, () => jwks);
  return { response, calls };
}
test('missing JWT returns 401 without reaching any admin handler', async () => {
  for (const path of ['/api/admin/session', '/api/admin/future/orders']) {
    const { response, calls } = await run(null, env, 'GET', undefined, path);
    assert.equal(response.status, 401); assert.equal(calls, 0);
  }
});
test('valid signed identity + allowlist grants minimal session, no-store', async () => {
  const { response, calls } = await run(await token());
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.deepEqual(await response.json(), { role: 'admin' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('authenticated user outside allowlist returns 403', async () => {
  const { response, calls } = await run(await token({ email: 'other@example.test' }));
  assert.equal(response.status, 403); assert.equal(calls, 0);
});
test('malformed, wrong issuer/audience, expired and service identities fail closed', async () => {
  const expired = await new SignJWT({ email: 'owner@example.test', type: 'app' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setSubject('user').setIssuedAt()
    .setIssuer(env.ACCESS_TEAM_DOMAIN).setAudience(env.ACCESS_AUD).setExpirationTime(1).sign(privateKey);
  for (const jwt of ['bad', await token({}, 'https://other.cloudflareaccess.com'), await token({}, env.ACCESS_TEAM_DOMAIN, 'wrong'), expired, await token({ type: 'service' })]) {
    const { response, calls } = await run(jwt);
    assert.equal(response.status, 401); assert.equal(calls, 0);
  }
});
test('forged email header cannot authenticate', async () => {
  const response = await requireAdmin({ request: new Request('https://nais.example/api/admin/session', { headers: { 'Cf-Access-Authenticated-User-Email': 'owner@example.test' } }), env, data: {}, next: async () => { throw Error('must not run'); } });
  assert.equal(response.status, 401);
});
test('missing configuration fails safely without exposing values', async () => {
  for (const missing of Object.keys(env)) {
    const { response, calls } = await run(await token(), { ...env, [missing]: '' });
    assert.equal(response.status, 503); assert.equal(calls, 0);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
  }
});
test('future writes require same origin in addition to authentication', async () => {
  for (const origin of [undefined, 'https://attacker.example']) {
    const { response, calls } = await run(await token(), env, 'POST', origin);
    assert.equal(response.status, 403); assert.equal(calls, 0);
  }
  const { response, calls } = await run(await token(), env, 'POST', 'https://nais.example');
  assert.equal(calls, 1); assert.equal(response.status, 405);
});
test('key service failure and downstream failures never leak details', async () => {
  const context = { request: new Request('https://nais.example/api/admin/session', { headers: { 'Cf-Access-Jwt-Assertion': await token() } }), env, data: {}, next: async () => { throw Error('private'); } };
  const failed = await requireAdmin(context, () => { throw Error('private'); });
  assert.equal(failed.status, 401);
  const response = await requireAdmin(context, () => jwks);
  assert.equal(response.status, 500); assert.deepEqual(await response.json(), { status: 'unavailable' });
});
test('tampered signature is rejected', async () => {
  const jwt = await token();
  const [header, payload, signature] = jwt.split('.');
  const forged = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
  const { response, calls } = await run(forged);
  assert.equal(response.status, 401); assert.equal(calls, 0);
});
test('Pages middleware denies unauthenticated requests before calling next', async () => {
  const { onRequest } = await import('../functions/api/admin/_middleware.ts');
  const response = await onRequest({ request: new Request('https://nais.example/api/admin/future'), env, data: {}, next: async () => { throw Error('unprotected'); } });
  assert.equal(response.status, 401);
});
