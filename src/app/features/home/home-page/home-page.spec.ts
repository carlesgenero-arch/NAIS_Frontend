import { MockProductService } from '../../../testing/product-fixture';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.interface';
import { HomePage } from './home-page';
import { TranslationService } from '../../../i18n/translation.service';

beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: ProductService, useClass: MockProductService }] }));

describe('HomePage product placement', () => {
  it('places non-purchasable Harvest after Ginger Crush and before Pack Variat in both languages', async () => {
    const catalogue = new MockProductService();
    const products = ['orange-spritz', 'passion-hugo', 'ginger-crush', 'tropical-hops-harvest', 'pack-variat']
      .map(id => catalogue.products.find(product => product.id === id)!);
    for (const status of ['coming-soon', 'sold-out'] as const) {
      TestBed.resetTestingModule();
      const publicProducts = products.map(product => product.isSeasonal ? { ...product, status } : product);
      await TestBed.configureTestingModule({ imports: [HomePage], providers: [provideRouter([]),
        { provide: ProductService, useValue: { ...catalogue, publicProducts } },
      ] }).compileComponents();
      const fixture = TestBed.createComponent(HomePage);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const feature = element.querySelector('app-product-feature-card')!;
      expect(element.querySelectorAll('app-product-feature-card')).toHaveLength(1);
      expect(feature.previousElementSibling?.querySelector('h2')?.textContent).toBe('GINGER CRUSH');
      expect(feature.nextElementSibling?.tagName.toLowerCase()).toBe('app-assorted-pack-promotion');
      expect(feature.querySelector('button')).toBeNull();
      expect(feature.querySelector('a')?.getAttribute('href')).toBe('/products/tropical-hops-harvest');
      const translations = TestBed.inject(TranslationService);
      for (const language of ['ca', 'es'] as const) {
        translations.setLanguage(language);
        fixture.detectChanges();
        expect(feature.querySelector('.product-feature__edition')).toBeNull();
        expect(feature.querySelector('.product-sold-out')?.textContent ?? null).toBe(status === 'sold-out' ? 'SOLD OUT' : null);
      }
      expect(publicProducts.find(product => product.isSeasonal)?.status).toBe(status);
      fixture.destroy();
    }
  });

  it('restores the original translated introduction and preserves all three benefit bubbles', async () => {
    await TestBed.configureTestingModule({ imports: [HomePage], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(HomePage);
    const translations = TestBed.inject(TranslationService);
    translations.setLanguage('ca');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const section = element.querySelector('.info-section')!;
    const bubbles = Array.from(section.querySelectorAll('app-info-card'));
    expect(bubbles.length).toBe(3);
    const images = bubbles.map(bubble => bubble.querySelector('img')?.getAttribute('src'));
    expect(images.every(Boolean)).toBe(true);
    expect(section.getAttribute('aria-labelledby')).toBe('info-heading');
    expect(section.querySelector('h1')?.textContent).toBe(translations.t('ui.que_es_nais'));
    expect(section.querySelectorAll('.info-introduction h1, .info-introduction h2').length).toBe(2);
    expect(section.querySelector('h2#info-heading')?.textContent).toBe('REAL FRUIT MOCKTAILS');
    expect(element.querySelectorAll('#info-heading')).toHaveLength(1);
    expect(section.querySelector('.info-introduction p')?.textContent).toBe(translations.t('ui.beguda_sense_alcohol_a_base_de_sucs_naturals_i_botanics'));
    expect(bubbles.every(bubble => !!bubble.querySelector('h2')?.textContent?.trim())).toBe(true);
    translations.setLanguage('es');
    fixture.detectChanges();
    expect(section.querySelector('h2#info-heading')?.textContent).toBe('REAL FRUIT MOCKTAILS');
    expect(section.querySelector('h1')?.textContent).toBe(translations.t('ui.que_es_nais'));
    expect(section.querySelector('.info-introduction p')?.textContent).toBe(translations.t('ui.beguda_sense_alcohol_a_base_de_sucs_naturals_i_botanics'));
    expect(Array.from(section.querySelectorAll('app-info-card img')).map(image => image.getAttribute('src'))).toEqual(images);
    expect(bubbles.every(bubble => !!bubble.querySelector('h2')?.textContent?.trim())).toBe(true);
    translations.setLanguage('ca');
  });

  it('shows the four active regular products without the coming-soon Harvest', async () => {
    await TestBed.configureTestingModule({ imports: [HomePage], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    const cards = Array.from(element.querySelectorAll('app-product-card, app-product-feature-card'));
    expect(cards.map(card => card.tagName.toLowerCase())).toEqual([
      ...Array(4).fill('app-product-card'),
    ]);
    expect(cards.map(card => card.classList.contains('product-card--image-left'))).toEqual([false, true, false, true]);
    expect(cards.map(card => card.querySelector('h2')?.textContent)).toEqual([
      'ORANGE SPRITZ', 'PASSION HUGO', 'GINGER CRUSH', 'TROPICAL HOPS',
    ]);
    for (const card of cards) {
      expect(card.querySelector('.product-ingredients')).toBeNull();
      expect(card.querySelector('.product-description')?.textContent?.trim()).not.toBe('');
      expect(card.querySelector('a.button--buy')).not.toBeNull();
    }
    const promotion = element.querySelector('app-assorted-pack-promotion');
    expect(promotion).not.toBeNull();
    expect(promotion?.previousElementSibling).toBe(cards.at(-1));
    const collage = promotion?.nextElementSibling;
    expect(collage?.tagName.toLowerCase()).toBe('app-social-collage');
    const statement = collage?.querySelector('h2');
    expect(collage?.querySelector('header')?.hasAttribute('homeReveal')).toBe(true);
    expect(promotion?.querySelector('a')?.getAttribute('href')).toBe('/products/pack-variat');
    const packLink = promotion?.querySelector('a.pack-feature');
    expect(packLink?.getAttribute('href')).toBe('/products/pack-variat');
    expect(packLink?.getAttribute('aria-label')).toBeTruthy();
    expect(packLink?.querySelector('img')?.getAttribute('src')).toBe('images/products/pack_3.png');
    const stickers = promotion?.querySelector('.pack-botanicals');
    expect(stickers?.previousElementSibling?.classList.contains('pack-copy')).toBe(true);
    expect(stickers?.nextElementSibling?.classList.contains('pack-cta')).toBe(true);
    expect(stickers?.parentElement?.classList.contains('pack-content')).toBe(true);
    expect(packLink?.contains(stickers ?? null)).toBe(false);
    expect(Array.from(stickers?.querySelectorAll('img') ?? []).map(image => image.getAttribute('src')))
      .toEqual(['images/info-card/orange.png', 'images/info-card/mint.png',
        'images/info-card/gingebre.png', 'images/info-card/raspberries (1).png',
        'images/info-card/lemon.jpg', 'images/info-card/mango.png']);
    const translations = TestBed.inject(TranslationService);
    translations.setLanguage('ca');
    fixture.detectChanges();
    expect(statement?.textContent).toBe('NAIS es beu, es comparteix i es viu.');
    expect(promotion?.querySelector('h2')?.textContent).toBe('DESCOBREIX TOTS ELS SABORS');
    expect(promotion?.textContent).toContain('La millor manera de conèixer NAIS.');
    expect(promotion?.querySelector('.pack-cta')?.textContent).toBe('COMPRAR PACK VARIAT');
    expect(promotion?.querySelector('.pack-tagline')?.textContent).toBe('3 sabors. 1 pack.');
    translations.setLanguage('es');
    fixture.detectChanges();
    expect(statement?.textContent).toBe('NAIS se bebe, se comparte y se vive.');
    expect(promotion?.querySelector('h2')?.textContent).toBe('DESCUBRE TODOS LOS SABORES');
    expect(promotion?.textContent).toContain('La mejor manera de probar NAIS.');
    expect(promotion?.querySelector('.pack-cta')?.textContent).toBe('COMPRAR PACK VARIADO');
    expect(promotion?.querySelector('.pack-tagline')?.textContent).toBe('3 sabores. 1 pack.');
    expect(promotion?.querySelector('a')?.getAttribute('href')).toBe('/products/pack-variat');
    translations.setLanguage('ca');
  });

  it('selects featured and seasonal products only, including products with both flags once', async () => {
    const base: Product = { status: 'active', id: 'regular', slug: 'regular', name: 'Regular', description: 'Descripció' };
    const products: Product[] = [base,
      { ...base, id: 'featured', slug: 'featured', isFeatured: true },
      { ...base, id: 'seasonal', slug: 'seasonal', isSeasonal: true },
      { ...base, id: 'both', slug: 'both', isFeatured: true, isSeasonal: true },
    ];
    await TestBed.configureTestingModule({
      imports: [HomePage], providers: [provideRouter([]), { provide: ProductService, useValue: { ...new MockProductService(), activeProducts: products, publicProducts: products } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(Array.from(element.querySelectorAll('app-product-feature-card a')).map(link => link.getAttribute('href')))
      .toEqual(['/products/featured', '/products/seasonal', '/products/both']);
    expect(element.querySelectorAll('app-product-card').length).toBe(1);
    expect(element.querySelector('app-assorted-pack-promotion')).toBeNull();
  });
});
