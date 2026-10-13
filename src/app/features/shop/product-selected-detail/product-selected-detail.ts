import { TranslationService } from '../../../i18n/translation.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { inject, ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Modal } from '../../../core/shared/modal/modal';
import { Product } from '../../../models/product.interface';

@Component({
  selector: 'app-product-selected-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Modal],
  templateUrl: './product-selected-detail.html',
  styleUrl: './product-selected-detail.css',
})
export class ProductSelectedDetail {
  protected readonly i18n = inject(TranslationService);
  readonly product = input.required<Product>();
  readonly addRequested = output<Product>();
  protected readonly nutritionLabel = computed(() => this.i18n.t('product.nutrition', { product: this.i18n.text(this.product().name) }));
  protected readonly imageAlt = computed(() => this.product().imageAlt ?? this.i18n.t('product.can', { product: this.i18n.text(this.product().name) }));
  protected readonly addLabel = computed(() => this.i18n.t('cart.add', { product: this.i18n.text(this.product().name) }));
}
