/** Public widget configuration only. Never serialize environment bindings. */
export function onRequest({ request, env }: { request: Request; env: { TURNSTILE_SITE_KEY?: string } }): Response {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (request.method !== 'GET') return Response.json({ status: 'method_not_allowed' }, {
    status: 405, headers: { ...headers, Allow: 'GET' },
  });
  const siteKey = env.TURNSTILE_SITE_KEY;
  return typeof siteKey === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(siteKey)
    ? Response.json({ siteKey }, { headers })
    : Response.json({ status: 'unavailable' }, { status: 503, headers });
}
