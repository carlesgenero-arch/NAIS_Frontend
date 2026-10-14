import { provideLocationMocks } from '@angular/common/testing';
import { Location, ViewportScroller } from '@angular/common';
import { APP_BOOTSTRAP_LISTENER, ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Scroll } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom, Subject } from 'rxjs';
import { appConfig } from '../../../app.config';
import { Product } from '../../../models/product.interface';
import { ProductService } from '../../../services/product.service';
import { MockProductService } from '../../../testing/product-fixture';

describe('Product navigation', () => {
  const viewport = {
    setHistoryScrollRestoration: vi.fn(), getScrollPosition: () => [0, 1800],
    scrollToPosition: vi.fn(), scrollToAnchor: vi.fn(), setOffset: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      ...appConfig.providers, provideLocationMocks(),
      { provide: ProductService, useClass: MockProductService },
      { provide: ViewportScroller, useValue: viewport },
    ] });
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({ getItem: () => null, setItem: vi.fn() } as unknown as Storage);
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.clearAllMocks(); });

  it('uses the Home buy link and focuses the selected detail without changing the URL contract', async () => {
    const harness = await RouterTestingHarness.create('/home');
    const link = harness.routeNativeElement!.querySelector<HTMLAnchorElement>('app-product-card .button--buy')!;
    const expectedUrl = link.getAttribute('href');
    link.focus();
    link.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(expectedUrl);
    const heading = harness.routeNativeElement!.querySelector('app-product-selected-detail h1');
    expect(heading).not.toBeNull();
    expect(document.activeElement).toBe(heading);
    expect(harness.routeNativeElement!.querySelector('.selected-detail__ingredients')?.textContent?.toLocaleUpperCase('ca').replaceAll(' · ', ', '))
      .toBe(TestBed.inject(ProductService).products.find(product => expectedUrl === `/products/${product.slug}`)?.ingredients);
  });

  it('leaves query parameters and fragments intact and does not override fragment focus', async () => {
    const harness = await RouterTestingHarness.create('/products');
    await TestBed.inject(Router).navigateByUrl('/products/ginger-crush?from=home#shop-heading', { info: 'focus-product-detail' });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/products/ginger-crush?from=home#shop-heading');
    expect(document.activeElement).not.toBe(harness.routeNativeElement!.querySelector('h1'));
  });

  it('does not steal focus if the user interacts while the product loads', async () => {
    const harness = await RouterTestingHarness.create('/home');
    const response = new Subject<Product | null>();
    vi.spyOn(TestBed.inject(ProductService), 'findBySlug').mockReturnValue(response);
    await TestBed.inject(Router).navigateByUrl('/products/orange-spritz', { info: 'focus-product-detail' });
    await harness.fixture.whenStable();
    const control = harness.routeNativeElement!.querySelector<HTMLAnchorElement>('app-product-shop-card a')!;
    control.focus();
    response.next(TestBed.inject(ProductService).products[0]);
    response.complete();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(control);
  });

  it('enables Angular top scrolling, history restoration and fragment scrolling', async () => {
    const harness = await RouterTestingHarness.create('/products');
    // The harness creates a fixture, not an application bootstrap. Run the actual
    // bootstrap listeners to initialize Angular's configured scroll feature.
    const app = TestBed.inject(ApplicationRef);
    app.components.push(harness.fixture.componentRef);
    for (const listener of TestBed.inject(APP_BOOTSTRAP_LISTENER)) listener(harness.fixture.componentRef);
    app.components.pop();
    const router = TestBed.inject(Router);
    const nextScroll = () => firstValueFrom(router.events.pipe(filter(event => event instanceof Scroll)));
    let scroll = nextScroll();
    await router.navigateByUrl('/products/orange-spritz');
    await scroll;
    expect(viewport.scrollToPosition).toHaveBeenLastCalledWith([0, 0]);
    scroll = nextScroll();
    await router.navigateByUrl('/products/ginger-crush#shop-heading');
    await scroll;
    expect(viewport.scrollToAnchor).toHaveBeenLastCalledWith('shop-heading');
    scroll = nextScroll();
    TestBed.inject(Location).back();
    await scroll;
    expect(viewport.scrollToPosition).toHaveBeenLastCalledWith([0, 1800], { behavior: 'instant' });
    expect(document.activeElement).not.toBe(harness.routeNativeElement!.querySelector('h1'));
  });
});
