import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { CheckoutSuccess } from './checkout-success';
import { CheckoutCancel } from './checkout-cancel';
import { CartService, CART_STORAGE_KEY } from '../../services/cart.service';

describe('Checkout return pages', () => {
  beforeEach(() => {
    const stored = new Map<string, string>();
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      get length() { return stored.size; },
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => { stored.set(key, value); },
      removeItem: key => { stored.delete(key); },
      clear: () => stored.clear(),
      key: index => [...stored.keys()][index] ?? null,
    });
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['/checkout/success', '/checkout/success?session_id=untrusted_reference'])(
    'reads an optional reference without claiming verified payment: %s', async path => {
      const cart = TestBed.inject(CartService);
      cart.addItem('orange-spritz');
      const before = cart.getPayload();
      const clear = vi.spyOn(cart, 'clearCart');
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      const harness = await RouterTestingHarness.create();
      const page = await harness.navigateByUrl(path, CheckoutSuccess);
      expect(page.sessionId()).toBe(path.includes('?') ? 'untrusted_reference' : null);
      expect(harness.routeNativeElement?.textContent).toContain('no confirma');
      expect(harness.routeNativeElement?.textContent).not.toContain('untrusted_reference');
      expect(harness.routeNativeElement?.querySelector('a')?.getAttribute('href')).toBe('/products');
      expect(clear).not.toHaveBeenCalled();
      expect(cart.getPayload()).toEqual(before);
      expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(saved);
    },
  );

  it('cancel keeps the cart and its storage intact', async () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('ginger-crush');
    const before = cart.getPayload();
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout/cancel', CheckoutCancel);
    expect(harness.routeNativeElement?.textContent).toContain('Checkout cancel·lat');
    expect(harness.routeNativeElement?.querySelector('a')?.getAttribute('href')).toBe('/products');
    expect(cart.getPayload()).toEqual(before);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(saved);
  });
  it('never renders a supplied session reference as HTML or payment status', async () => {
    const reference = '<img src=x onerror=alert(1)>';
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/checkout/success?session_id=' + encodeURIComponent(reference), CheckoutSuccess);
    expect(page.sessionId()).toBe(reference);
    expect(harness.routeNativeElement?.querySelector('img')).toBeNull();
    expect(harness.routeNativeElement?.textContent).not.toContain(reference);
    expect(harness.routeNativeElement?.textContent).not.toContain('completar el procés');
    expect(harness.routeNativeElement?.textContent).toContain('no confirma');
  });

});
