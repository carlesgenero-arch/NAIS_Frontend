import { CA } from '../../../i18n/ca';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { Component, computed, inject } from '@angular/core';
import { BrandMessageCard } from '../../../core/shared/page/brand-message-card/brand-message-card';
import { Hero } from '../../../core/shared/page/hero/hero';
import { InfoCard, type InfoCardContent } from '../../../core/shared/page/info-card/info-card';
import { ProductCard } from '../../../core/shared/page/product-card/product-card';
import { ProductFeatureCard } from '../../../core/shared/page/product-feature-card/product-feature-card';
import { MediaCarousel } from '../../../core/shared/page/media-carousel/media-carousel';
import { homeCarouselImages } from './home-carousel-images';
import { ProductService } from '../../../services/product.service';
import { AnimatedBanner } from '../../../core/shared/page/animated-banner/animated-banner';

@Component({
  selector: 'app-home-page',
  imports: [TranslatePipe, Hero, InfoCard, ProductCard, ProductFeatureCard, BrandMessageCard, MediaCarousel, AnimatedBanner],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css'
})
export class HomePage {
  protected readonly carouselImages = homeCarouselImages;
  protected readonly catalogue = inject(ProductService);
  protected readonly featuredProducts = computed(() => this.catalogue.activeProducts.filter(
    product => product.isFeatured || product.isSeasonal));
  protected readonly products = computed(() => this.catalogue.activeProducts.filter(
    product => product.variant !== 'assorted' && !product.isFeatured && !product.isSeasonal));
  protected readonly infoCards: readonly InfoCardContent[] = [
    {
      text: CA['ui.sense_sucres_afegits_ni_edulcorants'],
      colour: 'pink',
      image: { src: 'images/info-card/gingebre.png', alt: CA['ui.arrel_de_gingebre_sobre_un_fons_rosa'] },
    },
    {
      text: CA['ui.lleugerament_carbonatada'],
      colour: 'blue',
      image: { src: 'images/info-card/raspberries (1).png', alt: CA['ui.gerds_sobre_un_fons_blau'] },
    },
    {
      text: CA['ui.sense_filtrar'],
      colour: 'green',
      image: { src: 'images/info-card/mint.png', alt: CA['ui.fulles_de_menta_sobre_un_fons_verd'] },
    },
  ];
}

