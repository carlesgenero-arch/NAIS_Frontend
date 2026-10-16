import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { TranslationService } from '../../i18n/translation.service';
import { Footer } from '../../core/shared/base/footer/footer';
import { PrelaunchLanding } from '../prelaunch/prelaunch-landing/prelaunch-landing';
import { LEGAL_LINKS, LEGAL_PAGES } from './legal-pages';

describe('Launch legal pages and navigation', () => {
  beforeEach(() => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({ getItem: () => null, setItem: vi.fn() } as unknown as Storage);
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it.each(['ca', 'es'] as const)('renders every direct legal route in %s and keeps links functional', async language => {
    const translations = TestBed.inject(TranslationService);
    translations.setLanguage(language);
    const harness = await RouterTestingHarness.create();
    for (const [id, page] of Object.entries(LEGAL_PAGES)) {
      await harness.navigateByUrl('/' + id);
      harness.detectChanges();
      const element = harness.routeNativeElement!;
      expect(element.querySelector('h1')?.textContent).toBe(translations.t(page.title));
      expect(element.textContent).not.toContain('legal.');
      expect(element.textContent).not.toContain('{shipping}');
      expect(element.querySelector('article')?.getAttribute('lang')).toBe(language);
      expect(element.querySelector('a[href="mailto:info@naisdrinks.com"]')).not.toBeNull();
      for (const link of LEGAL_LINKS) expect(element.querySelector(`a[href="${link.url}"]`)).not.toBeNull();
    }
  });

  it.each([
    ['ca', "Inscrita al Registre Mercantil de Barcelona, tom 47839, llibre 104, secció 8, foli 104, full 563832, inscripció 1.", "Quan sol·licites voluntàriament el codi promocional, tractem les dades necessàries exclusivament per gestionar la teva sol·licitud i enviar-te el codi. Aquesta finalitat no comporta la subscripció a comunicacions comercials."],
    ['es', "Inscrita en el Registro Mercantil de Barcelona, tomo 47839, libro 104, sección 8, folio 104, hoja 563832, inscripción 1.", "Cuando solicitas voluntariamente el código promocional, tratamos los datos necesarios exclusivamente para gestionar tu solicitud y enviarte el código. Esta finalidad no implica la suscripción a comunicaciones comerciales."],
  ] as const)('shows verified registry details and neutral promo wording in %s', async (language, registry, promo) => {
    const translations = TestBed.inject(TranslationService);
    translations.setLanguage(language);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/legal'); harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(registry);
    await harness.navigateByUrl('/privacy'); harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(promo);
    expect(translations.t('legal.privacy.basis.body')).not.toMatch(/autoritza|autoriza/);
    expect(translations.t('legal.privacy.basis.body')).toContain(language === 'ca' ? 'obligacions legals' : 'obligaciones legales');
    expect(translations.t('legal.privacy.providers.body')).not.toMatch(/Privacy Framework|Standard Contractual Clauses/);
    expect(translations.t('legal.cookies.analytics.body')).toContain(language === 'ca' ? 'abans d’activar-les' : 'antes de activarlas');
  });

  it('exposes all six legal routes in footer and prelaunch without a newsletter', async () => {
    for (const component of [Footer, PrelaunchLanding]) {
      const fixture = TestBed.createComponent<unknown>(component);
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      for (const link of LEGAL_LINKS) {
        expect(routes.some(route => route.path === link.url.slice(1))).toBe(true);
        expect(root.querySelector(`a[href="${link.url}"]`)?.getAttribute('aria-disabled')).toBeNull();
        expect(root.querySelector(`a[href="${link.url}"]`)).not.toBeNull();
      }
      expect(root.querySelector('app-newsletter')).toBeNull();
      fixture.destroy();
    }
  });

  it('keeps seller identity, VAT, shipping and limited withdrawal wording in both languages', async () => {
    const translations = TestBed.inject(TranslationService);
    const harness = await RouterTestingHarness.create();
    for (const language of ['ca', 'es'] as const) {
      translations.setLanguage(language);
      await harness.navigateByUrl('/legal'); harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('B05432372');
      expect(harness.routeNativeElement?.textContent).toContain('08569 Sant Martí Sescorts');
      await harness.navigateByUrl('/purchase-conditions'); harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('IVA');
      expect(harness.routeNativeElement?.textContent).toContain('6,00');
      expect(harness.routeNativeElement?.querySelector('a[href="/shipping-returns"]')).not.toBeNull();
      await harness.navigateByUrl('/shipping-returns'); harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain(language === 'ca' ? 'manca de conformitat' : 'falta de conformidad');
      expect(harness.routeNativeElement?.textContent).toContain(language === 'ca' ? 'begudes no pasteuritzades' : 'bebidas no pasteurizadas');
      expect(harness.routeNativeElement?.textContent).not.toMatch(/aliments|alimentos/);
      expect(harness.routeNativeElement?.textContent).toContain(language === 'ca' ? 'segons les indicacions de cada etiqueta' : 'según las indicaciones de cada etiqueta');
    }
  });
});
