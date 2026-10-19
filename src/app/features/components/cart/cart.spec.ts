import { MockProductService } from '../../../testing/product-fixture';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { Header } from '../../../core/shared/base/header/header';
import { MAX_CART_QUANTITY } from '../../../models/cart.interface';
import { CART_STORAGE_KEY, CartService } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';
import { Cart, CHECKOUT_REDIRECT } from './cart';
import { CheckoutService, type CheckoutResponse } from '../../../services/checkout.service';
import { Subject } from 'rxjs';
import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslationService } from '../../../i18n/translation.service';

beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: ProductService, useClass: MockProductService }] }));

describe('Cart page', () => {
  let response: Subject<CheckoutResponse>;
  let createCheckout: ReturnType<typeof vi.fn>;
  let redirect: ReturnType<typeof vi.fn>;
  let stored: Map<string, string>;
  const euros = (value: number) => new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(value);

  beforeEach(() => {
    response = new Subject<CheckoutResponse>();
    createCheckout = vi.fn(() => response);
    redirect = vi.fn();
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
    TestBed.configureTestingModule({ imports: [Cart, Header], providers: [provideRouter(routes),
      { provide: CheckoutService, useValue: { createCheckout } },
      { provide: CHECKOUT_REDIRECT, useValue: redirect },
    ] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('updates shipping guidance from total boxes, translates it and hides it for an empty cart', () => {
    const cart = TestBed.inject(CartService);
    const products = TestBed.inject(ProductService).products;
    const i18n = TestBed.inject(TranslationService);
    i18n.setLanguage('ca');
    const fixture = TestBed.createComponent(Cart);
    fixture.componentRef.setInput('presentation', 'drawer');
    const message = () => {
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector('.cart-shipping-message')?.textContent?.trim();
    };
    expect(message()).toBeUndefined();
    cart.addItem(products[0].id);
    expect(message()).toBe('Enviament gratuït a partir de 2 caixes.');
    cart.addItem(products[1].id);
    expect(message()).toBe('Enviament gratuït a partir de 2 caixes.');
    cart.increaseQuantity(products[0].id);
    expect(message()).toBe('Enviament gratuït a partir de 2 caixes.');
    i18n.setLanguage('es');
    expect(message()).toBe('Envío gratuito a partir de 2 cajas.');
    cart.removeItem(products[1].id);
    cart.decreaseQuantity(products[0].id);
    expect(message()).toBe('Envío gratuito a partir de 2 cajas.');
    cart.clearCart();
    expect(message()).toBeUndefined();
  });

  it.each([1, 2, 3])('includes correct shipping for %s boxes in the displayed total', quantity => {
    const cart = TestBed.inject(CartService);
    const product = TestBed.inject(ProductService).products[0];
    TestBed.inject(TranslationService).setLanguage('ca');
    cart.addItem(product.id, quantity);
    const fixture = TestBed.createComponent(Cart);
    fixture.componentRef.setInput('presentation', 'drawer');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.drawer-subtotal')?.textContent).toBe(euros(product.price! * quantity));
    expect(element.querySelector('.drawer-shipping')?.textContent).toBe(quantity === 1 ? euros(6) : 'Gratuït');
    expect(element.querySelector('.drawer-total')?.textContent).toBe(euros(product.price! * quantity + (quantity === 1 ? 6 : 0)));
  });

  it('uses the same service subtotal for both footer amounts and preserves the cart while checkout is pending', () => {
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
    expect(createCheckout).toHaveBeenCalledWith(payload.items);
    expect(checkout.disabled).toBe(true);
    expect(TestBed.inject(Router).url).toBe(url);
    expect(cart.getPayload()).toEqual(payload);
    cart.increaseQuantity(product.id);
    expectAmounts(product.price! * 3);
    cart.removeItem(product.id);
    expectAmounts(0);
    expect(checkout.disabled).toBe(true);
  });

  it('disables drawer checkout when catalogue pricing is unavailable', () => {
    const product = { ...new MockProductService().products[0], price: undefined };
    TestBed.overrideProvider(ProductService, { useValue: { ...new MockProductService(), activeProducts: [product] } });
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
    const product = { ...new MockProductService().products[0], price: undefined, imageUrl: undefined, cardImageUrl: undefined };
    TestBed.overrideProvider(ProductService, { useValue: { ...new MockProductService(), activeProducts: [product] } });
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
      expect(element.querySelector('.drawer-total')?.textContent).toBe(euros(product.price! * quantity + (quantity === 1 ? 6 : 0)));
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
    expect(dialog.querySelector('.cart-summary, .clear-cart')).toBeNull();
    expect(dialog.querySelector('.cart-legal')).toBeNull();
    expect(dialog.textContent).not.toContain('Abans de pagar, consulta:');
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
    expect(element.querySelector('.cart-items, .cart-summary')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.checkout')?.disabled).toBe(true);
  });
  function drawer() {
    const fixture = TestBed.createComponent(Cart);
    fixture.componentRef.setInput('presentation', 'drawer');
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.checkout')!;
    return { fixture, button };
  }

  it('sends current minimal items, blocks duplicate clicks and redirects externally', async () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const { fixture, button } = drawer();
    cart.setQuantity('orange-spritz', 2);
    cart.addItem('ginger-crush');
    button.click();
    button.click(); // Before change detection: the handler itself must block duplicates.
    fixture.detectChanges();
    expect(createCheckout).toHaveBeenCalledExactlyOnceWith([
      { productId: 'orange-spritz', quantity: 2 }, { productId: 'ginger-crush', quantity: 1 },
    ]);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    const route = TestBed.inject(Router).url;
    response.next({ url: 'https://checkout.stripe.com/c/pay/test' });
    await fixture.whenStable();
    expect(redirect).toHaveBeenCalledExactlyOnceWith('https://checkout.stripe.com/c/pay/test');
    expect(TestBed.inject(Router).url).toBe(route);
    expect(cart.totalQuantity()).toBe(3);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
  });

  it.each(['pageshow', 'route navigation'])('resets after %s without clearing the cart and allows a second checkout', async returnPath => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const saved = stored.get(CART_STORAGE_KEY);
    const { fixture, button } = drawer();
    button.click();
    response.next({ url: 'https://checkout.stripe.com/c/pay/test' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    button.click();
    expect(createCheckout).toHaveBeenCalledTimes(1);

    if (returnPath === 'pageshow') {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    } else {
      (TestBed.inject(Router).events as Subject<unknown>).next(new NavigationEnd(1, '/checkout/cancel', '/checkout/cancel'));
    }
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(cart.totalQuantity()).toBe(1);
    expect(stored.get(CART_STORAGE_KEY)).toBe(saved);

    response = new Subject<CheckoutResponse>();
    button.click();
    button.click();
    expect(createCheckout).toHaveBeenCalledTimes(2);
    response.next({ url: 'https://checkout.stripe.com/c/pay/second' });
    await fixture.whenStable();
    expect(redirect).toHaveBeenCalledTimes(2);
    expect(redirect).toHaveBeenLastCalledWith('https://checkout.stripe.com/c/pay/second');
    expect(cart.totalQuantity()).toBe(1);
    expect(stored.get(CART_STORAGE_KEY)).toBe(saved);
  });

  it('does not unlock a checkout request still in flight on page show or route navigation', async () => {
    TestBed.inject(CartService).addItem('orange-spritz');
    const { fixture, button } = drawer();
    button.click();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    (TestBed.inject(Router).events as Subject<unknown>).next(new NavigationEnd(1, '/products', '/products'));
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(createCheckout).toHaveBeenCalledTimes(1);
    response.next({ url: 'https://checkout.stripe.com/c/pay/test' });
    await fixture.whenStable();
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it('re-enables checkout after failure without clearing cart or persisted items', async () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz', 2);
    const saved = stored.get(CART_STORAGE_KEY);
    const { fixture, button } = drawer();
    button.click();
    response.error(new Error('private backend detail'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.checkout-status').textContent).toContain('Torna-ho a provar');
    expect(fixture.nativeElement.textContent).not.toContain('private backend detail');
    expect(cart.totalQuantity()).toBe(2);
    expect(stored.get(CART_STORAGE_KEY)).toBe(saved);
    expect(redirect).not.toHaveBeenCalled();
    response = new Subject<CheckoutResponse>();
    button.click();
    expect(createCheckout).toHaveBeenCalledTimes(2);
  });

  it('shows an associated safe error if same-tab navigation fails, preserving the cart', async () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const saved = stored.get(CART_STORAGE_KEY);
    redirect.mockImplementation(() => { throw new Error('private navigation detail'); });
    const { fixture, button } = drawer();
    button.click();
    response.next({ url: 'https://checkout.stripe.com/c/pay/test' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
    const message = fixture.nativeElement.querySelector('#drawer-checkout-error');
    expect(button.getAttribute('aria-describedby')).toBe(message.id);
    expect(message.textContent).toContain('Torna-ho a provar');
    expect(fixture.nativeElement.textContent).not.toContain('private navigation detail');
    expect(cart.totalQuantity()).toBe(1);
    expect(stored.get(CART_STORAGE_KEY)).toBe(saved);
  });

  it('cannot submit an empty cart even before the button disabled state updates', () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const { fixture, button } = drawer();
    cart.clearCart();
    button.click();
    fixture.detectChanges();
    expect(createCheckout).not.toHaveBeenCalled();
    expect(button.disabled).toBe(true);
  });

  it('cancels pending checkout on component destruction', async () => {
    TestBed.inject(CartService).addItem('orange-spritz');
    const { fixture, button } = drawer();
    button.click();
    fixture.destroy();
    response.next({ url: 'https://checkout.stripe.com/c/pay/test' });
    await Promise.resolve();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([{}, { url: '' }, { url: 'https://invalid.example' }])('shows safe error for invalid API response %j', async payload => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    TestBed.overrideProvider(CheckoutService, { useFactory: () => new CheckoutService() });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(CartService).addItem('orange-spritz');
    const saved = stored.get(CART_STORAGE_KEY);
    const { fixture, button } = drawer();
    button.click();
    http.expectOne('/api/checkout').flush(payload);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.checkout-status').textContent).toContain('Torna-ho a provar');
    expect(stored.get(CART_STORAGE_KEY)).toBe(saved);
    expect(redirect).not.toHaveBeenCalled();
    http.verify();
  });

});

describe('Checkout same-tab browser boundary', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('assigns current window location and never opens a popup', () => {
    const assign = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    TestBed.overrideProvider(DOCUMENT, { useValue: { defaultView: { location: { assign }, open } } });
    TestBed.inject(CHECKOUT_REDIRECT)('https://checkout.stripe.com/c/pay/test');
    expect(assign).toHaveBeenCalledExactlyOnceWith('https://checkout.stripe.com/c/pay/test');
    expect(open).not.toHaveBeenCalled();
  });

  it('does not attempt browser navigation during server rendering', () => {
    TestBed.overrideProvider(DOCUMENT, { useValue: { defaultView: null } });
    expect(() => TestBed.inject(CHECKOUT_REDIRECT)('https://checkout.stripe.com/c/pay/test')).not.toThrow();
  });
});
