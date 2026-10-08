import type { Product } from './product.interface';
/** Read-only projection of the protected admin response. */
export interface AdminProductSummary extends Pick<Product, 'id' | 'slug' | 'name' | 'status'> {
  readonly priceCents: number;
  readonly currency: string;
  readonly stripeProductId: string | null;
  readonly stripePriceId: string | null;
  readonly updatedAt: string;
}
