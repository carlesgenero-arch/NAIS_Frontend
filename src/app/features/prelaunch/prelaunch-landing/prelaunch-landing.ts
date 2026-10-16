import { LegalNavigation } from '../../legal/legal-navigation';
import { CA } from '../../../i18n/ca';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

export interface LandingAsset {
  readonly src: string;
  readonly alt: string;
  readonly type: 'product' | 'brand' | 'logo';
}

@Component({
  imports: [TranslatePipe, LegalNavigation],
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
      alt: CA['ui.diverses_persones_brinden_amb_llaunes_de_nais_drinks'],
      type: 'brand',
    },
    {
      src: 'images/carousel/orange-spritz-on-ice.jpeg',
      alt: CA['ui.llauna_dorange_spritz_sobre_glacons_de_gel'],
      type: 'brand',
    },
    {
      src: 'images/carousel/drinking-ginger-crush.jpeg',
      alt: CA['ui.una_persona_amb_ulleres_de_sol_beu_una_llauna_de_ginger_crush'],
      type: 'brand',
    },
    {
      src: 'images/carousel/offering-orange-spritz.jpeg',
      alt: CA['ui.una_persona_mostra_una_llauna_de_nais_orange_spritz'],
      type: 'brand',
    },
    {
      src: 'images/brand/nais-logo.svg',
      alt: 'NAIS Drinks',
      type: 'logo',
    },
    {
      src: 'images/hero/nais-fruit-sodas.jpeg',
      alt: CA['ui.llaunes_de_passion_hugo_orange_spritz_i_ginger_crush_sobre_un_fons_blau'],
      type: 'brand',
    },
    
  ];
}
