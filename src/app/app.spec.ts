import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App header', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders a single header with an accessible link to home', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('header').length).toBe(1);
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Navegació principal');
    expect(element.querySelector('nav a')?.getAttribute('href')).toBe('/');
    expect(element.querySelector('nav a img')?.getAttribute('src')).toBe('images/brand/nais-logo.svg');
    expect(element.querySelector('.header-actions .brand-mark')?.getAttribute('alt')).toBe('');
    expect(element.querySelector('.header-actions .brand-mark')?.getAttribute('src')).toBe('images/brand/nais-mark.svg');
    expect(element.querySelector('.header-actions .cart')).not.toBeNull();
    expect(element.querySelector('nav .brand-mark')).toBeNull();
  });

  it('keeps unavailable actions disabled without linking to unfinished pages', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('header button'));
    expect(buttons.length).toBe(4);
    expect(buttons.every(button => button.disabled)).toBe(true);
    expect(element.querySelector('.shop')?.getAttribute('aria-label')).toContain('pròximament');
    expect(element.querySelector('.cart')?.getAttribute('aria-label')).toContain('pròximament');
    expect(element.querySelectorAll('header a').length).toBe(1);
  });
});
