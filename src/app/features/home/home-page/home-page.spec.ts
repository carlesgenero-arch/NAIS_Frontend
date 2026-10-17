import { MockProductService } from '../../../testing/product-fixture';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.interface';
import { HomePage } from './home-page';
import { TranslationService } from '../../../i18n/translation.service';

beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: ProductService, useClass: MockProductService }] }));

describe('HomePage product placement', () => {
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
    expect(promotion?.nextElementSibling?.tagName.toLowerCase()).toBe('app-media-carousel');
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
    expect(promotion?.querySelector('h2')?.textContent).toBe('DESCOBREIX TOTS ELS SABORS');
    expect(promotion?.textContent).toContain('La millor manera de conèixer NAIS.');
    expect(promotion?.querySelector('.pack-cta')?.textContent).toBe('COMPRAR PACK VARIAT');
    expect(promotion?.querySelector('.pack-tagline')?.textContent).toBe('3 sabors. 1 pack.');
    translations.setLanguage('es');
    fixture.detectChanges();
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
