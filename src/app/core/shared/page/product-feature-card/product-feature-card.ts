import { ResponsiveImage } from '../../../images/responsive-image.directive';
import { CA } from '../../../../i18n/ca';
import { TranslatePipe } from '../../../../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../../../models/product.interface';

@Component({
  selector: 'app-product-feature-card',
  imports: [ResponsiveImage, TranslatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-feature-card.html',
  styleUrl: './product-feature-card.css',
})
export class ProductFeatureCard {
  readonly product = input.required<Product>();
  protected readonly badge = computed(() =>
    this.product().badge ?? (this.product().isSeasonal ? CA['ui.nova_collita'] : CA['ui.destacat']));
  protected readonly imageUrl = computed(() =>
    this.product().featureImageUrl ?? this.product().imageUrl);
  protected readonly imageAlt = computed(() =>
    this.product().featureImageAlt ?? this.product().imageAlt ?? this.product().name);
}
