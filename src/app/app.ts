import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './core/shared/base/header/header';
import { Hero } from './core/shared/page/hero/hero';
import { InfoCard, type InfoCardContent } from './core/shared/page/info-card/info-card';
import { BrandMessageCard } from './core/shared/page/brand-message-card/brand-message-card';
import { ProductCard } from './core/shared/page/product-card/product-card';
import { ProductService } from './services/product.service';

@Component({
  selector: 'app-root',
  imports: [Header, Hero, InfoCard, BrandMessageCard, ProductCard, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly products = inject(ProductService).products;
  protected readonly infoCards: readonly InfoCardContent[] = [
    {
      text: 'Sense sucres afegits ni edulcorants',
      colour: 'pink',
    },
    {
      text: 'lleugerament carbonatada',
      colour: 'blue',
    },
    {
      text: 'sense filtrar',
      colour: 'green',
    },
  ];
  protected readonly title = signal('nais_frontend');
}
