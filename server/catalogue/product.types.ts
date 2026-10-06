/** Backend catalogue types; no Angular dependency. */
export type ProductStatus = 'active' | 'coming-soon' | 'draft' | 'archived';

/** Validated projection of stored product data, without Stripe identifiers. */
export interface CatalogueProduct {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProductStatus;
  readonly priceCents: number;
  readonly currency: string;
  readonly imageUrl: string | null;
  readonly featureImageUrl: string | null;
}

export type PublicCatalogueProduct = CatalogueProduct & { readonly status: 'active' };

/** Validated server-only checkout configuration. */
export interface PurchasableProduct {
  readonly id: string;
  readonly status: 'active';
  readonly stripePriceId: string;
  readonly priceCents: number;
  readonly currency: 'eur';
}
