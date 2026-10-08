import { adminProductWrite, type AdminProductWriteContext } from '../../../../../server/admin/admin-product-write.ts';
export const onRequest = (context: AdminProductWriteContext): Promise<Response> => adminProductWrite(context, 'archive');
