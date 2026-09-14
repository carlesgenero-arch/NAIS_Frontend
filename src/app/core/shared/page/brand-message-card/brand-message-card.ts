import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-brand-message-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brand-message-card.html',
  styleUrl: './brand-message-card.css',
})
export class BrandMessageCard {
  readonly heading = input<string>('No som una beguda de benestar. Existim perquè la beguda en sí és bona');
  readonly message = input<string>('PROVA EL PACK VARIAT');
  readonly imageSrc = input<string>('images/brand-message/jakob-owens-qoFQxxuk3QY-unsplash.jpg');
  readonly imageAlt = input<string>('Pack variat');
  readonly ctaHref = input<string>('/shop');

  protected readonly backgroundImage = computed(() => `url("${this.imageSrc()}")`);
}
