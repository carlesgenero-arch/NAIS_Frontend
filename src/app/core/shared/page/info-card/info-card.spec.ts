import { TestBed } from '@angular/core/testing';
import { InfoCard, type InfoCardContent } from './info-card';

describe('InfoCard', () => {
  it('renders and updates the benefit with its corresponding image and alternative text', async () => {
    await TestBed.configureTestingModule({ imports: [InfoCard] }).compileComponents();
    const fixture = TestBed.createComponent(InfoCard);
    const content: InfoCardContent = {
      text: 'Sense sucres afegits ni edulcorants',
      colour: 'pink',
      image: { src: 'images/info-card/gingebre.png', alt: 'Arrel de gingebre sobre un fons rosa' },
    };
    fixture.componentRef.setInput('content', content);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('article h2')?.textContent).toBe(content.text);
    expect(element.querySelector('img')?.getAttribute('src')).toBe(content.image.src);
    expect(element.querySelector('img')?.alt).toBe(content.image.alt);
    expect(element.querySelector('article')?.getAttribute('data-colour')).toBe('pink');

    fixture.componentRef.setInput('content', {
      text: 'sense filtrar',
      colour: 'green',
      image: { src: 'images/info-card/mint.png', alt: 'Fulles de menta sobre un fons verd' },
    } satisfies InfoCardContent);
    await fixture.whenStable();
    expect(element.querySelector('h2')?.textContent).toBe('sense filtrar');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/info-card/mint.png');
    expect(element.querySelector('img')?.alt).toBe('Fulles de menta sobre un fons verd');
    expect(element.querySelector('article')?.getAttribute('data-colour')).toBe('green');
  });
});
