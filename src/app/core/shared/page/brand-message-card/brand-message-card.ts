import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-message-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brand-message-card.html',
  styleUrl: './brand-message-card.css',
})
export class BrandMessageCard {
  readonly heading = input<string>('No som una beguda de benestar ni parlem de superaliments');
  readonly message = input<string>('Existim perquè la beguda en sí és bona. Prova el pack variat');
  readonly imageSrc = input<string>('images/brand-message/jakob-owens-qoFQxxuk3QY-unsplash.jpg');
  readonly imageAlt = input<string>('Person sitting underwater in a red chair beneath floating drink bottles');
  readonly ctaHref = input<string>('/shop');
}
