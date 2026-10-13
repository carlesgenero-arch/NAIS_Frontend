import { TranslationService } from '../../../i18n/translation.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { inject, ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AddProductRequest, Product } from '../../../models/product.interface';

@Component({
  selector: 'app-product-shop-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './product-shop-card.html',
  styleUrl: './product-shop-card.css',
})
export class ProductShopCard {
  protected readonly i18n = inject(TranslationService);
  readonly product = input.required<Product>();
  readonly addRequested = output<AddProductRequest>();
  protected readonly quantity = linkedSignal({
    source: () => this.product().id,
    computation: () => 1,
  });

  protected decreaseQuantity(): void {
    this.quantity.update(quantity => Math.max(1, quantity - 1));
  }

  protected increaseQuantity(): void {
    this.quantity.update(quantity => quantity + 1);
  }
  protected readonly imageAlt = computed(() => this.product().imageAlt ?? this.i18n.t('product.can', { product: this.i18n.text(this.product().name) }));
  protected readonly addLabel = computed(() => this.i18n.t('cart.add', { product: this.i18n.text(this.product().name) }));
  protected readonly priceLabel = computed(() => {
    const price = this.product().price;
      if (price === undefined) {
      return '';
    }
    const formattedPrice = new Intl.NumberFormat(this.i18n.locale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

    return `${formattedPrice} €`;
  });
}
