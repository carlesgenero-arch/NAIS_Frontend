import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './core/shared/base/header/header';
import { Hero } from './core/shared/page/hero/hero';
import { InfoCard, type InfoCardContent } from './core/shared/page/info-card/info-card';
import { BrandMessageCard } from './core/shared/page/brand-message-card/brand-message-card';

@Component({
  selector: 'app-root',
  imports: [Header, Hero, InfoCard, BrandMessageCard, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly infoCards: readonly InfoCardContent[] = [
    {
      text: 'Sense sucres afegits ni edulcorants',
      imageSrc: 'images/info-card/mango.png',
      imageAlt: 'Mango fruit on a pink background',
    },
    {
      text: 'lleugerament carbonatada',
      imageSrc: 'images/info-card/orange.png',
      imageAlt: 'Orange fruit on a blue background',
    },
    {
      text: 'sense filtrar',
      imageSrc: 'images/info-card/lemon.jpg',
      imageAlt: 'Lemon fruit on a green background',
    },
  ];
  protected readonly title = signal('nais_frontend');
}
