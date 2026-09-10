import { TestBed } from '@angular/core/testing';
import { InfoCard, type InfoCardContent } from './info-card';

describe('InfoCard', () => {
  it('renders and updates its input without changing text casing or duplicating images', async () => {
    await TestBed.configureTestingModule({ imports: [InfoCard] }).compileComponents();
    const fixture = TestBed.createComponent(InfoCard);
    const content: InfoCardContent = {
      text: 'Sense sucres afegits ni edulcorants',
      imageSrc: 'images/info-card/mango.png',
      imageAlt: 'Mango fruit on a pink background',
    };
    fixture.componentRef.setInput('content', content);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('article h2')?.textContent).toBe(content.text);
    expect(element.querySelectorAll('img').length).toBe(1);
    expect(element.querySelector('img')?.getAttribute('src')).toBe(content.imageSrc);
    expect(element.querySelector('img')?.getAttribute('alt')).toBe(content.imageAlt);

    fixture.componentRef.setInput('content', {
      text: 'sense filtrar',
      imageSrc: 'images/info-card/lemon.jpg',
      imageAlt: 'Lemon fruit on a green background',
    } satisfies InfoCardContent);
    await fixture.whenStable();
    expect(element.querySelector('h2')?.textContent).toBe('sense filtrar');
    expect(element.querySelectorAll('img').length).toBe(1);
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/info-card/lemon.jpg');
  });
});
