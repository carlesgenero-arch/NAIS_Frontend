import { adminProductImage, type AdminProductImageContext } from '../../../../../server/admin/admin-product-image.ts';
export const onRequest = (context: AdminProductImageContext): Promise<Response> => adminProductImage(context);
