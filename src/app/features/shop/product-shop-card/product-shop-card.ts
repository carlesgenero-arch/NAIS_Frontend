import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AddProductRequest, Product } from '../../../models/product.interface';

@Component({
  selector: 'app-product-shop-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './product-shop-card.html',
  styleUrl: './product-shop-card.css',
})
export class ProductShopCard {
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
  protected readonly imageAlt = computed(() => this.product().imageAlt ?? `${this.product().name} can`);
  protected readonly addLabel = computed(() => `Afegir ${this.product().name} al carret`);
  protected readonly priceLabel = computed(() => {
    const price = this.product().price;
      if (price === undefined) {
      return '';
    }
    const formattedPrice = new Intl.NumberFormat('ca-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

    return `${formattedPrice} €`;
  });
}
