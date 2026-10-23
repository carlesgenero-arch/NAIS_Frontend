import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnimatedBanner } from './animated-banner';
import { PromotionModal } from '../../../../services/promotion-modal';
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
  it('pauses and resumes without opening the promotion or moving focus, in CAT and CAST', () => {
    const translations = TestBed.inject(TranslationService);
    const open = vi.spyOn(TestBed.inject(PromotionModal), 'open');
    const root = fixture.nativeElement as HTMLElement;
    const control = root.querySelector<HTMLButtonElement>('.tira-animada__pause')!;
    const trigger = root.querySelector<HTMLButtonElement>('.tira-animada__trigger')!;
    expect(control.type).toBe('button');
    expect(trigger.type).toBe('button');
    expect(root.querySelectorAll('button button, [role="button"] button')).toHaveLength(0);
    expect(control.closest('[aria-hidden="true"]')).toBeNull();
    expect(control.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    for (const language of ['ca', 'es'] as const) {
      translations.setLanguage(language);
      fixture.detectChanges();
      expect(control.getAttribute('aria-label')).toBe(translations.t('home.marquee.pause'));
      control.focus();
      control.click();
      fixture.detectChanges();
      expect(root.querySelector('.tira-animada--paused')).not.toBeNull();
      expect(control.getAttribute('aria-label')).toBe(translations.t('home.marquee.resume'));
      expect(document.activeElement).toBe(control);
      control.click();
      fixture.detectChanges();
      expect(root.querySelector('.tira-animada--paused')).toBeNull();
      expect(control.getAttribute('aria-label')).toBe(translations.t('home.marquee.pause'));
      expect(document.activeElement).toBe(control);
    }
    expect(open).not.toHaveBeenCalled();
    trigger.click();
    expect(open).toHaveBeenCalledTimes(1);
    translations.setLanguage('ca');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
