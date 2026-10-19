export interface TurnstileEnvironment {
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_ACTION?: string;
  SITE_URL?: string;
}

/** Temporary local Wrangler diagnostics; never log the complete provider response. */
function logLocalVerification(request: Request, value: unknown = null): void {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)) return;
  const fields = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const knownErrors = new Set(['missing-input-secret', 'invalid-input-secret', 'missing-input-response',
    'invalid-input-response', 'bad-request', 'timeout-or-duplicate', 'internal-error']);
  console.info(JSON.stringify({
    success: typeof fields['success'] === 'boolean' ? fields['success'] : null,
    'error-codes': Array.isArray(fields['error-codes'])
      ? fields['error-codes'].slice(0, 10).map(code => knownErrors.has(code) ? code : 'unknown-error') : [],
    hostname: typeof fields['hostname'] === 'string' && /^[a-zA-Z0-9.-]{1,253}$/.test(fields['hostname'])
      ? fields['hostname'] : null,
    action: typeof fields['action'] === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(fields['action'])
      ? fields['action'] : null,
  }));
}

/** Never forward email, client flags, provider response bodies or optional IP data. */
export async function verifyPromoToken(token: unknown, request: Request, env: TurnstileEnvironment,
  send: typeof fetch = fetch): Promise<'valid' | 'invalid' | 'unavailable'> {
  if (!env.TURNSTILE_SECRET_KEY?.trim()) return 'unavailable';
  const expectedAction = env.TURNSTILE_EXPECTED_ACTION ?? 'promo_signup';
  // Explicit, server-owned configuration; no wildcard or empty-action acceptance.
  if (expectedAction !== 'promo_signup' && expectedAction !== 'test') return 'unavailable';
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
    logLocalVerification(request);
    return 'invalid';
  }
  try {
    const hosts = new Set([new URL(request.url).hostname]);
    if (env.SITE_URL) hosts.add(new URL(env.SITE_URL).hostname);
    const response = await send('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY.trim(), response: token }),
    });
    if (!response.ok) return 'unavailable';
    const value: unknown = await response.json();
    logLocalVerification(request, value);
    if (!value || typeof value !== 'object' || !('success' in value)) return 'unavailable';
    // Official dummy credentials return synthetic context. Enable
    // only from server-owned local configuration, never request headers/host/token.
    const localDummy = expectedAction === 'test'
      && (env.TURNSTILE_SITE_KEY === '3x00000000000000000000FF'
        || env.TURNSTILE_SITE_KEY === '1x00000000000000000000AA')
      && env.TURNSTILE_SECRET_KEY.trim() === '1x0000000000000000000000000000000AA'
      && !!env.SITE_URL && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.SITE_URL).hostname);
    if (localDummy && value.success === true && 'hostname' in value && value.hostname === 'example.com'
      && (!('action' in value) || value.action === null)) return 'valid';
    return value.success === true && 'action' in value && value.action === expectedAction
      && 'hostname' in value && typeof value.hostname === 'string' && hosts.has(value.hostname)
      ? 'valid' : 'invalid';
  } catch { return 'unavailable'; }
}
