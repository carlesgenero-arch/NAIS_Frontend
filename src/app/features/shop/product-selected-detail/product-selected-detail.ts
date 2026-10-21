import { ResponsiveImage } from '../../../core/images/responsive-image.directive';
import { TranslationService } from '../../../i18n/translation.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { DOCUMENT } from '@angular/common';
import { afterNextRender, ElementRef, viewChild, inject, ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Modal } from '../../../core/shared/modal/modal';
import { Product } from '../../../models/product.interface';

@Component({
  selector: 'app-product-selected-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ResponsiveImage, TranslatePipe, Modal],
  templateUrl: './product-selected-detail.html',
  styleUrl: './product-selected-detail.css',
})
export class ProductSelectedDetail {
  protected readonly i18n = inject(TranslationService);
  private readonly document = inject(DOCUMENT);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  readonly focusOnArrival = input(false);

  constructor() {
    afterNextRender(() => {
      // Do not interrupt a user who focused another control while data was loading.
      if (this.focusOnArrival() && (!this.document.activeElement || this.document.activeElement === this.document.body)) {
        this.heading().nativeElement.focus({ preventScroll: true });
      }
    });
  }

  protected requestAdd(): void {
    if (this.product().status === 'active') this.addRequested.emit(this.product());
  }

  readonly product = input.required<Product>();
  readonly addRequested = output<Product>();
  protected readonly ingredientsText = computed(() => {
    const text = this.i18n.text(this.product().ingredients).split(',')
      .map(ingredient => ingredient.trim())
      // Normalize legacy all-caps lists without lowercasing authored proper names.
      .map(ingredient => ingredient === ingredient.toLocaleUpperCase(this.i18n.locale())
        ? ingredient.toLocaleLowerCase(this.i18n.locale()) : ingredient)
      .filter(Boolean).join(' · ');
    return text.charAt(0).toLocaleUpperCase(this.i18n.locale()) + text.slice(1);
  });
  protected readonly priceLabel = computed(() => {
    const price = this.product().price;
    return price !== undefined && Number.isFinite(price) && price >= 0
      ? new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency: 'EUR' }).format(price)
      : '';
  });
  protected readonly nutritionLabel = computed(() => this.i18n.t('product.nutrition', { product: this.i18n.text(this.product().name) }));
  protected readonly imageAlt = computed(() => this.product().imageAlt ?? this.i18n.t('product.can', { product: this.i18n.text(this.product().name) }));
  protected readonly addLabel = computed(() => this.i18n.t('cart.add', { product: this.i18n.text(this.product().name) }));
}
