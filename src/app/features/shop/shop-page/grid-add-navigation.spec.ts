import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { ProductService } from '../../../services/product.service';
import { MockProductService } from '../../../testing/product-fixture';
import { CartService } from '../../../services/cart.service';
import { CartDrawerService } from '../../../services/cart-drawer.service';
import { MAX_CART_QUANTITY } from '../../../models/cart.interface';

describe('Shop grid add and selected detail scroll', () => {
  const scroll = vi.fn();
  let scrollDescriptor: PropertyDescriptor | undefined;
  beforeEach(() => {
    scroll.mockClear();
    scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: () => null, setItem: vi.fn(), removeItem: vi.fn(),
    } as unknown as Storage);
    TestBed.configureTestingModule({ providers: [provideRouter(routes),
      { provide: ProductService, useClass: MockProductService }] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    if (scrollDescriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollDescriptor);
    else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  it('adds the clicked product, opens the drawer and centers its detail after rendering, including repeated additions', async () => {
    const harness = await RouterTestingHarness.create('/products?from=home');
    const router = TestBed.inject(Router);
    const drawer = vi.spyOn(TestBed.inject(CartDrawerService), 'open');
    const cart = TestBed.inject(CartService);
    const product = TestBed.inject(ProductService).activeProducts[1];
    const add = async () => {
      harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('app-product-shop-card .button--add')[1].click();
      await harness.fixture.whenStable();
      harness.detectChanges();
      await harness.fixture.whenStable();
    };
    await add();
    expect(router.url).toBe(`/products/${product.slug}?from=home`);
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent).toBe(product.name);
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'center', behavior: 'instant' });
    expect(scroll.mock.contexts[0]).toBe(harness.routeNativeElement!.querySelector('.shop-detail'));
    expect(cart.entries()).toEqual([{ productId: product.id, quantity: 1 }]);
    expect(drawer).toHaveBeenCalledTimes(1);
    await add();
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(cart.totalQuantity()).toBe(2);
  });

  it('does not navigate or scroll when quantity limits reject an addition', async () => {
    const harness = await RouterTestingHarness.create('/products');
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz', MAX_CART_QUANTITY);
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-product-shop-card .button--add')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/products');
    expect(scroll).not.toHaveBeenCalled();
    expect(cart.totalQuantity()).toBe(MAX_CART_QUANTITY);
  });

});
