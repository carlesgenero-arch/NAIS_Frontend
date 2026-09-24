import { TestBed } from '@angular/core/testing';
import { CarouselImage } from '../../../../models/carousel-image.interface';
import { MediaCarousel } from './media-carousel';

const images: CarouselImage[] = [
  { src: 'one.jpeg', alt: 'Primera fotografia' },
  { src: 'two.jpeg', alt: 'Segona fotografia', href: '/products/orange-spritz' },
  { src: 'three.jpeg', alt: 'Tercera fotografia' },
];

describe('MediaCarousel', () => {
  async function setup(initialImages: readonly CarouselImage[] = images) {
    await TestBed.configureTestingModule({ imports: [MediaCarousel] }).compileComponents();
    const fixture = TestBed.createComponent(MediaCarousel);
    fixture.componentRef.setInput('images', initialImages);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('moves both ways, wraps at the ends, and retains focus on its controls', async () => {
    const { fixture, element } = await setup();
    const previous = element.querySelector<HTMLButtonElement>('[aria-label="Imatge anterior"]')!;
    const next = element.querySelector<HTMLButtonElement>('[aria-label="Imatge següent"]')!;
    expect(element.querySelector('img')?.getAttribute('alt')).toBe(images[0].alt);
    previous.focus();
    previous.click();
    await fixture.whenStable();
    expect(element.querySelector('img')?.getAttribute('src')).toBe(images[2].src);
    expect(document.activeElement).toBe(previous);
    next.click();
    await fixture.whenStable();
    expect(element.querySelector('[role="status"]')?.textContent).toBe('Imatge 1 de 3');
    expect(element.querySelectorAll('img').length).toBe(1);
  });

  it('supports arrow, Home and End keys without intercepting Tab or modified shortcuts', async () => {
    const { fixture, element } = await setup();
    const next = element.querySelector<HTMLButtonElement>('[aria-label="Imatge següent"]')!;
    for (const [key, expected] of [['ArrowRight', 1], ['End', 2], ['Home', 0], ['ArrowLeft', 2]] as const) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      next.dispatchEvent(event);
      await fixture.whenStable();
      expect(event.defaultPrevented).toBe(true);
      expect(element.querySelector('img')?.getAttribute('src')).toBe(images[expected].src);
    }
    for (const event of [new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
      new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, bubbles: true, cancelable: true })]) {
      next.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
  });

  it('renders optional links and resets safely when the input changes or becomes empty', async () => {
    const { fixture, element } = await setup();
    element.querySelector<HTMLButtonElement>('[aria-label="Imatge següent"]')!.click();
    await fixture.whenStable();
    expect(element.querySelector('a')?.getAttribute('href')).toBe(images[1].href);
    expect(element.querySelector('a img')?.getAttribute('alt')).toBe(images[1].alt);
    fixture.componentRef.setInput('images', [images[0]]);
    await fixture.whenStable();
    expect(element.querySelector('img')?.getAttribute('src')).toBe(images[0].src);
    expect(element.querySelector('a')).toBeNull();
    expect(element.querySelector('button')).toBeNull();
    fixture.componentRef.setInput('images', []);
    await fixture.whenStable();
    expect(element.querySelector('section')).toBeNull();
  });
});
