import { Component, inject } from '@angular/core';
import { BrandMessageCard } from '../../../core/shared/page/brand-message-card/brand-message-card';
import { Hero } from '../../../core/shared/page/hero/hero';
import { InfoCard, type InfoCardContent } from '../../../core/shared/page/info-card/info-card';
import { ProductCard } from '../../../core/shared/page/product-card/product-card';
import { ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-home-page',
  imports: [Hero, InfoCard, ProductCard, BrandMessageCard],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css'
})
export class HomePage {
  protected readonly products = inject(ProductService).products;
  protected readonly infoCards: readonly InfoCardContent[] = [
    {
      text: 'Sense sucres afegits ni edulcorants',
      colour: 'pink',
      image: { src: 'images/info-card/gingebre.png', alt: 'Arrel de gingebre sobre un fons rosa' },
    },
    {
      text: 'Lleugerament carbonatada',
      colour: 'blue',
      image: { src: 'images/info-card/raspberries (1).png', alt: 'Gerds sobre un fons blau' },
    },
    {
      text: 'Sense filtrar',
      colour: 'green',
      image: { src: 'images/info-card/mint.png', alt: 'Fulles de menta sobre un fons verd' },
    },
  ];
}

