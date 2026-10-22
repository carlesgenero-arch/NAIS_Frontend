import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnimatedBanner } from './animated-banner';
import { TranslationService } from '../../../../i18n/translation.service';

describe('AnimatedBanner', () => {
  let component: AnimatedBanner;
  let fixture: ComponentFixture<AnimatedBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimatedBanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnimatedBanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('repeats identical translated messages for a seamless loop with decorative separators', () => {
    const translations = TestBed.inject(TranslationService);
    for (const language of ['ca', 'es'] as const) {
      translations.setLanguage(language);
      fixture.detectChanges();
      const messages = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.tira-animada__inner > span'));
      expect(messages).toHaveLength(10);
      messages.forEach(message => {
        expect(message.textContent).toBe(translations.t('ui.10_de_descompte') + '✦');
        const separator = message.querySelector('.tira-animada__separator');
        expect(separator?.textContent).toBe('✦');
        expect(separator?.getAttribute('aria-hidden')).toBe('true');
        expect(separator?.hasAttribute('tabindex')).toBe(false);
      });
    }
    translations.setLanguage('ca');
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
