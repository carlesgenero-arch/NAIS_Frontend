import { CA } from '../../../i18n/ca';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PromoSignupService, type PromoSignupResult } from '../../../services/promo-signup.service';
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
  protected readonly challengeAttempts = signal<readonly number[]>([]);
  private verificationEmail: string | null = null;
  private attempt = 0;
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
    this.cancelAttempt();
    this.modal().open();

  }


  protected dismiss(): void {
    this.cancelAttempt();
    this.remember();
    this.form.reset();
  }

  protected submit(): void {
    if (this.pending()) return;
    const email = this.form.controls.email.value.trim();
    this.form.controls.email.setValue(email);
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;
    this.pending.set(true);
    this.verificationEmail = email;
    this.challengeAttempts.set([++this.attempt]);
  }

  protected verificationFailed(attempt: number): void {
    if (attempt !== this.attempt || !this.verificationEmail) return;
    this.cancelAttempt();
    this.error.set(CA['promo.verification.error']);
  }

  protected async verified(token: string, attempt: number): Promise<void> {
    if (attempt !== this.attempt || !token || !this.verificationEmail || !this.pending()) return;
    const email = this.verificationEmail;
    this.verificationEmail = null;
    // Remove the completed widget now; keep submission locked until the API returns.
    this.challengeAttempts.set([]);
    let result: PromoSignupResult;
    try { result = await this.signup.register(email, token); }
    catch { result = 'unavailable'; }
    if (this.destroyRef.destroyed || attempt !== this.attempt) return;
    this.pending.set(false);
    this.challengeAttempts.set([]);
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

  private cancelAttempt(): void {
    this.attempt++;
    this.verificationEmail = null;
    this.challengeAttempts.set([]);
    this.pending.set(false);
  }

  private remember(): void {
    try {
      this.document.defaultView?.sessionStorage.setItem(PROMOTION_SESSION_KEY, '1');
    } catch { /* Never prevent closing or submitting when storage is unavailable. */ }
  }
}
