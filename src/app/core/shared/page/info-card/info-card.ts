import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface InfoCardContent {
  readonly text: string;
  readonly colour: 'pink' | 'blue' | 'green';
}

@Component({
  selector: 'app-info-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './info-card.html',
  styleUrl: './info-card.css',
})
export class InfoCard {
  readonly content = input.required<InfoCardContent>();
}
