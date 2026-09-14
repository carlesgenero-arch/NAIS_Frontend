import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Product } from '../../../../models/product.interface';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  host: { '[class.product-card--catalogue]': "presentation() === 'catalogue'" },
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly presentation = input<'editorial' | 'catalogue'>('editorial');
  readonly addRequested = output<Product>();
  protected readonly addLabel = computed(() => `Afegir ${this.product().name} al carret`);
  protected readonly imageAlt = computed(() => this.product().imageAlt ?? `${this.product().name} can`);
  protected readonly purchaseUrl = computed(() => this.product().purchaseUrl ?? '/shop');
}
