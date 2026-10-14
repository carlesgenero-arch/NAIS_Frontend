import { TranslationService } from '../../../i18n/translation.service';
import { CA } from '../../../i18n/ca';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, inject, InjectionToken, Injector, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CheckoutService } from '../../../services/checkout.service';
import { RouterLink } from '@angular/router';
import { MAX_CART_QUANTITY } from '../../../models/cart.interface';
import { CartService } from '../../../services/cart.service';
import { Router } from '@angular/router';
import { FREE_SHIPPING_MIN_BOXES, shippingAmountCents } from '../../../../shared/shipping-rules';
import { computed } from '@angular/core';

/** Injectable browser boundary so tests never leave the page. */
export const CHECKOUT_REDIRECT = new InjectionToken<(url: string) => void>('Checkout redirect', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return url => {
      document.defaultView?.location.assign(url);
    };
  },
});

@Component({
  selector: 'app-cart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
  host: { '[class.drawer-cart]': "presentation() === 'drawer'" },
})
export class Cart {
  protected readonly i18n = inject(TranslationService);
  readonly presentation = input<'page' | 'drawer'>('page');
  protected readonly cart = inject(CartService);
  protected readonly maxQuantity = MAX_CART_QUANTITY;
  protected readonly freeShippingMinBoxes = FREE_SHIPPING_MIN_BOXES;
  protected readonly shippingCents = computed(() => shippingAmountCents(this.cart.totalQuantity()));
  protected readonly totalCents = computed(() => {
    const subtotal = this.cart.subtotalCents();
    return subtotal === null ? null : subtotal + this.shippingCents();
  });
  protected readonly checkoutMessage = signal('');
  protected readonly checkoutLoading = signal(false);
  readonly continueShoppingRequested = output<void>();
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly redirect = inject(CHECKOUT_REDIRECT);
  private readonly currency = () => new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency: 'EUR' });
  private readonly router = inject(Router);
  

  protected async requestCheckout(): Promise<void> {
    if (this.checkoutLoading() || this.cart.isEmpty() || this.cart.subtotalCents() === null) return;
    this.checkoutLoading.set(true);
    this.checkoutMessage.set('');
    let checkoutUrl: string;
    try {
      const items = this.cart.entries().map(({ productId, quantity }) => ({ productId, quantity }));
      const { url } = await firstValueFrom(this.injector.get(CheckoutService).createCheckout(items).pipe(
        takeUntilDestroyed(this.destroyRef),
      ));
      checkoutUrl = url;
    } catch {
      if (this.destroyRef.destroyed) return;
      this.checkoutLoading.set(false);
      this.checkoutMessage.set(CA['ui.no_s_ha_pogut_iniciar_el_pagament_torna_ho_a_provar']);
      return;
    }
    // Keep submissions disabled while the browser leaves for the validated Stripe URL.
    if (!this.destroyRef.destroyed) this.redirect(checkoutUrl);
  }

  protected decreaseQuantity(productId: string, quantity: number, focusTarget: HTMLElement): void {
    if (this.cart.decreaseQuantity(productId) && quantity === 1) {
      focusTarget.focus({ preventScroll: true });
    }
  }

  protected formatCents(cents: number | null): string {
    return cents === null ? this.i18n.t('ui.preu_no_disponible') : this.currency().format(cents / 100);
  }

  /** Catalogue prices are for display only; checkout must reprice on the server. */
  protected priceLabel(price: number | undefined, quantity = 1): string {
    if (price === undefined || !Number.isFinite(price) || price < 0) return this.formatCents(null);
    const cents = Math.round(price * 100) * quantity;
    return this.formatCents(Number.isSafeInteger(cents) ? cents : null);
  }

  protected continueShopping():void{
    if (this.presentation() === 'drawer'){
      this.continueShoppingRequested.emit();
    }
    void this.router.navigate(['/products']);
  }

}
