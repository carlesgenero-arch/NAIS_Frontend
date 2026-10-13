import { TranslatePipe } from '../../../../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PromotionModal } from '../../../../services/promotion-modal';

@Component({
  selector: 'app-animated-banner',
  imports: [TranslatePipe, ],
  templateUrl: './animated-banner.html',
  styleUrl: './animated-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimatedBanner {
  private readonly promotionModal = inject(PromotionModal);

  protected openPromotion():void{
    this.promotionModal.open();
  }

}
