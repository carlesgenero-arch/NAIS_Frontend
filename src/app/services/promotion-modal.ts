import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export const PROMOTION_PURCHASE_KEY = 'nais.promotion.purchase-confirmed.v1';

@Injectable({
  providedIn: 'root',
})
export class PromotionModal {
  private opener?: () => void;
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly suppressed = signal(false);
  readonly purchaseSuppressed = this.suppressed.asReadonly();

  constructor() {
    if (this.browser) {
      try {
        this.suppressed.set(this.document.defaultView?.localStorage.getItem(PROMOTION_PURCHASE_KEY) === '1');
      } catch { /* Optional UI preference; backend promotion eligibility is independent. */ }
    }
  }

  /** Called only after the order lookup confirms a paid order. Stores no order data. */
  suppressAfterPurchase(): void {
    this.suppressed.set(true);
    if (this.browser) {
      try {
        this.document.defaultView?.localStorage.setItem(PROMOTION_PURCHASE_KEY, '1');
      } catch { /* Still suppress in memory when storage is unavailable. */ }
    }
  }

  register(opener: () => void): void {
    this.opener = opener;
  }

  open(): void {
    if (!this.purchaseSuppressed()) this.opener?.();
  }
  
}
