import { Injectable } from '@angular/core';
import { Product } from '../models/product.interface';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  readonly products: readonly Product[] = [
    {
      id: 'orange-spritz',
      name: 'ORANGE SPRITZ',
      description: 'AFRUITADA AMB CON UN TOC AMARG MEMORABLE. CARÀCTER NATURAL A CADA GLOP',
      ingredients: 'Taronja, Llimona, Gerds, Arrel de genciana',
      imageUrl: 'images/products/nais_can_blue.png',
      imageAlt: 'NAIS Orange Spritz can with blue fruit artwork',
      variant: 'citrus',
      purchaseUrl: '/shop',
    },
    {
      id: 'passion-hugo',
      name: 'PASSION HUGO',
      description: 'ÀCIDA, SILVESTRE I APASSIONADA. PURA NATURALESA SERVIDA BEN FREDA',
      ingredients: 'Llimona, Menta, Flor de saüc, Poma, Fruita de la passió',
      imageUrl: 'images/products/nais_can_green.png',
      imageAlt: 'NAIS Passion Hugo can with green fruit artwork',
      variant: 'botanical',
      purchaseUrl: '/shop',
    },
    {
      id: 'ginger-mango',
      name: 'GINGER MANGO',
      description: 'AFRUITADA AMB CON UN TOC AMARG MEMORABLE. CARÀCTER NATURAL A CADA GLOP',
      ingredients: 'Llimona, Poma, Gingebre, Mango',
      imageUrl: 'images/products/nais_can_pink.png',
      imageAlt: 'NAIS can with pink fruit artwork and a Ginger Crush label',
      variant: 'ginger',
      purchaseUrl: '/shop',
    },
  ];
}
