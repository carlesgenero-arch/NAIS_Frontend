import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-brand-message-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brand-message-card.html',
  styleUrl: './brand-message-card.css',
})
export class BrandMessageCard {
  readonly heading = input<string>('No som una beguda de benestar ni parlem de superaliments');
  readonly message = input<string>('Existim perquè la beguda en sí és bona. Prova el pack variat');
  readonly imageSrc = input<string>('images/brand-message/WhatsApp Image 2026-08-17 at 17.41.18 (1).jpeg');
  readonly imageAlt = input<string>('Pack variat');
  readonly ctaHref = input<string>('/shop');

  protected readonly backgroundImage = computed(() => `url("${this.imageSrc()}")`);
}
