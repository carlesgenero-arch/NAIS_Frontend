import { ResponsiveImage } from '../../../core/images/responsive-image.directive';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { Product } from '../../../models/product.interface';

@Component({
  selector: 'app-assorted-pack-promotion',
  imports: [ResponsiveImage, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assorted-pack-promotion.html',
  styleUrl: './assorted-pack-promotion.css',
})
export class AssortedPackPromotion {
  readonly product = input.required<Product>();
  protected readonly revealEnabled = signal(false);
  protected readonly revealed = signal(false);
  private readonly botanicals = viewChild.required<ElementRef<HTMLElement>>('botanicals');
  private observer?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      // Progressive enhancement: static content when motion or observation is unavailable.
      if (typeof IntersectionObserver === 'undefined' || typeof window.matchMedia !== 'function'
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.2)) {
          this.revealed.set(true);
          this.observer?.disconnect();
        }
      }, { threshold: 0.2 });
      this.revealEnabled.set(true);
      this.observer.observe(this.botanicals().nativeElement);
    });
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }
}
