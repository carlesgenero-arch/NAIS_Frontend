import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface InfoCardContent {
  readonly text: string;
  readonly imageSrc: string;
  readonly imageAlt: string;
}

@Component({
  selector: 'app-info-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './info-card.html',
  styleUrl: './info-card.css',
})
export class InfoCard {
  readonly content = input.required<InfoCardContent>();
}
