import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MAX_CART_QUANTITY } from '../../../models/cart.interface';
import { CartService } from '../../../services/cart.service';

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
  private readonly currency = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' });

  protected requestCheckout(): void {
    if (this.cart.isEmpty() || this.cart.subtotalCents() === null) return;
    this.checkoutMessage.set('El pagament en línia estarà disponible pròximament. No s’ha iniciat cap pagament.');
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
