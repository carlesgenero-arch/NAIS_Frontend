import { MockProductService } from '../../../testing/product-fixture';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { firstValueFrom, filter } from 'rxjs';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { ProductGrid } from '../product-grid/product-grid';
import { ProductService } from '../../../services/product.service';

beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: ProductService, useClass: MockProductService }] }));

describe('Product routes', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

  it('renders the first product above the complete catalogue and forwards quantities without navigating', async () => {
    const harness = await RouterTestingHarness.create('/products');
    const element = harness.routeNativeElement!;
    const products = TestBed.inject(ProductService).activeProducts;
    const grid = harness.routeDebugElement!.query(By.directive(ProductGrid)).componentInstance as ProductGrid;
    const added = vi.fn();
    grid.addRequested.subscribe(added);
    const detail = element.querySelector('app-product-selected-detail')!;
    expect(detail.querySelector('h1')?.textContent).toBe(products[0].name);
    expect(detail.compareDocumentPosition(element.querySelector('app-product-grid')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const cards = element.querySelectorAll('app-product-shop-card');
    expect(cards.length).toBe(products.length);
    cards.forEach((card, index) => {
      expect(card.querySelector('a.product-select')?.getAttribute('href')).toBe(`/products/${products[index].slug}`);
    });
    cards[1].querySelectorAll<HTMLButtonElement>('.button--quantity')[1].click();
    harness.detectChanges();
    expect(cards[0].querySelector('output')?.textContent).toBe('1');
    expect(cards[1].querySelector('output')?.textContent).toBe('2');
    cards[1].querySelector<HTMLButtonElement>('.button--add')!.click();
    harness.detectChanges();
    expect(added).toHaveBeenCalledWith({ product: products[1], quantity: 2 });
    expect(TestBed.inject(Router).url).toBe('/products');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(products[1].name);
  });

  it('resolves every slug, updates reused detail views, and keeps nutrition and cart data', async () => {
    const harness = await RouterTestingHarness.create('/products/orange-spritz');
    const initialGrid = harness.routeNativeElement!.querySelector('app-product-grid');
    const products = TestBed.inject(ProductService).activeProducts;
    expect(new Set(products.map(product => product.slug)).size).toBe(products.length);
    for (const product of products) {
      await harness.navigateByUrl(`/products/${product.slug}`);
      const element = harness.routeNativeElement!;
      expect(element.querySelector('app-product-grid')).toBe(initialGrid);
      expect(element.querySelectorAll('app-product-shop-card').length).toBe(products.length);
      expect(element.querySelector('h1')?.textContent).toBe(product.name);
      expect(element.querySelector('.selected-detail')?.getAttribute('data-variant')).toBe(product.variant);
      expect(element.querySelector('.selected-detail__ingredients')?.textContent).toBe(product.ingredients);
      expect(Array.from(element.querySelectorAll('tbody tr'), row => row.querySelector('td')?.textContent)).toEqual((product.nutrition ?? []).map(entry => entry.value));
      element.querySelector<HTMLButtonElement>('.button--add')!.click();
      harness.detectChanges();
      expect(element.querySelector('[role="status"]')?.textContent).toContain(product.name);
    }
  });

  it('navigates through each image area while retaining the Shop detail and grid', async () => {
    const harness = await RouterTestingHarness.create('/products');
    const router = TestBed.inject(Router);
    const products = TestBed.inject(ProductService).activeProducts;
    for (const [index, product] of products.entries()) {
      const navigation = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd)));
      harness.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('a.product-visual')[index].click();
      await navigation;
      harness.detectChanges();
      expect(router.url).toBe(`/products/${product.slug}`);
      expect(harness.routeNativeElement!.querySelector('app-product-selected-detail h1')?.textContent).toBe(product.name);
      expect(harness.routeNativeElement!.querySelectorAll('app-product-shop-card').length).toBe(products.length);
    }
  });

  it('loads the assorted pack and restores selection through browser history', async () => {
    const harness = await RouterTestingHarness.create('/products/orange-spritz');
    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location);
    await harness.navigateByUrl('/products/pack-variat');
    const element = harness.routeNativeElement!;
    const pack = TestBed.inject(ProductService).products.find(product => product.slug === 'pack-variat')!;
    expect(pack.price).toBe(36);
    expect(pack.variant).toBe('assorted');
    expect(element.querySelector('.selected-detail h1')?.textContent).toBe('PACK VARIAT');
    expect(element.querySelector('.selected-detail__can')?.getAttribute('src')).toBe('images/products/assorted-pack-blue.png');
    expect(element.querySelector('.selected-detail__ingredients')).toBeNull();
    expect(element.querySelector('app-modal')).toBeNull();
    expect(element.querySelectorAll('app-product-shop-card').length).toBe(5);
    const back = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd)));
    location.back();
    await back;
    harness.detectChanges();
    expect(router.url).toBe('/products/orange-spritz');
    expect(element.querySelector('.selected-detail h1')?.textContent).toBe('ORANGE SPRITZ');
    const forward = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd)));
    location.forward();
    await forward;
    harness.detectChanges();
    expect(router.url).toBe('/products/pack-variat');
    expect(element.querySelector('.selected-detail h1')?.textContent).toBe('PACK VARIAT');
  });

  it('hides Harvest on Home and Shop and redirects direct access to the catalogue', async () => {
    const harness = await RouterTestingHarness.create('/home');
    const harvest = TestBed.inject(ProductService).products.find(product => product.isSeasonal)!;
    const selector = `a[href="/products/${harvest.slug}"]`;
    expect(harness.routeNativeElement!.querySelector(selector)).toBeNull();
    expect(harness.routeNativeElement!.textContent).not.toContain(harvest.name);
    await harness.navigateByUrl('/products');
    expect(harness.routeNativeElement!.querySelector(selector)).toBeNull();
    expect(harness.routeNativeElement!.textContent).not.toContain(harvest.name);
    await harness.navigateByUrl(`/products/${harvest.slug}`);
    expect(TestBed.inject(Router).url).toBe('/products');
    expect(harness.routeNativeElement!.querySelector(selector)).toBeNull();
  });

  it('redirects the legacy shop route and invalid slugs to the catalogue', async () => {
    const harness = await RouterTestingHarness.create('/shop');
    expect(TestBed.inject(Router).url).toBe('/products');
    expect(harness.routeNativeElement!.querySelectorAll('app-product-shop-card').length).toBe(5);
    await harness.navigateByUrl('/products/not-a-product');
    expect(TestBed.inject(Router).url).toBe('/products');
    expect(harness.routeNativeElement!.querySelector('app-product-selected-detail h1')?.textContent).toBe(TestBed.inject(ProductService).products[0].name);
    expect(harness.routeNativeElement!.querySelectorAll('app-product-shop-card').length).toBe(5);
  });
});
