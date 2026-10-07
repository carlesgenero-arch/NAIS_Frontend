import type { AdminContext } from '../../../server/admin/admin-auth.ts';
export function onRequest({ request, data }: AdminContext): Response {
  if (!data.admin) return Response.json({ status: 'unauthenticated' }, { status: 401 });
  if (request.method !== 'GET') return Response.json({ status: 'method_not_allowed' }, { status: 405, headers: { Allow: 'GET' } });
  return Response.json({ role: data.admin.role });
}
