import { TranslationService } from '../../../../i18n/translation.service';
import { TestBed } from '@angular/core/testing';
import { Hero } from './hero';

describe('Hero', () => {
  it('renders the experimental hero with responsive delivery and high loading priority', async () => {
    await TestBed.configureTestingModule({ imports: [Hero] }).compileComponents();
    const fixture = TestBed.createComponent(Hero);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('a, button')).toBeNull();
    expect(element.querySelector('section')?.getAttribute('aria-labelledby')).toBe('home-editorial-heading');
    expect(element.querySelectorAll('#home-editorial-heading').length).toBe(1);
    expect(element.querySelectorAll('img').length).toBe(1);
    expect(element.querySelector('img')?.getAttribute('alt')).toContain('NAIS Drinks');
    expect(element.querySelector('img')?.getAttribute('width')).toBe('1448');
    expect(element.querySelector('img')?.getAttribute('height')).toBe('1086');
    expect(element.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');
    expect(element.querySelector('img')?.getAttribute('loading')).not.toBe('lazy');
    expect(element.querySelector('img')?.getAttribute('srcset')).toContain('images/optimized/hero/nais-three-cans-480.webp 480w');
    expect(element.querySelector('img')?.getAttribute('srcset')).toContain('images/optimized/hero/nais-three-cans-1448.webp 1448w');
    expect(element.querySelector('img')?.getAttribute('sizes')).toBe('(min-width: 1800px) 1066px, (min-width: 1024px) 58vw, (min-width: 768px) 48vw, 96vw');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/hero/Trío de bebidas con frutas frescas.png');
  });
  it('renders the editorial copy once and updates it in Catalan and Spanish', async () => {
    await TestBed.configureTestingModule({ imports: [Hero] }).compileComponents();
    const fixture = TestBed.createComponent(Hero);
    const translations = TestBed.inject(TranslationService);
    translations.setLanguage('ca');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent).toBe('REAL FRUIT MOCKTAILS');
    expect(element.querySelector('p')?.textContent).toBe('Sabors naturals, frescos i sorprenents per compartir a qualsevol moment.');
    expect(element.querySelectorAll('.hero-copy').length).toBe(1);
    expect(element.querySelectorAll('.hero-copy p').length).toBe(1);
    translations.setLanguage('es');
    fixture.detectChanges();
    expect(element.querySelector('h2')?.textContent).toBe('REAL FRUIT MOCKTAILS');
    expect(element.querySelector('p')?.textContent).toBe('Sabores naturales, frescos y sorprendentes para compartir en cualquier momento.');
    translations.setLanguage('ca');
  });
});
