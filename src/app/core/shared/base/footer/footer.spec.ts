import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslationService } from '../../../../i18n/translation.service';
import { Footer } from './footer';

describe('Public footer before newsletter launch', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each(['ca', 'es'] as const)('does not offer newsletter subscription in %s', async language => {
    TestBed.configureTestingModule({ imports: [Footer], providers: [provideRouter([])] });
    const translations = TestBed.inject(TranslationService);
    translations.setLanguage(language);
    const fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-newsletter')).toBeNull();
    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).not.toContain(translations.t('ui.subscriute'));
    expect(element.querySelector('footer')).not.toBeNull();
    expect(element.querySelector('a[href="mailto:info@naisdrinks.com"]')).not.toBeNull();
  });
});
