import { requireAdmin, type AdminContext } from '../../../server/admin/admin-auth.ts';
export const onRequest = (context: AdminContext): Promise<Response> => requireAdmin(context);
