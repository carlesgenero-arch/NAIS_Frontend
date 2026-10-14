import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { Product } from '../../../models/product.interface';

@Component({
  selector: 'app-assorted-pack-promotion',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assorted-pack-promotion.html',
  styleUrl: './assorted-pack-promotion.css',
})
export class AssortedPackPromotion {
  readonly product = input.required<Product>();
}
