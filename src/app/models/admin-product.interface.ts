import type { Product } from './product.interface';
/** Read-only projection of the protected admin response. */
export interface AdminProductSummary extends Pick<Product, 'id' | 'slug' | 'name' | 'status'> {
  readonly priceCents: number;
  readonly currency: string;
  readonly stripeProductId: string | null;
  readonly stripePriceId: string | null;
  readonly updatedAt: string;
}
export interface AdminProductDetail extends AdminProductSummary {
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly featureImageUrl: string | null;
}
export type AdminProductInput = Pick<AdminProductDetail,
  'slug' | 'name' | 'description' | 'status' | 'priceCents' | 'currency' | 'imageUrl' | 'featureImageUrl'>;
