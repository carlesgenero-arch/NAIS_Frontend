export type ProductVariant = 'neutral' | 'citrus' | 'botanical' | 'ginger';

export interface Product {
    id: string;
  name: string;
  price?: number;
  format?: string;
  nutrition?: readonly { readonly label: string; readonly value: string }[];
  description: string;
  imageUrl: string;
  imageAlt?: string;
  fruitImage?: { url: string; alt: string };
  ingredients?: string;
  variant?: ProductVariant;
  purchaseUrl?: string;
  colorHex?: string; 
}

export interface CartItem {
  product: Product;
  quantity: number;
}
