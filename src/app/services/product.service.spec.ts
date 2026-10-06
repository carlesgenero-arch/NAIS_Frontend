import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductService } from './product.service';
import { CartService, CART_STORAGE_KEY } from './cart.service';
import { MockProductService } from '../testing/product-fixture';
import { HomePage } from '../features/home/home-page/home-page';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import type { PublicProduct } from '../models/public-product.interface';

const catalogue: PublicProduct[] = new MockProductService().products.map(product => ({
  id: product.id, slug: product.slug, name: product.name, description: product.description,
  status: product.status as 'active' | 'coming-soon', priceCents: 3600, currency: 'eur',
  imageUrl: product.imageUrl ?? null, featureImageUrl: product.featureImageUrl ?? null,
}));
const active = catalogue.filter(product => product.status === 'active');

describe('API product catalogue', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    const stored = new Map<string, string>();
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      get length() { return stored.size; }, getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => { stored.set(key, value); }, removeItem: key => { stored.delete(key); },
      clear: () => stored.clear(), key: index => [...stored.keys()][index] ?? null,
    });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('loads once, preserves editorial order and derives names/prices/images from the API', () => {
    const service = TestBed.inject(ProductService);
    expect(service.loading()).toBe(true);
    expect(service.products).toEqual([]);
    service.load();
    const request = http.expectOne('/api/products');
    expect(request.request.method).toBe('GET');
    request.flush([...active].reverse().map(product => product.id === 'orange-spritz'
      ? { ...product, name: 'API name', description: 'API description', priceCents: 4200, imageUrl: 'images/new.png', stripe_price_id: 'ignored' }
      : product));
    expect(service.loading()).toBe(false);
    expect(service.loaded()).toBe(true);
    expect(service.activeProducts.map(product => product.id)).toEqual(active.map(product => product.id));
    expect(service.products[0]).toMatchObject({ name: 'API name', description: 'API description', price: 42, imageUrl: 'images/new.png', variant: 'citrus' });
    expect(service.products[0]).not.toHaveProperty('stripe_price_id');
    service.load();
    http.expectNone('/api/products');
  });

  it('never falls back to hardcoded products, and supports explicit retry after failure', () => {
    const service = TestBed.inject(ProductService);
    http.expectOne('/api/products').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.loading()).toBe(false);
    expect(service.loaded()).toBe(false);
    expect(service.error()).toBeTruthy();
    expect(service.products).toEqual([]);
    service.load();
    http.expectOne('/api/products').flush(active);
    expect(service.error()).toBeNull();
    expect(service.products.length).toBe(5);
  });

  it('keeps coming-soon hidden and gives unknown active products a neutral presentation', () => {
    const service = TestBed.inject(ProductService);
    http.expectOne('/api/products').flush([...catalogue, { ...active[0], id: 'new-product', slug: 'new-product' }]);
    expect(service.activeProducts.some(product => product.id === 'tropical-hops-harvest')).toBe(false);
    expect(service.activeProducts.at(-1)?.variant).toBe('neutral');
  });

  it.each([{}, [{ ...active[0], priceCents: 1.5 }], [{ ...active[0], status: 'draft' }], [active[0], active[0]], [{ ...active[0], currency: 'usd' }]])(
    'rejects malformed or unsupported catalogue data', response => {
      const service = TestBed.inject(ProductService);
      http.expectOne('/api/products').flush(response);
      expect(service.error()).toBeTruthy();
      expect(service.loaded()).toBe(false);
      expect(service.products).toEqual([]);
    },
  );

  it('fetches detail from its own endpoint and safely handles unknown/non-active products and errors', () => {
    const service = TestBed.inject(ProductService);
    http.expectOne('/api/products').flush(active);
    const next = vi.fn();
    service.findBySlug('orange-spritz').subscribe(next);
    http.expectOne('/api/products/orange-spritz').flush({ ...active[0], name: 'Current detail' });
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Current detail' }));
    service.findBySlug('unknown').subscribe(next);
    http.expectOne('/api/products/unknown').flush({}, { status: 404, statusText: 'Not Found' });
    expect(next).toHaveBeenLastCalledWith(null);
    service.findBySlug('tropical-hops-harvest').subscribe(next);
    http.expectOne('/api/products/tropical-hops-harvest').flush(catalogue.at(-1)!);
    expect(next).toHaveBeenLastCalledWith(null);
    const error = vi.fn();
    service.findBySlug('orange-spritz').subscribe({ error });
    http.expectOne('/api/products/orange-spritz').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(error).toHaveBeenCalledWith(expect.any(Error));
    service.findBySlug('../invalid').subscribe(next);
    expect(next).toHaveBeenLastCalledWith(null);
    http.expectNone(request => request.url.includes('invalid'));
  });

  it('preserves stored cart during loading/failure and validates IDs only after a successful catalogue', () => {
    const entries = [{ productId: 'orange-spritz', quantity: 2 }, { productId: 'stale', quantity: 1 },
      { productId: 'tropical-hops-harvest', quantity: 1 }];
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(entries));
    const cart = TestBed.inject(CartService);
    expect(cart.entries()).toEqual([]);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(JSON.stringify(entries));
    http.expectOne('/api/products').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(JSON.stringify(entries));
    TestBed.inject(ProductService).load();
    http.expectOne('/api/products').flush(active);
    expect(cart.getPayload()).toEqual({ items: [{ productId: 'orange-spritz', quantity: 2 }] });
    expect(cart.totalQuantity()).toBe(2);
    expect(cart.subtotalCents()).toBe(7200);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual(cart.entries());
    expect(cart.addItem('tropical-hops-harvest')).toBe(false);
    expect(cart.addItem('orange-spritz')).toBe(true);
    expect(cart.totalQuantity()).toBe(3);
  });

  it('restores an empty successful catalogue without keeping stale purchasable items', () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ productId: 'orange-spritz', quantity: 1 }]));
    const cart = TestBed.inject(CartService);
    http.expectOne('/api/products').flush([]);
    expect(cart.entries()).toEqual([]);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it('renders Home loading then the same four alternating sections using API names', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estem carregant');
    http.expectOne('/api/products').flush(active.map(p => ({ ...p, name: 'API ' + p.name })));
    fixture.detectChanges();
    const cards = Array.from(fixture.nativeElement.querySelectorAll('app-product-card')) as HTMLElement[];
    expect(cards).toHaveLength(4);
    expect(cards[0].textContent).toContain('API ORANGE SPRITZ');
    expect(cards.map(card => card.classList.contains('product-card--image-left'))).toEqual([false, true, false, true]);
  });

  it('renders Home error without rendering a hardcoded catalogue', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    http.expectOne('/api/products').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('app-product-card').length).toBe(0);
  });

  it('loads Shop/detail asynchronously, renders errors and cancels detail HTTP after navigation', async () => {
    const harness = await RouterTestingHarness.create('/products/orange-spritz');
    expect(harness.routeNativeElement?.textContent).toContain('Estem carregant');
    http.expectOne('/api/products').flush(active);
    http.expectOne('/api/products/orange-spritz').flush({ ...active[0], name: 'API detail' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('API detail');
    expect(harness.routeNativeElement?.querySelectorAll('app-product-shop-card').length).toBe(5);
    await harness.navigateByUrl('/products/ginger-crush');
    http.expectOne('/api/products/ginger-crush').flush({}, { status: 503, statusText: 'Unavailable' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/products/ginger-crush');
    await harness.navigateByUrl('/products/passion-hugo');
    const request = http.expectOne('/api/products/passion-hugo');
    await harness.navigateByUrl('/home');
    expect(request.cancelled).toBe(true);
  });
});
