import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, output, viewChild } from '@angular/core';
import { TurnstileService, type TurnstileHandle } from '../../../services/turnstile.service';
import { TranslationService } from '../../../i18n/translation.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';

@Component({
  selector: 'app-promo-turnstile',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #container [attr.aria-label]="'promo.verification.label' | t"></div>`,
  styleUrl: './promo-turnstile.css',
})
export class PromoTurnstile {
  readonly verificationFailed = output<void>();
  readonly tokenChange = output<string>();
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

  private async mount(): Promise<void> {
    if (this.mounting) return;
    this.mounting = true;
    try {
      const handle = await this.service.mount(this.container().nativeElement, this.i18n.language(),
        value => {
          if (!this.destroyRef.destroyed) {
            this.tokenChange.emit(value);
          }
        },
        () => { if (!this.destroyRef.destroyed) this.verificationFailed.emit(); });
      if (this.destroyRef.destroyed) handle.destroy(); else {
        this.handle = handle;
        handle.execute();
      }
    } catch {
      if (!this.destroyRef.destroyed) this.verificationFailed.emit();
    } finally { this.mounting = false; }
  }
}
