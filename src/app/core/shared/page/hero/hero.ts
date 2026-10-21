import { ResponsiveImage } from '../../../images/responsive-image.directive';
import { TranslatePipe } from '../../../../i18n/translate.pipe';
import { Component } from '@angular/core';

@Component({
  selector: 'app-hero',
  imports: [ResponsiveImage, TranslatePipe, ],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {

}
