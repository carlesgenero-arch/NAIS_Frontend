import { TestBed } from '@angular/core/testing';
import { Hero } from './hero';

describe('Hero', () => {
  it('preserves the exact approved copy and provides an accessible product image', async () => {
    await TestBed.configureTestingModule({ imports: [Hero] }).compileComponents();
    const fixture = TestBed.createComponent(Hero);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Real fruit sodas');
    expect(element.querySelector('p')?.textContent).toBe('a base de sucs naturals, fruita triturada i botànics');
    expect(element.querySelector('section')?.getAttribute('aria-labelledby')).toBe(element.querySelector('h1')?.id);
    expect(element.querySelectorAll('img').length).toBe(1);
    expect(element.querySelector('img')?.getAttribute('alt')).toContain('NAIS Drinks');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/hero/nais-fruit-sodas.jpeg');
  });
});
