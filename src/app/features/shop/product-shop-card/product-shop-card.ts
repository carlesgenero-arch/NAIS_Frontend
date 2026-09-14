import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Product } from '../../../models/product.interface';
import { Modal } from '../../../core/shared/modal/modal';

@Component({
  selector: 'app-product-shop-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  templateUrl: './product-shop-card.html',
  styleUrl: './product-shop-card.css',
})
export class ProductShopCard {
  readonly product = input.required<Product>();
  readonly addRequested = output<Product>();
  protected readonly nutritionLabel = computed(() => `Veure els valors nutricionals de ${this.product().name}`);
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
