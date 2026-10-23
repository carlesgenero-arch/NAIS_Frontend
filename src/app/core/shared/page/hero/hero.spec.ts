import { TestBed } from '@angular/core/testing';
import { Hero } from './hero';

describe('Hero', () => {
  it('contains only the original accessible product image', async () => {
    await TestBed.configureTestingModule({ imports: [Hero] }).compileComponents();
    const fixture = TestBed.createComponent(Hero);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1, h2, p, a, button')).toBeNull();
    expect(element.textContent?.trim()).toBe('');
    expect(element.querySelectorAll('img').length).toBe(1);
    const image = element.querySelector('img')!;
    expect(image.getAttribute('width')).toBe('1600');
    expect(image.getAttribute('height')).toBe('1200');
    expect(image.getAttribute('fetchpriority')).toBe('high');
    expect(image.getAttribute('loading')).not.toBe('lazy');
    expect(image.getAttribute('srcset')).toContain('images/optimized/hero/nais-fruit-sodas-480.webp 480w');
    expect(image.getAttribute('srcset')).toContain('images/optimized/hero/nais-fruit-sodas-1600.webp 1600w');
    expect(image.getAttribute('sizes')).toBe('(min-width: 1800px) 1792px, 96vw');
    expect(element.querySelector('img')?.getAttribute('alt')).toContain('NAIS Drinks');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/hero/nais-fruit-sodas.jpeg');
  });
});
