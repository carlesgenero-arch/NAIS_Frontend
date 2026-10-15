export interface TurnstileEnvironment {
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_ACTION?: string;
  SITE_URL?: string;
}

/** Never forward email, client flags, provider response bodies or optional IP data. */
export async function verifyPromoToken(token: unknown, request: Request, env: TurnstileEnvironment,
  send: typeof fetch = fetch): Promise<'valid' | 'invalid' | 'unavailable'> {
  if (!env.TURNSTILE_SECRET_KEY?.trim()) return 'unavailable';
  const expectedAction = env.TURNSTILE_EXPECTED_ACTION ?? 'promo_signup';
  // Explicit, server-owned configuration; no wildcard or empty-action acceptance.
  if (expectedAction !== 'promo_signup' && expectedAction !== 'test') return 'unavailable';
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) return 'invalid';
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
    if (!value || typeof value !== 'object' || !('success' in value)) return 'unavailable';
    return value.success === true && 'action' in value && value.action === expectedAction
      && 'hostname' in value && typeof value.hostname === 'string' && hosts.has(value.hostname)
      ? 'valid' : 'invalid';
  } catch { return 'unavailable'; }
}
