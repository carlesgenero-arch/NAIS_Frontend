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
    expect(element.querySelector('img')?.parentElement?.classList.contains('info-card__bubble')).toBe(true);
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


it('starts idle only after the revealed image finishes its transform transition', async () => {
  TestBed.configureTestingModule({ imports: [InfoCard] });
  const fixture = TestBed.createComponent(InfoCard);
  fixture.componentRef.setInput('content', { text: 'Benefit', colour: 'pink', image: { src: 'bubble.png', alt: 'Bubble' } });
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const image = host.querySelector('img')!;
  const end = (propertyName: string) => {
    const event = new Event('transitionend', { bubbles: true });
    Object.defineProperty(event, 'propertyName', { value: propertyName });
    image.dispatchEvent(event); fixture.detectChanges();
  };
  end('transform');
  expect(host.classList.contains('bubble-idle')).toBe(false);
  host.classList.add('home-motion-revealed');
  end('opacity');
  expect(host.classList.contains('bubble-idle')).toBe(false);
  end('transform');
  expect(host.classList.contains('bubble-idle')).toBe(true);
});
