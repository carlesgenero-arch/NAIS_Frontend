import { ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, inject, InjectionToken, Injector, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CheckoutService } from '../../../services/checkout.service';
import { RouterLink } from '@angular/router';
import { MAX_CART_QUANTITY } from '../../../models/cart.interface';
import { CartService } from '../../../services/cart.service';

/** Injectable browser boundary so tests never leave the page. */
export const CHECKOUT_REDIRECT = new InjectionToken<(url: string) => void>('Checkout redirect', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return url => {
      if (!document.defaultView) throw new Error('Browser unavailable');
      document.defaultView.location.assign(url);
    };
  },
});

@Component({
  selector: 'app-cart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
  host: { '[class.drawer-cart]': "presentation() === 'drawer'" },
})
export class Cart {
  readonly presentation = input<'page' | 'drawer'>('page');
  protected readonly cart = inject(CartService);
  protected readonly maxQuantity = MAX_CART_QUANTITY;
  protected readonly checkoutMessage = signal('');
  protected readonly checkoutLoading = signal(false);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly redirect = inject(CHECKOUT_REDIRECT);
  private readonly currency = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' });

  protected async requestCheckout(): Promise<void> {
    if (this.checkoutLoading() || this.cart.isEmpty() || this.cart.subtotalCents() === null) return;
    this.checkoutLoading.set(true);
    this.checkoutMessage.set('');
    try {
      const items = this.cart.entries().map(({ productId, quantity }) => ({ productId, quantity }));
      const { url } = await firstValueFrom(this.injector.get(CheckoutService).createCheckout(items).pipe(
        takeUntilDestroyed(this.destroyRef),
      ));
      if (!this.destroyRef.destroyed) this.redirect(url);
      // Keep submission locked until the external navigation completes.
    } catch {
      if (this.destroyRef.destroyed) return;
      this.checkoutLoading.set(false);
      this.checkoutMessage.set("No s'ha pogut iniciar el pagament. Torna-ho a provar.");
    }
  }

  protected decreaseQuantity(productId: string, quantity: number, focusTarget: HTMLElement): void {
    if (this.cart.decreaseQuantity(productId) && quantity === 1) {
      focusTarget.focus({ preventScroll: true });
    }
  }

  protected formatCents(cents: number | null): string {
    return cents === null ? 'Preu no disponible' : this.currency.format(cents / 100);
  }

  /** Catalogue prices are for display only; checkout must reprice on the server. */
  protected priceLabel(price: number | undefined, quantity = 1): string {
    if (price === undefined || !Number.isFinite(price) || price < 0) return this.formatCents(null);
    const cents = Math.round(price * 100) * quantity;
    return this.formatCents(Number.isSafeInteger(cents) ? cents : null);
  }
}
