import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sendEmail } from './email/email.service.ts';
import { resendTransport } from './email/resend.transport.ts';

const env = { RESEND_API_KEY: 're_fixture_not_real', EMAIL_FROM: 'NAIS <sender@example.test>' };
const message = { to: 'recipient@example.test', subject: 'Synthetic test', html: '<p>Fixture body</p>' };
const sendWith = (request, email = message, settings = env) => sendEmail(email, settings, (msg, config) => resendTransport(msg, config, request));

for (const field of ['RESEND_API_KEY', 'EMAIL_FROM']) test('missing ' + field + ' fails before transport', async () => {
  const transport = mock.fn();
  for (const value of [undefined, '', '   ']) {
    assert.deepEqual(await sendEmail(message, { ...env, [field]: value }, transport), { ok: false, status: 'not_configured' });
  }
  assert.equal(transport.mock.callCount(), 0);
});
test('invalid sender, reply-to and credential headers fail safely', async () => {
  const transport = mock.fn();
  for (const config of [{ EMAIL_FROM: 'invalid' }, { EMAIL_FROM: 'a@example.test\r\nBcc: x@example.test' },
    { EMAIL_REPLY_TO: 'bad' }, { RESEND_API_KEY: 'secret\nheader' }]) {
    assert.deepEqual(await sendEmail(message, { ...env, ...config }, transport), { ok: false, status: 'not_configured' });
  }
  assert.equal(transport.mock.callCount(), 0);
});
test('successful Resend response is accepted, not a delivery claim', async () => {
  const request = mock.fn(async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails'); assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'manual'); assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    assert.equal(options.headers.Authorization, 'Bearer ' + env.RESEND_API_KEY);
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { from: env.EMAIL_FROM, to: [message.to], subject: message.subject, html: message.html });
    return Response.json({ id: 'email_fixture' });
  });
  assert.deepEqual(await sendWith(request), { ok: true, status: 'accepted' });
  assert.equal(request.mock.callCount(), 1);
});

test('diagnostics are opt-in categories; default service results remain generic', async () => {
  const cases = [
    [message, {}, undefined, 'not_configured'],
    [{ ...message, to: 'bad' }, env, undefined, 'invalid_message'],
    [message, env, async () => { throw Error('private'); }, 'unexpected_error'],
    [message, env, async () => ({ ok: false, status: 'unavailable', diagnostic: 'private arbitrary value' }), 'unexpected_error'],
  ];
  for (const [msg, settings, transport, expected] of cases) {
    const categories = [];
    const result = await sendEmail(msg, settings, transport, category => categories.push(category));
    assert.deepEqual(categories, [expected]);
    assert.equal('diagnostic' in result, false);
  }
});
test('optional text and reply-to precedence use the provider wire contract', async () => {
  const bodies = [];
  const request = async (_url, options) => { bodies.push(JSON.parse(options.body)); return Response.json({ id: 'fixture' }); };
  await sendWith(request, { ...message, text: 'Plain fixture' }, { ...env, EMAIL_REPLY_TO: 'support@example.test' });
  await sendWith(request, { ...message, replyTo: 'override@example.test' }, { ...env, EMAIL_REPLY_TO: 'support@example.test' });
  assert.equal(bodies[0].text, 'Plain fixture'); assert.equal(bodies[0].reply_to, 'support@example.test');
  assert.equal(bodies[1].reply_to, 'override@example.test'); assert.equal(bodies[1].text, undefined);
});
test('invalid messages never reach provider', async () => {
  const transport = mock.fn();
  for (const msg of [null, {}, { ...message, to: 'bad' }, { ...message, to: ['a@example.test'] },
    { ...message, subject: 'x\r\nBcc: y' }, { ...message, html: '' }, { ...message, replyTo: 'bad' }, { ...message, text: 3 }]) {
    assert.deepEqual(await sendEmail(msg, env, transport), { ok: false, status: 'invalid_message' });
  }
  assert.equal(transport.mock.callCount(), 0);
});
test('all provider HTTP errors normalize without revealing body or retrying', async () => {
  for (const status of [400, 401, 403, 429, 500]) {
    const request = mock.fn(async () => Response.json({ message: `${env.RESEND_API_KEY} ${message.to} ${message.html}` }, { status }));
    assert.deepEqual(await sendWith(request), { ok: false, status: 'unavailable' });
    assert.equal(request.mock.callCount(), 1);
  }
});
test('network, timeout and malformed provider successes return generic errors', async () => {
  for (const request of [async () => { throw Error(env.RESEND_API_KEY); },
    async () => { throw new DOMException('private timeout', 'TimeoutError'); },
    async () => new Response('not JSON'), async () => Response.json({}), async () => Response.json({ id: '' })]) {
    assert.deepEqual(await sendWith(request), { ok: false, status: 'unavailable' });
  }
});
test('only allowed message/config fields reach transport and only safe result fields escape', async () => {
  const transport = mock.fn(async (msg, config) => {
    assert.equal('from' in msg, false); assert.equal('bcc' in msg, false);
    assert.equal(config.from, env.EMAIL_FROM);
    return { ok: true, status: 'accepted', providerDetails: env.RESEND_API_KEY };
  });
  assert.deepEqual(await sendEmail({ ...message, from: 'attacker@example.test', bcc: 'hidden@example.test' }, env, transport), { ok: true, status: 'accepted' });
  assert.deepEqual(await sendEmail(message, env, async () => { throw Error(message.html); }), { ok: false, status: 'unavailable' });
});
test('no logging of credentials, recipient or body', async t => {
  const spies = ['log', 'warn', 'error', 'info', 'debug'].map(method => t.mock.method(console, method, () => {}));
  await sendWith(async () => { throw Error(`${env.RESEND_API_KEY} ${message.to} ${message.html}`); });
  await sendWith(async () => Response.json({ id: 'fixture' }));
  for (const spy of spies) assert.equal(spy.mock.callCount(), 0);
});
