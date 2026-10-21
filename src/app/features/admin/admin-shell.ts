import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError, NavigationSkipped } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { concat, filter, map, of, switchMap, timer } from 'rxjs';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ADMIN_NAVIGATION_TIMEOUT_MS } from '../../services/admin-request';
@Component({
  selector: 'app-admin-shell', imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-labelledby="admin-title"><h1 id="admin-title">Backoffice NAIS</h1>
    <nav aria-label="Administració"><a routerLink="/admin/products" routerLinkActive="current" ariaCurrentWhenActive="page">Productes</a>
      <a routerLink="/admin/orders" routerLinkActive="current" ariaCurrentWhenActive="page">Comandes</a></nav>
    @if (navigation() === 'loading') { <p role="status">{{ 'admin.feedback.openingScreen' | t }}</p> }
    @if (navigation() === 'error') { <p role="alert">{{ 'admin.feedback.navigationFailed' | t }}</p> }
    <router-outlet /></section>`,
  styleUrl: './admin.css',
})
export class AdminShell {
  protected readonly navigation = signal<'ready' | 'loading' | 'error'>('ready');
  constructor() {
    inject(Router).events.pipe(
      filter(event => event instanceof NavigationStart || event instanceof NavigationEnd
        || event instanceof NavigationCancel || event instanceof NavigationError || event instanceof NavigationSkipped),
      switchMap(event => event instanceof NavigationStart
        ? concat(of('loading' as const), timer(ADMIN_NAVIGATION_TIMEOUT_MS).pipe(map(() => 'error' as const)))
        : of(event instanceof NavigationError ? 'error' as const : 'ready' as const)),
      takeUntilDestroyed(),
    ).subscribe(state => this.navigation.set(state));
  }
}
