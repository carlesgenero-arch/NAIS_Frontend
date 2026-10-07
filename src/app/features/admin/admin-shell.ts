import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
@Component({
  selector: 'app-admin-shell', imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-labelledby="admin-title"><h1 id="admin-title">Backoffice NAIS</h1>
    <p>Sessió d’administració validada.</p><router-outlet /></section>`,
  styleUrl: './admin.css',
})
export class AdminShell {}
