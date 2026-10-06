/** Public API DTO; money is expressed in integer minor units. */
export interface PublicProduct {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: 'active' | 'coming-soon';
  readonly priceCents: number;
  readonly currency: string;
  readonly imageUrl: string | null;
  readonly featureImageUrl: string | null;
}
