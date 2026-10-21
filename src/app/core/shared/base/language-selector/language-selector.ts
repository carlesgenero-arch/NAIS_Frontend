import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslationService } from '../../../../i18n/translation.service';

@Component({
  selector: 'app-language-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div role="group" [attr.aria-label]="i18n.t('language.label')">
    <button type="button" lang="ca" aria-label="Català" [attr.aria-pressed]="i18n.language() === 'ca'" (click)="i18n.setLanguage('ca')">CAT</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="es" aria-label="Castellano" [attr.aria-pressed]="i18n.language() === 'es'" (click)="i18n.setLanguage('es')">CAST</button>
  </div>`,
  styles: `:host { display: block; max-width: 100%; }
    div { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem; }
    button { min-width: var(--control-min-size, 44px); min-height: var(--control-min-size, 44px); padding: .25rem .5rem; border: 0; background: transparent; color: var(--color-negro); font: inherit; font-size: var(--language-selector-font-size, .875rem); cursor: pointer; }
    button[aria-pressed="true"] { font-weight: 700; text-decoration: underline; text-underline-offset: .3em; }
    button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }`,
})
export class LanguageSelector {
  protected readonly i18n = inject(TranslationService);
}
