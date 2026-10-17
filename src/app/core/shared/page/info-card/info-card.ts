import { TranslatePipe } from '../../../../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';

export interface InfoCardContent {
  readonly text: string;
  readonly colour: 'pink' | 'blue' | 'green';
  readonly image: { readonly src: string; readonly alt: string };
}

@Component({
  selector: 'app-info-card',
  host: { '[class.bubble-idle]': 'idle()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ],
  templateUrl: './info-card.html',
  styleUrl: './info-card.css',
})
export class InfoCard {
  readonly content = input.required<InfoCardContent>();
  protected readonly idle = signal(false);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  protected startIdle(event: TransitionEvent): void {
    // Ignore the initial hiding transition and the separate opacity transition.
    if (event.propertyName === 'transform'
      && this.element.nativeElement.classList.contains('home-motion-revealed')) this.idle.set(true);
  }
}
