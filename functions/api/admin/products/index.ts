import { adminRead } from '../../../../server/admin/admin-read.ts';
import { listAdminProducts } from '../../../../server/catalogue/product.service.ts';
import { adminProductWrite, type AdminProductWriteContext } from '../../../../server/admin/admin-product-write.ts';
export const onRequest = (context: AdminProductWriteContext): Promise<Response> =>
  context.request.method === 'POST' ? adminProductWrite(context, 'create') : adminRead(context, listAdminProducts);
