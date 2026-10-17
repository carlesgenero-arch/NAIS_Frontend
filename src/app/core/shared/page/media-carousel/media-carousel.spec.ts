import { TestBed } from '@angular/core/testing';
import { CarouselImage } from '../../../../models/carousel-image.interface';
import { MediaCarousel } from './media-carousel';

const images: CarouselImage[] = [
  { src: 'one.jpeg', alt: 'Primera fotografia' },
  { src: 'two.jpeg', alt: 'Segona fotografia', href: '/products/orange-spritz' },
  { src: 'three.jpeg', alt: 'Tercera fotografia' },
];

describe('MediaCarousel strip', () => {
  afterEach(() => vi.unstubAllGlobals());
  async function setup(reduced = false) {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
    TestBed.configureTestingModule({ imports: [MediaCarousel] });
    const fixture = TestBed.createComponent(MediaCarousel);
    fixture.componentRef.setInput('images', images);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const scrolls = [...element.querySelectorAll<HTMLElement>('.media-carousel__card')].map(card => {
      const scroll = vi.fn(); card.scrollIntoView = scroll; return scroll;
    });
    return { fixture, element, scrolls };
  }

  it('preserves all images, optional links and accessible controls', async () => {
    const { fixture, element } = await setup();
    fixture.componentRef.setInput('label', 'Moments NAIS Drinks'); fixture.detectChanges();
    expect(element.querySelector('section')?.getAttribute('aria-label')).toBe('Moments NAIS Drinks');
    expect([...element.querySelectorAll('img')].map(img => img.getAttribute('src'))).toEqual(images.map(img => img.src));
    expect(element.querySelector('a')?.getAttribute('href')).toBe(images[1].href);
    expect(element.querySelectorAll('button')).toHaveLength(2);
  });

  it('clamps at either end, retains focus and avoids vertical page jumps', async () => {
    const { fixture, element, scrolls } = await setup();
    const previous = element.querySelector<HTMLButtonElement>('.media-carousel__arrow--left')!;
    const next = element.querySelector<HTMLButtonElement>('.media-carousel__arrow--right')!;
    previous.focus(); previous.click(); await fixture.whenStable();
    expect(scrolls[0]).toHaveBeenCalledWith({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    expect(document.activeElement).toBe(previous);
    for (let i = 0; i < 4; i++) { next.click(); await fixture.whenStable(); }
    expect(scrolls[2]).toHaveBeenCalledTimes(3);
    expect(element.querySelectorAll('img')).toHaveLength(3);
  });

  it('uses instant scrolling for reduced motion', async () => {
    const { fixture, element, scrolls } = await setup(true);
    element.querySelector<HTMLButtonElement>('.media-carousel__arrow--right')!.click();
    await fixture.whenStable();
    expect(scrolls[1]).toHaveBeenCalledWith({ behavior: 'instant', inline: 'start', block: 'nearest' });
  });

  it('scrolls for arrows, Home and End without consuming Tab or modified shortcuts', async () => {
    const { fixture, element, scrolls } = await setup();
    const control = element.querySelector('button')!;
    for (const [key, index] of [['ArrowRight', 1], ['End', 2], ['Home', 0], ['ArrowLeft', 0]] as const) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      control.dispatchEvent(event); await fixture.whenStable();
      expect(event.defaultPrevented).toBe(true);
      expect(scrolls[index]).toHaveBeenCalled();
    }
    for (const event of [new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
      new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, bubbles: true, cancelable: true })]) {
      control.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
    }
  });

  it('handles empty image data without rendering controls', async () => {
    const { fixture, element } = await setup();
    fixture.componentRef.setInput('images', []); await fixture.whenStable();
    expect(element.querySelector('section')).toBeNull();
  });
});
