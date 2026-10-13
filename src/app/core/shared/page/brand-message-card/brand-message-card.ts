import { CA } from '../../../../i18n/ca';
import { TranslatePipe } from '../../../../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  imports: [TranslatePipe],
  selector: 'app-brand-message-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brand-message-card.html',
  styleUrl: './brand-message-card.css',
})
export class BrandMessageCard {
  readonly heading = input<string>(CA['ui.no_som_una_beguda_de_benestar_existim_perque_la_beguda_en_si_es_bona']);
  readonly message = input<string>(CA['ui.prova_el_pack_variat']);
  readonly imageSrc = input<string>('images/brand-message/jakob-owens-qoFQxxuk3QY-unsplash.jpg');
  readonly imageAlt = input<string>(CA['ui.pack_variat']);
  readonly ctaHref = input<string>('/shop');

  protected readonly backgroundImage = computed(() => `url("${this.imageSrc()}")`);
}
