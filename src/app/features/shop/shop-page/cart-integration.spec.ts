import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { Header } from '../../../core/shared/base/header/header';
import { MAX_CART_QUANTITY } from '../../../models/cart.interface';
import { CART_STORAGE_KEY, CartService } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';

describe('Shop cart integration', () => {
  beforeEach(() => {
    // Keep integration tests isolated from the user's persisted cart.
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      key: index => Array.from(values.keys())[index] ?? null,
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
    };
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage);
    TestBed.configureTestingModule({ imports: [Header], providers: [provideRouter(routes)] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function createDrawer() {
    const header = TestBed.createComponent(Header);
    header.detectChanges();
    const dialog = (header.nativeElement as HTMLElement).querySelector('dialog')!;
    const show = vi.fn(() => dialog.setAttribute('open', ''));
    Object.defineProperty(dialog, 'showModal', { value: show });
    Object.defineProperty(dialog, 'close', { value: () => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    } });
    const close = () => dialog.querySelector<HTMLButtonElement>('.modal-close')!.click();
    return { header, dialog, show, close };
  }

  it('opens the same drawer after adding every catalogue product, preserving route, totals and storage', async () => {
    const harness = await RouterTestingHarness.create('/products?from=home#catalogue');
    const { header, dialog, close } = createDrawer();
    const cart = TestBed.inject(CartService);
    const products = TestBed.inject(ProductService).products;
    const cards = harness.routeNativeElement!.querySelectorAll('app-product-shop-card');
    let quantity = 0;
    for (const [index, product] of products.entries()) {
      for (let addition = 0; addition < 2; addition++) {
        cards[index].querySelector<HTMLButtonElement>('.button--add')!.click();
        quantity++;
        header.detectChanges();
        expect(dialog.open).toBe(true);
        expect(cart.entries().find(entry => entry.productId === product.id)?.quantity).toBe(addition + 1);
        expect(header.nativeElement.querySelector('.cart__count').textContent).toBe(String(quantity));
        expect(dialog.querySelector('.title-count')?.textContent).toBe(String(quantity));
        const amount = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(cart.subtotalCents()! / 100);
        expect(dialog.querySelector('.drawer-subtotal')?.textContent).toBe(amount);
        expect(dialog.querySelector('.drawer-total')?.textContent).toBe(amount);
        expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual(cart.entries());
        expect(TestBed.inject(Router).url).toBe('/products?from=home#catalogue');
        expect(dialog.textContent).not.toContain('Preu unitari');
        close();
      }
    }
  });

  it('opens after detail additions but does not open or alter storage when the limit rejects an addition', async () => {
    const harness = await RouterTestingHarness.create('/products/orange-spritz');
    const { header, dialog, show, close } = createDrawer();
    const cart = TestBed.inject(CartService);
    const add = harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-product-selected-detail .button--add')!;
    add.click();
    header.detectChanges();
    expect(dialog.open).toBe(true);
    expect(cart.entries()).toEqual([{ productId: 'orange-spritz', quantity: 1 }]);
    close();
    cart.setQuantity('orange-spritz', MAX_CART_QUANTITY);
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    add.click();
    expect(show).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(false);
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe(stored);
    expect(TestBed.inject(Router).url).toBe('/products/orange-spritz');
  });

  it('adds from existing cards with default and selected quantities, updating the header', async () => {
    const harness = await RouterTestingHarness.create('/products');
    const header = TestBed.createComponent(Header);
    const cart = TestBed.inject(CartService);
    const products = TestBed.inject(ProductService).products;
    const cards = harness.routeNativeElement!.querySelectorAll('app-product-shop-card');
    const add = (index: number) => cards[index].querySelector<HTMLButtonElement>('.button--add')!.click();

    add(0);
    add(0);
    cards[1].querySelectorAll<HTMLButtonElement>('.button--quantity')[1].click();
    harness.detectChanges();
    add(1);
    add(0);
    harness.detectChanges();
    header.detectChanges();

    expect(cart.entries()).toEqual([
      { productId: products[0].id, quantity: 3 },
      { productId: products[1].id, quantity: 2 },
    ]);
    expect(header.nativeElement.querySelector('.cart__count').textContent).toBe('5');
    expect(harness.routeNativeElement!.querySelector('[role="status"]')?.textContent).toContain('afegit al carret');
    expect(TestBed.inject(Router).url).toBe('/products');
  });

  it('adds the selected detail product and reports a rejected addition at the limit', async () => {
    const product = TestBed.inject(ProductService).products[1];
    const harness = await RouterTestingHarness.create(`/products/${product.slug}`);
    const cart = TestBed.inject(CartService);
    const add = harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-product-selected-detail .button--add')!;
    add.click();
    expect(cart.entries()).toEqual([{ productId: product.id, quantity: 1 }]);
    cart.setQuantity(product.id, MAX_CART_QUANTITY);
    add.click();
    harness.detectChanges();
    expect(cart.totalQuantity()).toBe(MAX_CART_QUANTITY);
    expect(harness.routeNativeElement!.querySelector('[role="status"]')?.textContent).toContain("No s'ha afegit");
  });

  it('reports rejected card additions without changing the cart', async () => {
    const harness = await RouterTestingHarness.create('/products');
    const cart = TestBed.inject(CartService);
    const product = TestBed.inject(ProductService).products[0];
    cart.addItem(product.id, MAX_CART_QUANTITY);
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-product-shop-card .button--add')!.click();
    harness.detectChanges();
    expect(cart.totalQuantity()).toBe(MAX_CART_QUANTITY);
    expect(harness.routeNativeElement!.querySelector('[role="status"]')?.textContent).toContain("No s'ha afegit");
  });

  it('renders restored quantities and follows every cart mutation without a separate counter', () => {
    const [first, second] = TestBed.inject(ProductService).products;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([
      { productId: first.id, quantity: 2 }, { productId: second.id, quantity: 3 },
    ]));
    const header = TestBed.createComponent(Header);
    const cart = TestBed.inject(CartService);
    const expectCount = (count: number) => {
      header.detectChanges();
      const element = header.nativeElement as HTMLElement;
      expect(element.querySelector('.cart__count')?.textContent).toBe(String(count));
      expect(element.querySelector('[role="status"]')?.textContent).toContain('Cistella:');
    };
    expectCount(5);
    cart.increaseQuantity(first.id);
    expectCount(6);
    cart.decreaseQuantity(first.id);
    expectCount(5);
    cart.setQuantity(first.id, 4);
    expectCount(7);
    cart.removeItem(second.id);
    expectCount(4);
    cart.clearCart();
    expectCount(0);
  });
});
