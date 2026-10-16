import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { LEGAL_LINKS } from './legal-pages';
@Component({ selector: 'app-legal-navigation', imports: [RouterLink, TranslatePipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav [attr.aria-label]="'legal.nav' | t"><ul>@for (link of links; track link.url) {<li><a [routerLink]="link.url">{{ link.label | t }}</a></li>}</ul></nav>`,
  styleUrl: './legal-navigation.css',
})
export class LegalNavigation { protected readonly links = LEGAL_LINKS; }
