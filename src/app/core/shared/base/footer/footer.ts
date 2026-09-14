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
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  readonly year = new Date().getFullYear();
  readonly instagramUrl = input('https://www.instagram.com/naisdrinks/');
  readonly legalLinks = input<readonly FooterLink[]>([
    { label: 'Avís Legal' },
    { label: 'Política de privacitat' },
    { label: 'cookies' },
    { label: 'Termes i condicions' },
  ]);
}
