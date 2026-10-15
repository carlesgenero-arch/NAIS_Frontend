import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { TurnstileService, type TurnstileHandle } from '../../../services/turnstile.service';
import { TranslationService } from '../../../i18n/translation.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';

@Component({
  selector: 'app-promo-turnstile',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #container [attr.aria-label]="'promo.verification.label' | t"></div>
    @if (unavailable()) {
      <p role="status">{{ 'promo.verification.error' | t }}</p>
      <button type="button" (click)="retry()">{{ 'ui.tornar_ho_a_provar' | t }}</button>
    }`,
  styleUrl: './promo-turnstile.css',
})
export class PromoTurnstile {
  readonly tokenChange = output<string>();
  protected readonly unavailable = signal(false);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly service = inject(TurnstileService);
  private readonly i18n = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private handle?: TurnstileHandle;
  private mounting = false;

  constructor() {
    afterNextRender(() => void this.mount());
    this.destroyRef.onDestroy(() => this.handle?.destroy());
  }

  reset(): void {
    this.tokenChange.emit('');
    this.handle?.reset();
  }

  protected retry(): void {
    this.unavailable.set(false);
    if (this.handle) this.reset(); else void this.mount();
  }

  private async mount(): Promise<void> {
    if (this.mounting) return;
    this.mounting = true;
    try {
      const handle = await this.service.mount(this.container().nativeElement, this.i18n.language(),
        value => {
          if (!this.destroyRef.destroyed) {
            if (value) this.unavailable.set(false);
            this.tokenChange.emit(value);
          }
        },
        () => { if (!this.destroyRef.destroyed) this.unavailable.set(true); });
      if (this.destroyRef.destroyed) handle.destroy(); else this.handle = handle;
    } catch {
      if (!this.destroyRef.destroyed) this.unavailable.set(true);
    } finally { this.mounting = false; }
  }
}
