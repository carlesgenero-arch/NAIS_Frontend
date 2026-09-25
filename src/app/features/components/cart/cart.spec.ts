import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { Header } from '../../../core/shared/base/header/header';
import { MAX_CART_QUANTITY } from '../../../models/cart.interface';
import { CART_STORAGE_KEY, CartService } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';
import { Cart } from './cart';

describe('Cart page', () => {
  let stored: Map<string, string>;
  const euros = (value: number) => new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(value);

  beforeEach(() => {
    stored = new Map();
    const storage: Storage = {
      get length() { return stored.size; },
      clear: () => stored.clear(),
      key: index => [...stored.keys()][index] ?? null,
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => { stored.set(key, value); },
      removeItem: key => { stored.delete(key); },
    };
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage);
    TestBed.configureTestingModule({ imports: [Cart, Header], providers: [provideRouter(routes)] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('uses the same service subtotal for both footer amounts and keeps checkout non-paying', () => {
    const cart = TestBed.inject(CartService);
    const product = TestBed.inject(ProductService).products[0];
    const fixture = TestBed.createComponent(Cart);
    fixture.componentRef.setInput('presentation', 'drawer');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const checkout = element.querySelector<HTMLButtonElement>('.checkout')!;
    const expectAmounts = (value: number) => {
      fixture.detectChanges();
      expect(element.querySelector('.drawer-subtotal')?.textContent).toBe(euros(value));
      expect(element.querySelector('.drawer-total')?.textContent).toBe(euros(value));
    };
    expectAmounts(0);
    expect(checkout.disabled).toBe(true);
    cart.addItem(product.id, 2);
    expectAmounts(product.price! * 2);
    expect(checkout.disabled).toBe(false);
    const url = TestBed.inject(Router).url;
    const payload = cart.getPayload();
    checkout.click();
    fixture.detectChanges();
    expect(element.querySelector('.checkout-status')?.textContent).toContain('No s’ha iniciat cap pagament');
    expect(TestBed.inject(Router).url).toBe(url);
    expect(cart.getPayload()).toEqual(payload);
    cart.increaseQuantity(product.id);
    expectAmounts(product.price! * 3);
    cart.removeItem(product.id);
    expectAmounts(0);
    expect(checkout.disabled).toBe(true);
  });

  it('disables drawer checkout when catalogue pricing is unavailable', () => {
    const product = { ...new ProductService().products[0], price: undefined };
    TestBed.overrideProvider(ProductService, { useValue: { products: [product] } });
    TestBed.inject(CartService).addItem(product.id);
    const fixture = TestBed.createComponent(Cart);
    fixture.componentRef.setInput('presentation', 'drawer');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.drawer-total').textContent).toBe('Preu no disponible');
    expect(fixture.nativeElement.querySelector('.checkout').disabled).toBe(true);
  });

  it('keeps the cart page available at /cart while the header exposes a drawer trigger', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/cart', Cart);
    expect(harness.routeNativeElement?.textContent).toContain('La cistella és buida');
    expect(harness.routeNativeElement?.querySelector('a')?.getAttribute('href')).toBe('/products');
    const header = TestBed.createComponent(Header);
    header.detectChanges();
    expect(header.nativeElement.querySelector('button.cart').getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('renders catalogue data and display totals, preserving a minimal stored payload', () => {
    const product = TestBed.inject(ProductService).products[0];
    stored.set(CART_STORAGE_KEY, JSON.stringify([{ productId: product.id, quantity: 2, price: 0.01 }]));
    const fixture = TestBed.createComponent(Cart);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2 a')?.textContent).toBe(product.name);
    expect(element.querySelector('img')?.getAttribute('src')).toBe(product.cardImageUrl ?? product.imageUrl);
    expect(element.textContent).not.toContain('Preu unitari');
    expect(element.querySelector('.line-total')?.textContent).toContain(euros(product.price! * 2));
    expect(element.querySelector('.subtotal')?.textContent).toBe(euros(product.price! * 2));
    expect(JSON.parse(stored.get(CART_STORAGE_KEY)!)).toEqual([{ productId: product.id, quantity: 2 }]);
    expect(element.querySelector<HTMLButtonElement>('.checkout')?.disabled).toBe(true);
  });

  it('uses service quantity operations, respects limits and removes the last item', () => {
    const cart = TestBed.inject(CartService);
    const product = TestBed.inject(ProductService).products[0];
    cart.addItem(product.id);
    const fixture = TestBed.createComponent(Cart);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const [minus, plus] = element.querySelectorAll<HTMLButtonElement>('.button--quantity');
    expect(minus.disabled).toBe(false);
    plus.click();
    fixture.detectChanges();
    expect(cart.totalQuantity()).toBe(2);
    expect(element.querySelector('.subtotal')?.textContent).toBe(euros(product.price! * 2));
    minus.click();
    expect(cart.totalQuantity()).toBe(1);
    cart.setQuantity(product.id, MAX_CART_QUANTITY);
    fixture.detectChanges();
    expect(plus.disabled).toBe(true);
    plus.click();
    expect(cart.totalQuantity()).toBe(MAX_CART_QUANTITY);
    cart.setQuantity(product.id, 1);
    fixture.detectChanges();
    minus.click();
    fixture.detectChanges();
    expect(cart.isEmpty()).toBe(true);
    expect(element.textContent).toContain('La cistella és buida');
    expect(document.activeElement).toBe(element.querySelector('.cart-page'));
  });

  it('clears all items and updates the header through shared state', () => {
    const cart = TestBed.inject(CartService);
    TestBed.inject(ProductService).products.slice(0, 2).forEach(product => cart.addItem(product.id, 2));
    const fixture = TestBed.createComponent(Cart);
    const header = TestBed.createComponent(Header);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.clear-cart')!.click();
    fixture.detectChanges();
    header.detectChanges();
    expect(fixture.nativeElement.querySelector('.cart-items')).toBeNull();
    expect(header.nativeElement.querySelector('.cart__count').textContent).toBe('0');
    expect(stored.has(CART_STORAGE_KEY)).toBe(false);
  });

  it.each(['{bad', JSON.stringify([{ productId: 'unknown', quantity: 1 }, { productId: 'orange-spritz', quantity: -1 }])])(
    'renders safely with corrupted or invalid persisted entries: %s', raw => {
      stored.set(CART_STORAGE_KEY, raw);
      const fixture = TestBed.createComponent(Cart);
      expect(() => fixture.detectChanges()).not.toThrow();
      expect(fixture.nativeElement.textContent).toContain('La cistella és buida');
    },
  );

  it('handles a product with no image or price without displaying it as free', () => {
    const product = { ...new ProductService().products[0], price: undefined, imageUrl: undefined, cardImageUrl: undefined };
    TestBed.overrideProvider(ProductService, { useValue: { products: [product] } });
    TestBed.inject(CartService).addItem(product.id);
    const fixture = TestBed.createComponent(Cart);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.subtotal').textContent).toBe('Preu no disponible');
    expect(fixture.nativeElement.querySelector('.line-total').textContent).toContain('Preu no disponible');
  });

  it('synchronizes the title, badge, totals and storage when decrement removes the last item', () => {
    const product = TestBed.inject(ProductService).products[0];
    const fixture = TestBed.createComponent(Header);
    const cart = TestBed.inject(CartService);
    const element = fixture.nativeElement as HTMLElement;
    const check = (quantity: number) => {
      fixture.detectChanges();
      expect(element.querySelector('.title-count')?.textContent).toBe(String(quantity));
      expect(element.querySelector('.cart__count')?.textContent).toBe(String(quantity));
      expect(element.querySelector('.drawer-subtotal')?.textContent).toBe(euros(product.price! * quantity));
      expect(element.querySelector('.drawer-total')?.textContent).toBe(euros(product.price! * quantity));
    };
    check(0);
    cart.addItem(product.id, 2);
    check(2);
    cart.increaseQuantity(product.id);
    check(3);
    cart.decreaseQuantity(product.id);
    check(2);
    const minus = element.querySelector<HTMLButtonElement>('.button--quantity')!;
    minus.click();
    check(1);
    expect(JSON.parse(stored.get(CART_STORAGE_KEY)!)).toEqual([{ productId: product.id, quantity: 1 }]);
    minus.click();
    check(0);
    expect(stored.has(CART_STORAGE_KEY)).toBe(false);
    expect(element.querySelector('.empty-cart')).not.toBeNull();
    expect(element.querySelector('.remove-item')).toBeNull();
    cart.addItem(product.id);
    check(1);
    cart.clearCart();
    check(0);
  });

  it('renders catalogue-backed items and the footer inside the header drawer', () => {
    const product = TestBed.inject(ProductService).products[0];
    stored.set(CART_STORAGE_KEY, JSON.stringify([{ productId: product.id, quantity: 2, price: 0.01 }]));
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    expect(dialog.querySelector('app-cart')).not.toBeNull();
    expect(dialog.querySelector('.cart-item h2')?.textContent).toContain(product.name);
    expect(dialog.querySelector('.cart-image')?.getAttribute('src')).toBe(product.cardImageUrl ?? product.imageUrl);
    expect(dialog.textContent).not.toContain('Preu unitari');
    expect(dialog.querySelector('.line-total')?.textContent).toContain(euros(product.price! * 2));
    expect(dialog.querySelector('.cart-summary, .clear-cart, a')).toBeNull();
    expect(dialog.querySelector('.drawer-total')?.textContent).toBe(euros(product.price! * 2));
    expect(JSON.parse(stored.get(CART_STORAGE_KEY)!)).toEqual([{ productId: product.id, quantity: 2 }]);
  });

  it('updates drawer quantities and line subtotals through the service, then shows the empty state', () => {
    const cart = TestBed.inject(CartService);
    const product = TestBed.inject(ProductService).products[0];
    cart.addItem(product.id);
    const fixture = TestBed.createComponent(Cart);
    fixture.componentRef.setInput('presentation', 'drawer');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const [minus, plus] = element.querySelectorAll<HTMLButtonElement>('.button--quantity');
    expect(minus.disabled).toBe(false);
    plus.click();
    fixture.detectChanges();
    expect(cart.totalQuantity()).toBe(2);
    expect(element.querySelector('output')?.textContent).toBe('2');
    expect(element.querySelector('.line-total')?.textContent).toContain(euros(product.price! * 2));
    minus.click();
    fixture.detectChanges();
    expect(cart.totalQuantity()).toBe(1);
    expect(minus.disabled).toBe(false);
    cart.setQuantity(product.id, MAX_CART_QUANTITY);
    fixture.detectChanges();
    expect(plus.disabled).toBe(true);
    plus.click();
    expect(cart.totalQuantity()).toBe(MAX_CART_QUANTITY);
    cart.setQuantity(product.id, 1);
    fixture.detectChanges();
    minus.click();
    fixture.detectChanges();
    expect(cart.isEmpty()).toBe(true);
    expect(element.querySelector('.empty-cart')?.textContent).toContain('La cistella és buida');
    expect(element.querySelector('.cart-items, .cart-summary, a')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.checkout')?.disabled).toBe(true);
  });
});
