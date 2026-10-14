import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LanguageSelector } from '../core/shared/base/language-selector/language-selector';
import { PrelaunchLanding } from '../features/prelaunch/prelaunch-landing/prelaunch-landing';
import { CheckoutCancel } from '../features/checkout/checkout-cancel';
import { TranslatePipe } from './translate.pipe';
import { CA, type TranslationKey } from './ca';
import { ES } from './es';
import { PRODUCT_PRESENTATION } from '../services/product-presentation';
import { LANGUAGE_STORAGE_KEY, TranslationService } from './translation.service';

@Component({ imports: [LanguageSelector, TranslatePipe], template: `<app-language-selector /><p>{{ 'ui.la_cistella_es_buida' | t }}</p><span>{{ 'cart.add' | t: { product: name } }}</span>` })
class TranslationHost { name = '<script>example</script>'; }

describe('Storefront translations', () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    } as Storage);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); document.documentElement.lang = 'ca'; });

  it('defaults to Catalan without writing anything to storage', () => {
    const service = TestBed.inject(TranslationService);
    expect(service.language()).toBe('ca');
    expect(document.documentElement.lang).toBe('ca');
    expect(values.size).toBe(0);
  });
  it('restores Spanish, validates stored preferences and stores only language', () => {
    values.set(LANGUAGE_STORAGE_KEY, 'es');
    const service = TestBed.inject(TranslationService);
    expect(service.language()).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    service.setLanguage('ca');
    expect([...values]).toEqual([[LANGUAGE_STORAGE_KEY, 'ca']]);
  });
  it('ignores an invalid preference', () => {
    values.set(LANGUAGE_STORAGE_KEY, '{"language":"es"}');
    expect(TestBed.inject(TranslationService).language()).toBe('ca');
  });
  it('works when storage is unavailable', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw Error('Unavailable'); });
    const service = TestBed.inject(TranslationService);
    expect(() => service.setLanguage('es')).not.toThrow();
    expect(service.t('ui.botiga')).toBe('Tienda');
  });
  it('does not access browser storage on the server', () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const storage = vi.spyOn(window, 'localStorage', 'get');
    const service = TestBed.inject(TranslationService);
    service.setLanguage('es');
    expect(storage).not.toHaveBeenCalled();
  });
  it('has matching resources and interpolation parameters', () => {
    expect(Object.keys(ES).sort()).toEqual(Object.keys(CA).sort());
    for (const key of Object.keys(CA) as TranslationKey[]) {
      expect(ES[key].trim()).not.toBe('');
      expect(ES[key].match(/\{\w+\}/g)?.sort()).toEqual(CA[key].match(/\{\w+\}/g)?.sort());
    }
  });
  it('shows hibiscus for Orange Spritz in both languages without changing other recipes', () => {
    const service = TestBed.inject(TranslationService);
    const ingredients = PRODUCT_PRESENTATION['orange-spritz'].ingredients;
    expect(service.text(ingredients)).toBe('TARONJA, HIBISC, GERDS, GENCIANA');
    service.setLanguage('es');
    expect(service.text(ingredients)).toBe('NARANJA, HIBISCO, FRAMBUESAS, GENCIANA');
    expect(service.text(PRODUCT_PRESENTATION['passion-hugo'].ingredients)).toContain('LIMÓN');
  });
  it('translates known catalogue copy but never overrides unknown API data or identifiers', () => {
    const service = TestBed.inject(TranslationService);
    service.setLanguage('es');
    expect(service.text('PACK VARIAT')).toBe('PACK VARIADO');
    for (const value of ['orange-spritz', 'active', '/api/checkout', 'price_fixture', 'New description from D1']) {
      expect(service.text(value)).toBe(value);
    }
  });
  it('updates the selector and OnPush-friendly pipe without navigation or HTML interpretation', async () => {
    const fixture = TestBed.createComponent(TranslationHost);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    const url = window.location.href;
    const root: HTMLElement = fixture.nativeElement;
    const buttons = root.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    buttons[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('p')?.textContent).toBe('La cesta está vacía.');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('lang')).toBe('es');
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('span')?.textContent).toContain('/');
    expect(root.textContent).toContain('Añadir <script>example</script> a la cesta');
    expect(navigate).not.toHaveBeenCalled();
    expect(window.location.href).toBe(url);
    expect([...values]).toEqual([[LANGUAGE_STORAGE_KEY, 'es']]);
  });
  it('updates existing prelaunch content and preserves contact links', async () => {
    const fixture = TestBed.createComponent(PrelaunchLanding);
    fixture.detectChanges();
    TestBed.inject(TranslationService).setLanguage('es');
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Estamos preparando nuestra nueva web');
    expect(root.querySelector('a[href^="mailto:"]')?.getAttribute('href')).toBe('mailto:info@naisdrinks.com');
  });
  it('translates checkout cancellation without changing the shop link', async () => {
    const fixture = TestBed.createComponent(CheckoutCancel);
    fixture.detectChanges();
    TestBed.inject(TranslationService).setLanguage('es');
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Tu cesta sigue guardada.');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/products');
  });
});
