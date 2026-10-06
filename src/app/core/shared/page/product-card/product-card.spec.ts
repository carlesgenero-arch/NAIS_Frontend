import { MockProductService } from '../../../../testing/product-fixture';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Product } from '../../../../models/product.interface';
import { ProductService } from '../../../../services/product.service';
import { ProductCard } from './product-card';

beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: ProductService, useClass: MockProductService }] }));

describe('ProductCard', () => {
  it('emits the current product from its optional catalogue action', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCard], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(ProductCard);
    const products = TestBed.inject(ProductService).products.filter(product => !product.isSeasonal);
    fixture.componentRef.setInput('product', products[0]);
    fixture.componentRef.setInput('presentation', 'catalogue');
    const received: Product[] = [];
    fixture.componentInstance.addRequested.subscribe(product => received.push(product));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('a.button--buy')).toBeNull();
    const button = element.querySelector<HTMLButtonElement>('button.button--add')!;
    expect(button.type).toBe('button');
    button.click();
    fixture.componentRef.setInput('product', products[1]);
    await fixture.whenStable();
    button.click();
    expect(received).toEqual([products[0], products[1]]);
  });

  it('renders all catalogue products through the same input without retaining previous content', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCard], providers: [provideRouter([])] }).compileComponents();
    const products = TestBed.inject(ProductService).products.filter(product => !product.isSeasonal);
    expect(products.map(product => product.name)).toEqual(['ORANGE SPRITZ', 'PASSION HUGO', 'GINGER CRUSH', 'TROPICAL HOPS', 'PACK VARIAT']);
    expect(new Set(products.filter(product => product.imageUrl).map(product => product.imageUrl)).size).toBe(5);
    expect(products.map(product => product.fruitImage?.url)).toEqual([
      'images/info-card/orange.png', 'images/info-card/lemon.jpg', 'images/info-card/mango.png', 'images/info-card/s_hop (2).jpg', undefined,
    ]);
    expect(products.map(product => product.variant)).toEqual(['citrus', 'botanical', 'ginger', 'tropical', 'assorted']);
    const fixture = TestBed.createComponent(ProductCard);
    const element = fixture.nativeElement as HTMLElement;
    for (const product of products) {
      fixture.componentRef.setInput('product', product);
      await fixture.whenStable();
      expect(element.querySelector('h2')?.textContent).toBe(product.name);
      expect(element.querySelector('.product-description')?.textContent).toBe(product.description);
      expect(element.querySelector('.product-ingredients')?.textContent).toBe(product.ingredients);
      expect(element.querySelector('img')?.getAttribute('src')).toBe(product.imageUrl);
      expect(element.querySelector('img')?.getAttribute('alt')).toBe(product.imageAlt);
      const preview = element.querySelector<HTMLElement>('.visual');
      expect(preview?.hasAttribute('tabindex')).toBe(!!product.fruitImage);
      expect(element.querySelector('.fruit')?.getAttribute('src')).toBe(product.fruitImage?.url);
      expect(element.querySelector('.fruit')?.getAttribute('alt')).toBe(product.fruitImage?.alt);
      if (product.fruitImage) {
        preview?.focus();
        expect(document.activeElement).toBe(preview);
      }
      expect(element.querySelectorAll('img').length).toBe((product.imageUrl ? 1 : 0) + (product.fruitImage ? 1 : 0));
      expect(element.querySelector('article')?.getAttribute('data-variant')).toBe(product.variant);
      expect(element.querySelectorAll('a.button--buy').length).toBe(1);
    }
  });

  it('renders the service product and updates when a different product is supplied', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCard], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(ProductCard);
    const firstProduct = TestBed.inject(ProductService).products[0];
    fixture.componentRef.setInput('product', firstProduct);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent).toBe('ORANGE SPRITZ');
    expect(element.querySelector('.product-description')?.textContent).toBe(firstProduct.description);
    expect(element.querySelector('.product-ingredients')?.textContent).toBe(firstProduct.ingredients);
    expect(element.querySelector('article')?.getAttribute('data-variant')).toBe('citrus');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(firstProduct.imageUrl);
    expect(element.querySelector('img')?.getAttribute('alt')).toBe(firstProduct.imageAlt);
    expect(element.querySelector('a.button--buy')?.getAttribute('href')).toBe('/products/orange-spritz');

    const nextProduct: Product = {
      status: 'active', id: 'test-product', slug: 'test-product', name: 'Test flavour', description: 'Test description',
      imageUrl: 'images/test.png', variant: 'neutral', purchaseUrl: '/test-product',
    };
    fixture.componentRef.setInput('product', nextProduct);
    await fixture.whenStable();
    expect(element.querySelector('h2')?.textContent).toBe('Test flavour');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/test.png');
    expect(element.querySelector('img')?.getAttribute('alt')).toBe('Test flavour can');
    expect(element.querySelector('article')?.getAttribute('data-variant')).toBe('neutral');
    expect(element.querySelector('.product-ingredients')).toBeNull();
    expect(element.querySelector('.fruit')).toBeNull();
    expect(element.querySelector('.visual')?.hasAttribute('tabindex')).toBe(false);
    expect(element.querySelector('a.button--buy')?.getAttribute('href')).toBe('/products/test-product');
  });
});


describe('ProductCard scroll reveal', () => {
  let notify: IntersectionObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    observe.mockClear();
    disconnect.mockClear();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    TestBed.configureTestingModule({ imports: [ProductCard], providers: [provideRouter([])] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  async function setup(enabled = true, presentation: 'editorial' | 'catalogue' = 'editorial') {
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', new MockProductService().products[0]);
    fixture.componentRef.setInput('scrollReveal', enabled);
    fixture.componentRef.setInput('presentation', presentation);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('reveals once on intersection and disconnects on destruction', async () => {
    const fixture = await setup();
    const host = fixture.nativeElement as HTMLElement;
    expect(observe).toHaveBeenCalledWith(host);
    expect(host.classList.contains('product-card--reveal')).toBe(true);
    const emit = (isIntersecting: boolean) => notify(
      [{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    emit(false);
    fixture.detectChanges();
    expect(host.classList.contains('product-card--revealed')).toBe(false);
    emit(true);
    fixture.detectChanges();
    expect(host.classList.contains('product-card--revealed')).toBe(true);
    expect(disconnect).toHaveBeenCalled();
    emit(false);
    fixture.detectChanges();
    expect(host.classList.contains('product-card--revealed')).toBe(true);
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it('reveals immediately for keyboard focus', async () => {
    const fixture = await setup();
    fixture.nativeElement.dispatchEvent(new Event('focusin'));
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('product-card--revealed')).toBe(true);
  });

  it('keeps reduced-motion content visible without observation', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const fixture = await setup();
    expect(observe).not.toHaveBeenCalled();
    expect(fixture.nativeElement.classList.contains('product-card--reveal')).toBe(false);
  });

  it('keeps content visible if IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const fixture = await setup();
    expect(fixture.nativeElement.classList.contains('product-card--reveal')).toBe(false);
  });

  it('does not observe catalogue cards or cards without opt-in', async () => {
    await setup(false);
    await setup(true, 'catalogue');
    expect(observe).not.toHaveBeenCalled();
  });
});
