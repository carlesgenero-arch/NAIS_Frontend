import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

/** Home-only, one-shot progressive enhancement, using the existing observer pattern. */
@Directive({
  selector: '[homeReveal]',
  host: {
    '[class.home-motion-ready]': 'enabled()',
    '[class.home-motion-revealed]': 'revealed()',
    '(focusin)': 'reveal()',
  },
})
export class HomeReveal {
  protected readonly enabled = signal(false);
  protected readonly revealed = signal(false);
  private observer?: IntersectionObserver;

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined' || typeof window.matchMedia !== 'function'
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.3)) this.reveal();
      }, { threshold: 0.3 });
      this.enabled.set(true);
      this.observer.observe(element);
    });
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  protected reveal(): void {
    if (!this.enabled() || this.revealed()) return;
    this.revealed.set(true);
    this.observer?.disconnect();
  }
}
