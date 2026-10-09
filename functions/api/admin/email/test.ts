import type { AdminContext } from '../../../../server/admin/admin-auth.ts';
import { sendEmail } from '../../../../server/email/email.service.ts';
import type { EmailDiagnostic, EmailEnvironment, EmailException } from '../../../../server/email/email.types.ts';

interface EmailTestContext extends AdminContext {
  env: AdminContext['env'] & EmailEnvironment & { EMAIL_TEST_TO?: string };
}

/** Temporary smoke test. Parent admin middleware verifies JWT, allowlist and Origin. */
export async function onRequest({ request, env, data }: EmailTestContext): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  if (!data.admin) return Response.json({ status: 'unauthenticated' }, { status: 401, headers });
  if (request.method !== 'POST') {
    return Response.json({ status: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'POST' } });
  }
  if (!env.EMAIL_TEST_TO?.trim()) return Response.json({ status: 'unavailable', diagnostic: 'not_configured' }, { status: 503, headers });
  let diagnostic: EmailDiagnostic = 'unexpected_error';
  let exception: EmailException | undefined;
  // Deliberately never read the body: recipients and content are entirely server controlled.
  const result = await sendEmail({
    to: env.EMAIL_TEST_TO,
    subject: 'NAIS email test',
    html: '<p>Email infrastructure is working correctly.</p>',
    text: 'Email infrastructure is working correctly.',
  }, env, undefined, (category, name) => { diagnostic = category; exception = name; });
  return result.ok
    ? Response.json({ status: 'accepted' }, { status: 200, headers })
    : Response.json({ status: 'unavailable', diagnostic, ...(exception ? { exception } : {}) }, { status: 503, headers });
}
