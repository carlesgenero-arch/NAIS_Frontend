import { adminRead, type AdminReadContext } from '../../../../server/admin/admin-read.ts';
import { listAdminProducts } from '../../../../server/catalogue/product.service.ts';
export const onRequest = (context: AdminReadContext): Promise<Response> => adminRead(context, listAdminProducts);
