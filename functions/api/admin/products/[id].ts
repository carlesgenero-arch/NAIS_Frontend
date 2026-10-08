import { adminRead, InvalidAdminReadRequest } from '../../../../server/admin/admin-read.ts';
import { getAdminProduct, isProductSlug } from '../../../../server/catalogue/product.service.ts';
import { adminProductWrite, type AdminProductWriteContext } from '../../../../server/admin/admin-product-write.ts';

export const onRequest = (context: AdminProductWriteContext): Promise<Response> =>
  context.request.method === 'PATCH' ? adminProductWrite(context, 'update') : adminRead(context, db => {
  const id = context.params?.id;
  if (!isProductSlug(id)) throw new InvalidAdminReadRequest();
  return getAdminProduct(db, id);
});
