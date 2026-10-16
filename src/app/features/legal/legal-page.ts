import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n/translation.service';
import { FREE_SHIPPING_MIN_BOXES, SHIPPING_PRICE_EUR } from '../../../shared/shipping-rules';
import { LEGAL_PAGES, type LegalPageId } from './legal-pages';
import { LegalNavigation } from './legal-navigation';
@Component({ selector: 'app-legal-page', imports: [RouterLink, TranslatePipe, LegalNavigation], changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-page.html', styleUrl: './legal-page.css' })
export class LegalPage {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  protected readonly i18n = inject(TranslationService);
  protected readonly page = computed(() => LEGAL_PAGES[this.data()['legalPage'] as LegalPageId]);
  protected readonly params = computed(() => ({ boxes: FREE_SHIPPING_MIN_BOXES,
    shipping: new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency: 'EUR' }).format(SHIPPING_PRICE_EUR) }));
}
