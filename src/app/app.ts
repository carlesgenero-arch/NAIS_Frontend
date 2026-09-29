import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Header } from './core/shared/base/header/header';
import { Footer } from './core/shared/base/footer/footer';
import { Promotion } from './features/components/promotion/promotion';

@Component({
  selector: 'app-root',
  imports: [Header, RouterOutlet, Footer, Promotion],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: { '[class.prelaunch]': 'isPrelaunch()' },
})
export class App {
  private readonly router = inject(Router);
  protected readonly isPrelaunch = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects.split(/[?#]/)[0] === '/'),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] === '/' },
  );
}
