import { ChangeDetectionStrategy, Component } from '@angular/core';

export interface LandingAsset {
  readonly src: string;
  readonly alt: string;
  readonly type: 'product' | 'brand' | 'logo';
}

@Component({
  selector: 'app-prelaunch-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prelaunch-landing.html',
  styleUrl: './prelaunch-landing.css',
})
export class PrelaunchLanding {
  protected readonly assets: readonly LandingAsset[] = [
 
    {
      src: 'images/carousel/friends-toasting.jpeg',
      alt: 'Diverses persones brinden amb llaunes de NAIS Drinks',
      type: 'brand',
    },
    {
      src: 'images/carousel/orange-spritz-on-ice.jpeg',
      alt: 'Llauna d’Orange Spritz sobre glaçons de gel',
      type: 'brand',
    },
    {
      src: 'images/carousel/drinking-ginger-crush.jpeg',
      alt: 'Llauna de NAIS Passion Hugo amb il·lustracions verdes de fruita',
      type: 'brand',
    },
    {
      src: 'images/carousel/offering-orange-spritz.jpeg',
      alt: 'Llaunes de Ginger Crush, Passion Hugo i Orange Spritz sobre un mur',
      type: 'brand',
    },
    {
      src: 'images/brand/nais-logo.svg',
      alt: 'NAIS Drinks',
      type: 'logo',
    },
    {
      src: 'images/hero/nais-fruit-sodas.jpeg',
      alt: 'Llauna de NAIS Orange Spritz amb il·lustracions blaves de fruita',
      type: 'brand',
    },
  ];
}
