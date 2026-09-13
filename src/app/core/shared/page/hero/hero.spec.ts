import { TestBed } from '@angular/core/testing';
import { Hero } from './hero';

describe('Hero', () => {
  it('contains only the original accessible product image', async () => {
    await TestBed.configureTestingModule({ imports: [Hero] }).compileComponents();
    const fixture = TestBed.createComponent(Hero);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1, p, a, button')).toBeNull();
    expect(element.textContent?.trim()).toBe('');
    expect(element.querySelectorAll('img').length).toBe(1);
    expect(element.querySelector('img')?.getAttribute('alt')).toContain('NAIS Drinks');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/hero/nais-fruit-sodas.jpeg');
  });
});
