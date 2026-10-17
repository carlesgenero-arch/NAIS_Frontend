import { TestBed } from '@angular/core/testing';
import { SocialCollage } from './social-collage';
import { homeCarouselImages } from '../home-page/home-carousel-images';
import { TranslationService } from '../../../i18n/translation.service';

describe('Home social collage', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function setup() {
    await TestBed.configureTestingModule({ imports: [SocialCollage] }).compileComponents();
    const fixture = TestBed.createComponent(SocialCollage);
    fixture.componentRef.setInput('images', homeCarouselImages);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('keeps only the six lifestyle photographs in order with natural dimensions and translated alternatives', async () => {
    const { element } = await setup();
    const images = [...element.querySelectorAll('img')];
    expect(images.map(image => image.getAttribute('src'))).toEqual(homeCarouselImages.map(image => image.src));
    expect(images.map(image => image.getAttribute('src')?.split('/').at(-1))).toEqual([
      'orange-spritz-in-hand.jpeg', 'friends-toasting.jpeg', 'drinking-ginger-crush.jpeg',
      'nais-drink-in-cup.jpeg', 'offering-orange-spritz.jpeg', 'passion-hugo-in-hand.jpeg',
    ]);
    expect(images.map(image => [image.getAttribute('width'), image.getAttribute('height')]))
      .toEqual(homeCarouselImages.map(image => [String(image.width), String(image.height)]));
    expect(images.every(image => Boolean(image.alt))).toBe(true);
    expect([...element.querySelectorAll('figure')].map(item => item.getAttribute('data-image')))
      .toEqual(homeCarouselImages.map(image => image.src));
    expect(images.every(image => image.getAttribute('loading') === 'lazy')).toBe(true);
    expect(element.querySelector('header')?.nextElementSibling?.classList.contains('social-collage__photos')).toBe(true);
  });

  it('keeps the exact CAT/CAST statement without a central social link', async () => {
    const { fixture, element } = await setup();
    const translations = TestBed.inject(TranslationService);
    translations.setLanguage('ca'); fixture.detectChanges();
    expect(element.querySelector('h2')?.textContent).toBe('NAIS es beu, es comparteix i es viu.');
    expect(element.querySelector('header a')).toBeNull();
    expect(element.querySelector('header')?.textContent).not.toContain('@naisdrinks');
    translations.setLanguage('es'); fixture.detectChanges();
    expect(element.querySelector('h2')?.textContent).toBe('NAIS se bebe, se comparte y se vive.');
    translations.setLanguage('ca');
  });

  it('retains optional semantic image links and a keyboard-focusable mobile gallery', async () => {
    const { fixture, element } = await setup();
    fixture.componentRef.setInput('images', [{ src: 'sample.jpeg', alt: 'Sample', href: '/products/orange-spritz', width: 800, height: 1200 }]);
    fixture.detectChanges();
    expect(element.querySelector('.social-collage__photo a')?.getAttribute('href')).toBe('/products/orange-spritz');
    expect(element.querySelector('.social-collage__photos')?.getAttribute('tabindex')).toBe('0');
  });

  it('leaves the composition immediately visible without observers for reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const observer = vi.fn(); vi.stubGlobal('IntersectionObserver', observer);
    const { element } = await setup();
    expect(observer).not.toHaveBeenCalled();
    expect(element.querySelector('.home-motion-ready')).toBeNull();
  });
});
