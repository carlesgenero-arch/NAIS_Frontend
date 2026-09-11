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
  ];
}
