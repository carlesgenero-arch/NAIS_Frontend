import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Modal } from '../../../core/shared/modal/modal';
import { Product } from '../../../models/product.interface';

@Component({
  selector: 'app-product-selected-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  templateUrl: './product-selected-detail.html',
  styleUrl: './product-selected-detail.css',
})
export class ProductSelectedDetail {
  readonly product = input.required<Product>();
  readonly addRequested = output<Product>();
  protected readonly nutritionLabel = computed(() => `Veure els valors nutricionals de ${this.product().name}`);
  protected readonly imageAlt = computed(() => this.product().imageAlt ?? `Llauna de ${this.product().name}`);
  protected readonly addLabel = computed(() => `Afegir ${this.product().name} al carret`);
}
