import { TestBed } from '@angular/core/testing';
import { Hero } from './hero';

describe('Hero', () => {
  it('renders the experimental hero with responsive delivery and high loading priority', async () => {
    await TestBed.configureTestingModule({ imports: [Hero] }).compileComponents();
    const fixture = TestBed.createComponent(Hero);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1, p, a, button')).toBeNull();
    expect(element.textContent?.trim()).toBe('');
    expect(element.querySelectorAll('img').length).toBe(1);
    expect(element.querySelector('img')?.getAttribute('alt')).toContain('NAIS Drinks');
    expect(element.querySelector('img')?.getAttribute('width')).toBe('1448');
    expect(element.querySelector('img')?.getAttribute('height')).toBe('1086');
    expect(element.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');
    expect(element.querySelector('img')?.getAttribute('loading')).not.toBe('lazy');
    expect(element.querySelector('img')?.getAttribute('srcset')).toContain('images/optimized/hero/nais-three-cans-480.webp 480w');
    expect(element.querySelector('img')?.getAttribute('srcset')).toContain('images/optimized/hero/nais-three-cans-1448.webp 1448w');
    expect(element.querySelector('img')?.getAttribute('sizes')).toBe('(min-width: 1800px) 1792px, 96vw');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/hero/Trío de bebidas con frutas frescas.png');
  });
});
