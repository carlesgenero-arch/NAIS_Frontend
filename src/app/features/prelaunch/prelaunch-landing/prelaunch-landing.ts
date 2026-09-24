import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

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
  protected readonly imagesReady = signal(false);
  private readonly settledAssets = new Set<string>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // A stalled image must not keep the composition hidden indefinitely.
      const fallback = setTimeout(() => this.imagesReady.set(true), 8000);
      destroyRef.onDestroy(() => clearTimeout(fallback));
    });
  }

  protected onAssetSettled(src: string): void {
    this.settledAssets.add(src);
    if (this.settledAssets.size === this.assets.length) {
      this.imagesReady.set(true);
    }
  }

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
      alt: 'Una persona amb ulleres de sol beu una llauna de Ginger Crush',
      type: 'brand',
    },
    {
      src: 'images/carousel/offering-orange-spritz.jpeg',
      alt: 'Una persona mostra una llauna de NAIS Orange Spritz',
      type: 'brand',
    },
    {
      src: 'images/brand/nais-logo.svg',
      alt: 'NAIS Drinks',
      type: 'logo',
    },
    {
      src: 'images/hero/nais-fruit-sodas.jpeg',
      alt: 'Llaunes de Passion Hugo, Orange Spritz i Ginger Crush sobre un fons blau',
      type: 'brand',
    },
    
  ];
}
