import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AdminEnvironment {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
}
export interface AdminIdentity { readonly role: 'admin'; }
export interface AdminContext {
  request: Request;
  env: AdminEnvironment;
  data: { admin?: AdminIdentity };
  next(): Promise<Response>;
}
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function keys(issuer: string): JWTVerifyGetKey {
  let value = keySets.get(issuer);
  if (!value) {
    value = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    keySets.set(issuer, value);
  }
  return value;
}
function reply(status: number, message: string): Response {
  return Response.json({ status: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
/** Access proves identity; our explicit server allowlist grants the admin role.
 * Header presence alone is never trusted. No development bypass.
 */
export async function requireAdmin(context: AdminContext, getKeys = keys): Promise<Response> {
  const token = context.request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) return reply(401, 'unauthenticated');
  const { ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: audience, ADMIN_EMAILS: emails } = context.env;
  if (!domain || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)
    || !audience?.trim() || !emails?.trim()) {
    // Temporary configuration diagnostic: booleans only, never binding or token values.
    console.warn('admin_configuration_unavailable', {
      ACCESS_TEAM_DOMAIN_present: Boolean(domain),
      ACCESS_TEAM_DOMAIN_format_valid: Boolean(domain && /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)),
      ACCESS_AUD_present: Boolean(audience?.trim()),
      ADMIN_EMAILS_present: Boolean(emails?.trim()),
    });
    return reply(503, 'unavailable');
  }
  let email: string;
  try {
    const { payload } = await jwtVerify(token, getKeys(domain), {
      issuer: domain, audience, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat', 'email'],
    });
    if (typeof payload['email'] !== 'string' || typeof payload.sub !== 'string' || !payload.sub
      || payload['type'] !== 'app') return reply(401, 'unauthenticated');
    email = payload['email'].trim().toLowerCase();
  } catch { return reply(401, 'unauthenticated'); }
  const allowed = emails.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(email)) return reply(403, 'forbidden');
  // Future mutations must also be same-origin; never enable wildcard CORS here.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(context.request.method)
    && context.request.headers.get('Origin') !== new URL(context.request.url).origin) {
    return reply(403, 'forbidden');
  }
  context.data.admin = { role: 'admin' };
  try {
    const downstream = await context.next();
    const response = new Response(downstream.body, downstream);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch { return reply(500, 'unavailable'); }
}
