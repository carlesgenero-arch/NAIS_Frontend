import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
@Component({
  selector: 'app-admin-shell', imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-labelledby="admin-title"><h1 id="admin-title">Backoffice NAIS</h1>
    <nav aria-label="Administració"><a routerLink="/admin/products" routerLinkActive="current" ariaCurrentWhenActive="page">Productes</a>
      <a routerLink="/admin/orders" routerLinkActive="current" ariaCurrentWhenActive="page">Comandes</a></nav>
    <router-outlet /></section>`,
  styleUrl: './admin.css',
})
export class AdminShell {}
