import { TranslatePipe } from '../../../../i18n/translate.pipe';
import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';

@Component({
  selector: 'app-navbar',
  imports: [NgTemplateOutlet, TranslatePipe, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly router = inject(Router);
  protected readonly isHome = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects.split(/[?#]/)[0] === '/'),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] === '/' },
  );
}
