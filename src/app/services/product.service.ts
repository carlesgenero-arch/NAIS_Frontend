import { Injectable } from '@angular/core';
import { Product } from '../models/product.interface';

const sharedNutrition: NonNullable<Product['nutrition']> = [
  { label: 'Valor energètic', value: '76 kJ / 18 kcal' },
  { label: 'Greixos', value: '0,1 g' },
  { label: 'dels quals saturats', value: '0 g' },
  { label: 'Hidrats de carboni', value: '5,2 g' },
  { label: 'dels quals sucres', value: '4,8 g' },
  { label: 'Proteïnes', value: '0,1 g' },
  { label: 'Sal', value: '0 g' },
];

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  readonly products: readonly Product[] = [
    {
      id: 'orange-spritz',
      name: 'ORANGE SPRITZ',
      nutrition: sharedNutrition,
      format: 'pack 16 llaunes x 250ml',
      price: 36,
      description: 'Cítrica amb un toc amarg i àcid. Caràcter i puresa a cada glop',
      ingredients: 'TARONJA, LLIMONA, GERDS, ARREL DE GENCIANA',
      imageUrl: 'images/products/nais_can_blue.png',
      imageAlt: 'NAIS Orange Spritz can with blue fruit artwork',
      fruitImage: { url: 'images/info-card/orange.png', alt: 'Orange fruit on a blue background' },
      variant: 'citrus',
      purchaseUrl: '/shop',
    },
    {
      id: 'passion-hugo',
      name: 'PASSION HUGO',
      nutrition: sharedNutrition,
      format: 'pack 16 llaunes x 250ml',
      price: 36,
      description: 'Àcida, silvestre i apassionada. Explosió floral',
      ingredients: 'LLIMONA, MENTA, FLOR DE SAÜC, POMA, FRUITA DE LA PASSIÓ',
      imageUrl: 'images/products/nais_can_green.png',
      imageAlt: 'NAIS Passion Hugo can with green fruit artwork',
      fruitImage: { url: 'images/info-card/lemon.jpg', alt: 'Lemon fruit on a green background' },
      variant: 'botanical',
      purchaseUrl: '/shop',
    },
    {
      id: 'ginger-mango',
      name: 'GINGER MANGO',
      nutrition: sharedNutrition,
      format: 'pack 16 llaunes x 250ml',
      price: 36,
      description: 'Afruitada, tropical i lleugerament especiada. Vibrant i recomfortant',
      ingredients: 'LLIMONA, POMA, GINGEBRE, MANGO',
      imageUrl: 'images/products/nais_can_pink.png',
      imageAlt: 'NAIS can with pink fruit artwork and a Ginger Crush label',
      fruitImage: { url: 'images/info-card/mango.png', alt: 'Mango fruit on a pink background' },
      variant: 'ginger',
      purchaseUrl: '/shop',
    },
  ];
}
