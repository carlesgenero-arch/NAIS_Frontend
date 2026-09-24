import { TestBed } from '@angular/core/testing';
import { PrelaunchLanding } from './prelaunch-landing';

describe('PrelaunchLanding composition', () => {
  it('renders accessible image cards with the unobstructed logo last and no shop controls', async () => {
    await TestBed.configureTestingModule({ imports: [PrelaunchLanding] }).compileComponents();
    const fixture = TestBed.createComponent(PrelaunchLanding);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const cards = Array.from(element.querySelectorAll('.prelaunch__card'));
    expect(cards.length).toBeGreaterThan(1);
    expect(cards.filter(card => card.getAttribute('data-type') === 'logo').length).toBe(1);
    expect(cards.some(card => card.getAttribute('data-type') === 'brand')).toBe(true);
    expect(cards.at(-1)?.getAttribute('data-type')).toBe('logo');
    expect(cards.at(-1)?.querySelector('img')?.getAttribute('alt')).toBe('NAIS Drinks');
    for (const [index, card] of cards.entries()) {
      expect((card as HTMLElement).style.getPropertyValue('--asset-order')).toBe(String(index));
      const image = card.querySelector('img')!;
      expect(image.getAttribute('alt')?.trim().length).toBeGreaterThan(0);
      expect(image.getAttribute('src')).toMatch(/^images\//);
    }
    expect(element.querySelector('a, button, input, [tabindex], app-product-grid')).toBeNull();
    const section = element.querySelector('section')!;
    expect(section.getAttribute('lang')).toBe('ca');
    expect(section.getAttribute('aria-labelledby')).toBe(element.querySelector('h1')?.id);
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('.prelaunch__message')?.textContent).toContain('Estem preparant la nostra nova web');
    expect(element.querySelector('.prelaunch__bubbles')?.getAttribute('aria-hidden')).toBe('true');
  });
});
