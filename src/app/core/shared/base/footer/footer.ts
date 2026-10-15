import { CA } from '../../../../i18n/ca';
import { TranslatePipe } from '../../../../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface FooterLink {
  readonly label: string;
  readonly url?: string;
}

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, NgTemplateOutlet],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  readonly year = new Date().getFullYear();
  readonly instagramUrl = input('https://www.instagram.com/naisdrinks/');
  readonly legalLinks = input<readonly FooterLink[]>([
    { label: CA['ui.avis_legal'] },
    { label: CA['ui.politica_de_privacitat'] },
    { label: 'cookies' },
    { label: CA['ui.termes_i_condicions'] },
  ]);
}
