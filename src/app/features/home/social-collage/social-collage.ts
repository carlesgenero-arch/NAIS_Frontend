import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { CarouselImage } from '../../../models/carousel-image.interface';
import { HomeReveal } from '../home-reveal.directive';

export interface SocialCollageImage extends CarouselImage {
  readonly width: number;
  readonly height: number;
}

@Component({
  selector: 'app-social-collage',
  imports: [TranslatePipe, HomeReveal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './social-collage.html',
  styleUrl: './social-collage.css',
})
export class SocialCollage {
  readonly images = input.required<readonly SocialCollageImage[]>();
}
