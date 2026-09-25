import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from '../../../core/shared/modal/modal';

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
  protected readonly submitted = signal(false);
  // Match the existing Newsletter's validation, without its console logging.
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email,
      Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
  });

  constructor() {
    afterNextRender(() => {
      let dismissed = false;
      try {
        dismissed = this.document.defaultView?.sessionStorage.getItem(PROMOTION_SESSION_KEY) === '1';
      } catch { /* Storage is optional; this component still opens only once per mount. */ }
      if (!dismissed) this.modal().open();
    });
  }

  protected dismiss(): void {
    this.remember();
    this.form.reset();
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.modal().focusClose();
    this.submitted.set(true);
    this.form.reset();
    this.remember();
  }

  private remember(): void {
    try {
      this.document.defaultView?.sessionStorage.setItem(PROMOTION_SESSION_KEY, '1');
    } catch { /* Never prevent closing or submitting when storage is unavailable. */ }
  }
}
