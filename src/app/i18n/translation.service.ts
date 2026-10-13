import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { CA, type TranslationKey } from './ca';
import { ES } from './es';

export type Language = 'ca' | 'es';
export type TranslationParams = Readonly<Record<string, string | number>>;
export const LANGUAGE_STORAGE_KEY = 'nais.language.v1';
const sourceKeys = new Map<string, TranslationKey>(Object.entries(CA).map(([key, value]) => [value, key as TranslationKey]));

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly selected = signal<Language>('ca');
  readonly language = this.selected.asReadonly();
  readonly locale = computed(() => this.language() === 'es' ? 'es-ES' : 'ca-ES');

  constructor() {
    if (this.browser) {
      try {
        if (this.document.defaultView?.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'es') this.selected.set('es');
      } catch { /* Storage is optional. */ }
    }
    this.document.documentElement.lang = this.language();
  }

  setLanguage(language: Language): void {
    if (language !== 'ca' && language !== 'es') return;
    this.selected.set(language);
    this.document.documentElement.lang = language;
    if (this.browser) {
      try { this.document.defaultView?.localStorage.setItem(LANGUAGE_STORAGE_KEY, language); }
      catch { /* Selection still works in memory. */ }
    }
  }

  t(key: TranslationKey, params: TranslationParams = {}): string {
    const text = this.language() === 'es' ? ES[key] : CA[key];
    return text.replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(params, name) ? String(params[name]) : token);
  }

  /** Presentation-only adapter for API/editor-authored text. Unknown copy stays
   * unchanged; never substitute catalogue data by product ID or stale snapshots. */
  text(value: string | null | undefined, params: TranslationParams = {}): string {
    if (!value) return '';
    const key = Object.hasOwn(CA, value) ? value as TranslationKey : sourceKeys.get(value);
    // Read language even for fallback text so OnPush consumers stay reactive.
    this.language();
    return key ? this.t(key, params) : value;
  }
}
