import { CA } from '../../../i18n/ca';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PromoSignupService } from '../../../services/promo-signup.service';
import { Modal } from '../../../core/shared/modal/modal';
import { PromotionModal } from '../../../services/promotion-modal';
import { PromoTurnstile } from './promo-turnstile';

export const PROMOTION_SESSION_KEY = 'nais.promotion.dismissed.v1';

@Component({
  selector: 'app-promotion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Modal, ReactiveFormsModule, PromoTurnstile],
  templateUrl: './promotion.html',
  styleUrl: './promotion.css',
})
export class Promotion {
  private readonly document = inject(DOCUMENT);
  private readonly modal = viewChild.required(Modal);
  private readonly signup = inject(PromoSignupService);
  private readonly challenge = viewChild(PromoTurnstile);
  protected readonly challengeActive = signal(false);
  protected readonly turnstileToken = signal('');
  private readonly destroyRef = inject(DestroyRef);
  private readonly promotionModal = inject(PromotionModal)
  protected readonly result = signal<'registered' | 'already_registered' | null>(null);
  protected readonly pending = signal(false);
  protected readonly error = signal('');
  // Match the existing Newsletter's validation, without its console logging.
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email,
      Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
  });

  constructor() {
    this.promotionModal.register(()=> this.open())
    afterNextRender(() => {
      let dismissed = false;
      try {
        dismissed = this.document.defaultView?.sessionStorage.getItem(PROMOTION_SESSION_KEY) === '1';
      } catch { /* Storage is optional; this component still opens only once per mount. */ }
      if (!dismissed) this.open();
    });
  }
  open(): void {
    if (this.promotionModal.purchaseSuppressed()) return;
    this.result.set(null);
    this.error.set('');
    this.turnstileToken.set('');
    this.modal().open();
    this.challenge()?.reset();
    this.challengeActive.set(true);
  }


  protected dismiss(): void {
    this.challengeActive.set(false);
    this.turnstileToken.set('');
    this.remember();
    this.form.reset();
  }

  protected async submit(): Promise<void> {
    if (this.pending()) return;
    const email = this.form.controls.email.value.trim();
    this.form.controls.email.setValue(email);
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;
    const token = this.turnstileToken();
    if (!token) {
      this.error.set(CA['promo.verification.error']);
      return;
    }
    this.pending.set(true);
    this.turnstileToken.set('');
    const result = await this.signup.register(email, token);
    if (this.destroyRef.destroyed) return;
    this.pending.set(false);
    this.challenge()?.reset();
    if (result === 'registered' || result === 'already_registered') {
      this.modal().focusClose();
      this.result.set(result);
      this.form.reset();
      this.remember();
    } else if (result === 'invalid_email') {
      this.form.controls.email.setErrors({ email: true });
    } else {
      this.error.set(CA['ui.no_hem_pogut_confirmar_el_registre_torna_ho_a_provar_mes_tard']);
    }
  }

  private remember(): void {
    try {
      this.document.defaultView?.sessionStorage.setItem(PROMOTION_SESSION_KEY, '1');
    } catch { /* Never prevent closing or submitting when storage is unavailable. */ }
  }
}
