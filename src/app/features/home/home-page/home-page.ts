import { Component, inject } from '@angular/core';
import { BrandMessageCard } from '../../../core/shared/page/brand-message-card/brand-message-card';
import { Hero } from '../../../core/shared/page/hero/hero';
import { InfoCard, type InfoCardContent } from '../../../core/shared/page/info-card/info-card';
import { ProductCard } from '../../../core/shared/page/product-card/product-card';
import { ProductFeatureCard } from '../../../core/shared/page/product-feature-card/product-feature-card';
import { MediaCarousel } from '../../../core/shared/page/media-carousel/media-carousel';
import { homeCarouselImages } from './home-carousel-images';
import { ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-home-page',
  imports: [Hero, InfoCard, ProductCard, ProductFeatureCard, BrandMessageCard, MediaCarousel],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css'
})
export class HomePage {
  protected readonly carouselImages = homeCarouselImages;
  private readonly catalogue = inject(ProductService).products;
  protected readonly featuredProducts = this.catalogue.filter(
    product => product.isFeatured || product.isSeasonal);
  protected readonly products = this.catalogue.filter(
    product => product.variant !== 'assorted' && !product.isFeatured && !product.isSeasonal);
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

