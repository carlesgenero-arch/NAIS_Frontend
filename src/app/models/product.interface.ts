export type ProductVariant = 'neutral' | 'citrus' | 'botanical' | 'ginger' | 'tropical' | 'assorted';

export interface Product {
  id: string;
  slug: string;
  name: string;
  price?: number;
  format?: string;
  nutrition?: readonly { readonly label: string; readonly value: string }[];
  description: string;
  imageUrl?: string;
  cardImageUrl?: string;
  imageAlt?: string;
  fruitImage?: { url: string; alt: string };
  ingredients?: string;
  detailsPending?: boolean;
  isSeasonal?: boolean;
  isFeatured?: boolean;
  badge?: string;
  featureDescription?: string;
  featureImageUrl?: string;
  featureImageAlt?: string;
  featureBackgroundImageUrl?: string;
  variant?: ProductVariant;
  purchaseUrl?: string;
  colorHex?: string; 
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type AddProductRequest = {
  product: Product;
  quantity: number;
};
