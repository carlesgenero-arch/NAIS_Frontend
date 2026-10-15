interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
interface Environment { CHECKOUT_RATE_LIMITER?: RateLimitBinding }

function json(status: number, result: string): Response {
  return Response.json({ status: result }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Service-binding-only Worker: no public routes, credentials, D1, Stripe or customer payloads. */
export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/limit') return json(404, 'not_found');
    if (request.headers.get('Content-Type') !== 'application/json') return json(400, 'invalid_payload');
    if (!env.CHECKOUT_RATE_LIMITER) return json(503, 'unavailable');
    let payload: unknown;
    try {
      const text = await request.text();
      if (text.length > 128) return json(400, 'invalid_payload');
      payload = JSON.parse(text);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)
        || Object.keys(payload).length !== 1 || !('key' in payload) || typeof payload.key !== 'string'
        || !/^checkout:(anonymous|[0-9a-fA-F:.]{1,45})$/.test(payload.key)) return json(400, 'invalid_payload');
    } catch { return json(400, 'invalid_payload'); }
    try {
      const result = await env.CHECKOUT_RATE_LIMITER.limit({ key: (payload as { key: string }).key });
      if (result.success === true) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
      if (result.success === false) return json(429, 'rate_limited');
      return json(503, 'unavailable');
    } catch { return json(503, 'unavailable'); }
  },
};
