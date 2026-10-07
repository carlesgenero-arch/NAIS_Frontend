import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PromoSignupService } from '../../../services/promo-signup.service';
import { Modal } from '../../../core/shared/modal/modal';
import { PromotionModal } from '../../../services/promotion-modal';

export const PROMOTION_SESSION_KEY = 'nais.promotion.dismissed.v1';

@Component({
  selector: 'app-promotion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './promotion.html',
  styleUrl: './promotion.css',
})
export class Promotion {
  private readonly document = inject(DOCUMENT);
  private readonly modal = viewChild.required(Modal);
  private readonly signup = inject(PromoSignupService);
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
      if (!dismissed) this.modal().open();
    });
  }
  open(): void {
    this.result.set(null);
    this.error.set('');
    this.modal().open();
  }


  protected dismiss(): void {
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
    this.pending.set(true);
    const result = await this.signup.register(email);
    if (this.destroyRef.destroyed) return;
    this.pending.set(false);
    if (result === 'registered' || result === 'already_registered') {
      this.modal().focusClose();
      this.result.set(result);
      this.form.reset();
      this.remember();
    } else if (result === 'invalid_email') {
      this.form.controls.email.setErrors({ email: true });
    } else {
      this.error.set('No hem pogut confirmar el registre. Torna-ho a provar més tard.');
    }
  }

  private remember(): void {
    try {
      this.document.defaultView?.sessionStorage.setItem(PROMOTION_SESSION_KEY, '1');
    } catch { /* Never prevent closing or submitting when storage is unavailable. */ }
  }
}
