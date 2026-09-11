import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Product } from '../../../../models/product.interface';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
})
export class ProductCard {
  readonly product = input.required<Product>();
  protected readonly imageAlt = computed(() => this.product().imageAlt ?? `${this.product().name} can`);
  protected readonly purchaseUrl = computed(() => this.product().purchaseUrl ?? '/shop');
}
