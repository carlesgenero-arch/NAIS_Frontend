import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import type { PublicOrderSummary } from '../../shared/order-summary';
import type { CartEntry } from '../models/cart.interface';
import { CART_STORAGE_KEY, CartService } from './cart.service';

/** Local acknowledgement only; it never grants payment eligibility or verifies an order. */
@Injectable({ providedIn: 'root' })
export class VerifiedOrderCartService {
  private readonly cart = inject(CartService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  clearOnce(order: PublicOrderSummary, requestedCart: readonly CartEntry[]): void {
    if (!this.browser || order.paymentStatus !== 'paid') return;
    const expected = JSON.stringify(requestedCart);
    if (JSON.stringify(this.cart.entries()) !== expected) return;
    try {
      const storage = window.localStorage;
      const marker = `nais.checkout.cleared.${order.orderNumber}`;
      if (storage.getItem(marker) !== null) return;
      // Another tab may have changed the persisted cart during the lookup.
      const stored = storage.getItem(CART_STORAGE_KEY);
      if (stored !== null && stored !== expected) return;
      // Persist the acknowledgement first. If storage is blocked, preserve the cart.
      storage.setItem(marker, '1');
      if (storage.getItem(marker) !== '1') return;
      this.cart.clearCart();
    } catch { /* Preserve the cart when a durable acknowledgement cannot be stored. */ }
  }
}
