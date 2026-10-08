import { adminRead, InvalidAdminReadRequest, type AdminReadContext } from '../../../../server/admin/admin-read.ts';
import { getAdminProduct, isProductSlug } from '../../../../server/catalogue/product.service.ts';

export const onRequest = (context: AdminReadContext): Promise<Response> => adminRead(context, db => {
  const id = context.params?.id;
  if (!isProductSlug(id)) throw new InvalidAdminReadRequest();
  return getAdminProduct(db, id);
});
