import { TestBed } from '@angular/core/testing';
import { BrandMessageCard } from './brand-message-card';

describe('BrandMessageCard', () => {
  it('preserves the Catalan copy and exposes the image and purchase link accessibly', async () => {
    await TestBed.configureTestingModule({ imports: [BrandMessageCard] }).compileComponents();
    const fixture = TestBed.createComponent(BrandMessageCard);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent).toBe('No som una beguda de benestar ni parlem de superaliments');
    expect(element.querySelector('p')?.textContent).toBe('Existim perquè la beguda en sí és bona. Prova el pack variat');
    expect(element.querySelector('section')?.getAttribute('aria-label')).toBe(element.querySelector('h2')?.textContent);
    expect(element.querySelectorAll('img').length).toBe(1);
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/brand-message/jakob-owens-qoFQxxuk3QY-unsplash.jpg');
    expect(element.querySelector('img')?.getAttribute('alt')).toContain('underwater');
    expect(element.querySelector('a')?.textContent).toBe('COMPRAR');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/shop');

    fixture.componentRef.setInput('ctaHref', '/variety-pack');
    fixture.componentRef.setInput('heading', 'Updated heading');
    await fixture.whenStable();
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/variety-pack');
    expect(element.querySelector('h2')?.textContent).toBe('Updated heading');
    expect(element.querySelector('section')?.getAttribute('aria-label')).toBe('Updated heading');
  });
});
