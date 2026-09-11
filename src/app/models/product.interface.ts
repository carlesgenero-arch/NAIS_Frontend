export type ProductVariant = 'neutral' | 'citrus';

export interface Product {
    id: string;
  name: string;
  price?: number;
  description: string;
  imageUrl: string;
  imageAlt?: string;
  ingredients?: string;
  variant?: ProductVariant;
  purchaseUrl?: string;
  colorHex?: string; 
}

export interface CartItem {
  product: Product;
  quantity: number;
}
