import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../../../models/product.interface';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: {
    '[class.catalogue]': "presentation() === 'catalogue'",
    '[class.product-card--reveal]': 'revealEnabled()',
    '[class.product-card--revealed]': 'revealed()',
    '(focusin)': 'reveal()',
  },
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly presentation = input<'editorial' | 'catalogue'>('editorial');
  readonly scrollReveal = input(false);
  protected readonly revealEnabled = signal(false);
  protected readonly revealed = signal(false);
  private observer?: IntersectionObserver;

  readonly addRequested = output<Product>();
  protected readonly addLabel = computed(() => `Afegir ${this.product().name} al carret`);
  protected readonly imageAlt = computed(() => this.product().imageAlt ?? `${this.product().name} can`);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // Progressive enhancement: SSR and browsers without observation keep content visible.
      if (!this.scrollReveal() || this.presentation() !== 'editorial'
        || typeof IntersectionObserver === 'undefined'
        || typeof window.matchMedia !== 'function'
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) this.reveal();
      }, { threshold: 0.1 });
      this.revealEnabled.set(true);
      this.observer.observe(element);
    });
    destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  protected reveal(): void {
    if (!this.revealEnabled()) return;
    this.revealed.set(true);
    this.observer?.disconnect();
  }
}
