/** Private Worker service binding; Pages does not support native ratelimit bindings. */
export interface CheckoutRateLimiterService {
  fetch(request: Request): Promise<Response>;
}

function response(status: number, result: string): Response {
  return Response.json({ status: result }, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}

/** Called only by the checkout HTTP adapter, before catalogue access or Stripe. */
export async function enforceCheckoutRateLimit(request: Request,
  service?: CheckoutRateLimiterService): Promise<Response | null> {
  if (request.method !== 'POST') return null;
  if (!service) return response(503, 'unavailable');
  try {
    // Cloudflare supplies cf metadata and overwrites CF-Connecting-IP at the public edge.
    // Ordinary HTTP headers alone (including X-Forwarded-For) never establish client identity.
    const edge = (request as Request & { cf?: unknown }).cf;
    const candidate = edge && typeof edge === 'object' ? request.headers.get('CF-Connecting-IP') : null;
    const ip = candidate && candidate.length <= 45 && /^[0-9a-fA-F:.]+$/.test(candidate) ? candidate : null;
    // Missing trusted identity shares a conservative bucket, including local development.
    const key = `checkout:${ip ?? 'anonymous'}`;
    const result = await service.fetch(new Request('https://checkout-rate-limiter.internal/limit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }), signal: AbortSignal.timeout(5000),
    }));
    if (result.status === 429) return response(429, 'rate_limited');
    if (result.status !== 204) return response(503, 'unavailable');
    return null;
  } catch { return response(503, 'unavailable'); }
}
