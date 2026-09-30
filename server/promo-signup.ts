/** Minimal D1 contract: implemented by the Pages PROMO_DB binding. */
export interface PromoDatabase {
  prepare(sql: string): {
    bind(email: string): {
      run(): Promise<{ success: boolean; meta: { changes: number } }>;
    };
  };
}

export interface PromoEnvironment {
  PROMO_DB?: PromoDatabase;
}

const MAX_BODY_BYTES = 2048;

function response(status: number, result: string): Response {
  return Response.json({ status: result }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      ...(status === 405 ? { Allow: 'POST' } : {}),
    },
  });
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !/^[a-z0-9._%+-]+$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  const labels = domain.split('.');
  if (labels.length < 2 || !/^[a-z]{2,}$/.test(labels[labels.length - 1])) return null;
  if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return email;
}

async function readPayload(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function promoSignup(request: Request, env: PromoEnvironment): Promise<Response> {
  if (request.method !== 'POST') return response(405, 'method_not_allowed');
  // No cross-origin browser submissions; no CORS permission is exposed.
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return response(403, 'forbidden');
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return response(415, 'invalid_payload');
  }
  let payload: unknown;
  try { payload = await readPayload(request); }
  catch { return response(400, 'invalid_payload'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return response(400, 'invalid_payload');
  const fields = payload as Record<string, unknown>;
  // Reject client-supplied eligibility flags rather than persisting them.
  if (Object.keys(fields).length !== 1 || !Object.hasOwn(fields, 'email')) return response(400, 'invalid_payload');
  const email = normalizeEmail(fields['email']);
  if (!email) return response(400, 'invalid_email');
  if (!env.PROMO_DB) return response(503, 'unavailable');
  try {
    // Uniqueness check and registration are one atomic write, never SELECT then INSERT.
    const result = await env.PROMO_DB.prepare(
      "INSERT INTO promo_signups (email) VALUES (?1) ON CONFLICT(email) DO NOTHING",
    ).bind(email).run();
    if (!result.success) return response(503, 'unavailable');
    if (result.meta.changes === 0) return response(200, 'already_registered');
    if (result.meta.changes !== 1) return response(503, 'unavailable');
    // This durable pending row is the future delivery entitlement. No email/code is sent yet.
    return response(201, 'registered');
  } catch {
    // Never return SQL, binding details or email addresses to the client or logs.
    return response(503, 'unavailable');
  }
}
