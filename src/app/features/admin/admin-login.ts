import { ChangeDetectionStrategy, Component } from '@angular/core';
@Component({
  selector: 'app-admin-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-labelledby="login-title"><h1 id="login-title">Accés al backoffice NAIS</h1>
    <p>Accés reservat a l’equip autoritzat. Identifica’t amb Cloudflare Access.</p>
    <p>Si no pots entrar, comprova el compte utilitzat o contacta amb l’administrador.</p>
    <a class="btn" href="/admin">Identificar-me</a></section>`,
  styleUrl: './admin.css',
})
export class AdminLogin {}
