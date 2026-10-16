import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { CartService, CART_STORAGE_KEY } from '../../services/cart.service';
import { ProductService } from '../../services/product.service';
import { MockProductService } from '../../testing/product-fixture';
import { TranslationService } from '../../i18n/translation.service';
import { ProductShopCard } from './product-shop-card/product-shop-card';
import { ProductSelectedDetail } from './product-selected-detail/product-selected-detail';

const samples = new MockProductService().products;
const harvest = { ...samples.find(p => p.id === 'tropical-hops-harvest')!, status: 'sold-out' as const };
const active = samples.find(p => p.id === 'orange-spritz')!;
const dto = (product: typeof harvest | typeof active) => ({ id: product.id, slug: product.slug, name: product.name,
  description: product.description, status: product.status, priceCents: 3600, currency: 'eur',
  imageUrl: product.imageUrl ?? null, featureImageUrl: product.featureImageUrl ?? null });

describe('Discoverable sold-out Harvest', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    const values = new Map<string, string>([[CART_STORAGE_KEY, JSON.stringify([{ productId: harvest.id, quantity: 1 }])]]);
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
    } as Storage);
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('shows featured Home, Shop and detail in CAT/ES without any Harvest purchase control', async () => {
    const harness = await RouterTestingHarness.create('/home');
    http.expectOne('/api/products').flush([dto(active), dto(harvest)]);
    harness.detectChanges();
    let root = harness.routeNativeElement!;
    expect(root.querySelector('app-product-feature-card .product-sold-out')?.textContent).toBe('SOLD OUT');
    expect(root.querySelector('app-product-feature-card .product-feature__background')?.getAttribute('src')).toBe(harvest.featureBackgroundImageUrl);
    expect(root.querySelector('app-product-feature-card a')?.getAttribute('href')).toBe('/products/' + harvest.slug);
    await harness.navigateByUrl('/products'); harness.detectChanges();
    const cards = [...harness.routeNativeElement!.querySelectorAll('app-product-shop-card')];
    expect(cards).toHaveLength(2);
    const card = cards.find(c => c.textContent?.includes(harvest.name))!;
    expect(card.querySelector('.product-sold-out')?.textContent).toBe('SOLD OUT');
    expect(card.querySelector('.button--add, .product-quantity')).toBeNull();
    expect(cards.find(c => c.textContent?.includes(active.name))?.querySelector('.button--add')).not.toBeNull();
    await harness.navigateByUrl('/products/' + harvest.slug);
    http.expectOne('/api/products/' + harvest.slug).flush(dto(harvest));
    await harness.fixture.whenStable(); harness.detectChanges();
    for (const language of ['ca', 'es'] as const) {
      TestBed.inject(TranslationService).setLanguage(language); harness.detectChanges();
      root = harness.routeNativeElement!;
      expect(root.querySelector('.selected-detail__content .product-sold-out')?.textContent).toBe('SOLD OUT');
      expect(root.querySelector('.selected-detail__add')).toBeNull();
      expect(root.querySelector('.selected-detail__can')?.getAttribute('src')).toBe(harvest.imageUrl);
      expect(root.querySelector('.selected-detail__background')?.getAttribute('src')).toBe(harvest.featureBackgroundImageUrl);
    }
    expect(TestBed.inject(Router).url).toBe('/products/' + harvest.slug);
  });

  it('rejects direct additions and cleans injected persisted sold-out entries while active items work', () => {
    const cart = TestBed.inject(CartService);
    http.expectOne('/api/products').flush([dto(active), dto(harvest)]);
    expect(TestBed.inject(ProductService).publicProducts.map(p => p.id)).toContain(harvest.id);
    expect(TestBed.inject(ProductService).activeProducts.map(p => p.id)).not.toContain(harvest.id);
    expect(cart.entries()).toEqual([]);
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    expect(cart.addItem(harvest.id)).toBe(false);
    expect(cart.addItem(active.id)).toBe(true);
    expect(cart.totalQuantity()).toBe(1);
  });

  it('does not emit add requests for a sold-out card or detail', async () => {
    const added = vi.fn();
    for (const component of [ProductShopCard, ProductSelectedDetail]) {
      const fixture = TestBed.createComponent<ProductShopCard | ProductSelectedDetail>(component);
      fixture.componentRef.setInput('product', harvest);
      fixture.componentInstance.addRequested.subscribe(added);
      fixture.detectChanges(); await fixture.whenStable();
      // Exercise the handler as well as verifying absence of a clickable CTA.
      (fixture.componentInstance as unknown as { requestAdd(): void }).requestAdd();
      expect(fixture.nativeElement.querySelector('.button--add, .selected-detail__add')).toBeNull();
      fixture.destroy();
    }
    expect(added).not.toHaveBeenCalled();
    http.expectNone('/api/products');
  });
});
