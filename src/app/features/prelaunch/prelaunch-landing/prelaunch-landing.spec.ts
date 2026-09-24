import { TestBed } from '@angular/core/testing';
import { PrelaunchLanding } from './prelaunch-landing';

describe('PrelaunchLanding composition', () => {
  it('renders accessible image cards with an unobstructed logo and no shop controls', async () => {
    await TestBed.configureTestingModule({ imports: [PrelaunchLanding] }).compileComponents();
    const fixture = TestBed.createComponent(PrelaunchLanding);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const cards = Array.from(element.querySelectorAll('.prelaunch__card'));
    expect(cards.length).toBeGreaterThan(1);
    expect(cards.filter(card => card.getAttribute('data-type') === 'logo').length).toBe(1);
    expect(cards.some(card => card.getAttribute('data-type') === 'brand')).toBe(true);
    expect(element.querySelector('[data-type="logo"] img')?.getAttribute('alt')).toBe('NAIS Drinks');
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

  it('waits for all images and tolerates duplicate events and failed images', async () => {
    await TestBed.configureTestingModule({ imports: [PrelaunchLanding] }).compileComponents();
    const fixture = TestBed.createComponent(PrelaunchLanding);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const images = Array.from(element.querySelectorAll('img'));
    const composition = element.querySelector('.prelaunch__composition')!;
    expect(composition.classList.contains('prelaunch__composition--waiting')).toBe(true);
    for (const image of images.slice(0, -1)) {
      image.dispatchEvent(new Event('load'));
      image.dispatchEvent(new Event('load'));
    }
    fixture.detectChanges();
    expect(composition.classList.contains('prelaunch__composition--waiting')).toBe(true);
    images.at(-1)!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(composition.classList.contains('prelaunch__composition--waiting')).toBe(false);
    fixture.destroy();
  });
});
