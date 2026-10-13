import { TranslatePipe } from '../../../../i18n/translate.pipe';
import { Component } from '@angular/core';

@Component({
  selector: 'app-hero',
  imports: [TranslatePipe, ],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {

}
