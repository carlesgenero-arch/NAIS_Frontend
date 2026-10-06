import { MockProductService } from '../../testing/product-fixture';
import { ProductService } from '../../services/product.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { CheckoutSuccess } from './checkout-success';
import { CheckoutCancel } from './checkout-cancel';
import { CartService, CART_STORAGE_KEY } from '../../services/cart.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

const sessionId = 'cs_test_' + 'A'.repeat(32);
const endpoint = `/api/orders/checkout-session/${sessionId}`;
const summary = {
  orderNumber: 'NAIS-TEST', paymentStatus: 'paid', fulfillmentStatus: 'pending',
  totalAmount: 3600, currency: 'eur', createdAt: '2026-10-05T10:00:00.000Z',
  items: [{ productName: 'Orange Spritz', quantity: 1, unitAmount: 3600, lineTotalAmount: 3600 }],
};

beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: ProductService, useClass: MockProductService }] }));

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
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

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

  it('shows loading then verified data and clears the cart only after backend confirmation', async () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const clear = vi.spyOn(cart, 'clearCart');
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    expect(page.state().status).toBe('loading');
    expect(clear).not.toHaveBeenCalled();
    const request = TestBed.inject(HttpTestingController).expectOne(endpoint);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush(summary);
    harness.detectChanges();
    expect(page.state().status).toBe('verified');
    expect(harness.routeNativeElement?.textContent).toContain('Pagament confirmat');
    expect(harness.routeNativeElement?.textContent).toContain('NAIS-TEST');
    expect(harness.routeNativeElement?.textContent).toContain('Orange Spritz');
    expect(clear).toHaveBeenCalledTimes(1);
    expect(cart.isEmpty()).toBe(true);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    cart.addItem('ginger-crush');
    await harness.navigateByUrl('/checkout/cancel', CheckoutCancel);
    await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush(summary);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(cart.entries()[0].productId).toBe('ginger-crush');
  });

  it.each([404, 503])('preserves cart for pending/error response %s', async status => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush({ status: 'pending' }, { status, statusText: 'Unavailable' });
    harness.detectChanges();
    expect(page.state().status).toBe(status === 404 ? 'loading' : 'error');
    expect(harness.routeNativeElement?.textContent).not.toContain('Pagament confirmat');
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(saved);
  });

  it('does not clear a cart changed while waiting for confirmation', async () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    cart.addItem('ginger-crush');
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush(summary);
    expect(cart.totalQuantity()).toBe(2);
  });

  it.each([{ ...summary, paymentStatus: 'refunded' }, { orderNumber: 'fake', paymentStatus: 'paid' }])(
    'does not clear for non-paid or malformed backend response', async response => {
      const cart = TestBed.inject(CartService);
      cart.addItem('orange-spritz');
      const harness = await RouterTestingHarness.create();
      const page = await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
      TestBed.inject(HttpTestingController).expectOne(endpoint).flush(response);
      expect(page.state().status).not.toBe('verified');
      expect(cart.totalQuantity()).toBe(1);
    },
  );

  it('keeps cart when acknowledgement storage fails', async () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush(summary);
    expect(page.state().status).toBe('verified');
    expect(cart.totalQuantity()).toBe(1);
  });

  it('retries pending then stops when paid and only then clears the cart', async () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const clear = vi.spyOn(cart, 'clearCart');
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    vi.useFakeTimers();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(endpoint).flush({ status: 'pending' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(page.state().status).toBe('loading');
    expect(harness.routeNativeElement?.textContent).toContain('Estem confirmant la teva comanda.');
    expect(harness.routeNativeElement?.textContent).not.toContain('Torna a carregar');
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    http.expectNone(endpoint);
    vi.advanceTimersByTime(1);
    http.expectOne(endpoint).flush(summary);
    expect(page.state().status).toBe('verified');
    expect(clear).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20000);
    http.expectNone(endpoint);
  });

  it('shows manual reload only after all five pending attempts', async () => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    vi.useFakeTimers();
    const http = TestBed.inject(HttpTestingController);
    for (const delay of [1000, 2000, 4000, 6000]) {
      http.expectOne(endpoint).flush({ status: 'pending' }, { status: 404, statusText: 'Not Found' });
      expect(page.state().status).toBe('loading');
      vi.advanceTimersByTime(delay - 1);
      http.expectNone(endpoint);
      vi.advanceTimersByTime(1);
    }
    http.expectOne(endpoint).flush({ status: 'pending' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(page.state().status).toBe('pending');
    expect(harness.routeNativeElement?.textContent).toContain('Torna a carregar');
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(saved);
    vi.advanceTimersByTime(20000);
    http.expectNone(endpoint);
  });

  it.each([200, 503])('does not retry immediate paid or hard error response %s', async status => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    vi.useFakeTimers();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(endpoint).flush(status === 200 ? summary : {}, { status, statusText: 'Response' });
    expect(page.state().status).toBe(status === 200 ? 'verified' : 'error');
    vi.advanceTimersByTime(20000);
    http.expectNone(endpoint);
  });

  it('cancels pending retries when the component is destroyed', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    vi.useFakeTimers();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(endpoint).flush({ status: 'pending' }, { status: 404, statusText: 'Not Found' });
    harness.fixture.destroy();
    vi.advanceTimersByTime(20000);
    http.expectNone(endpoint);
  });

});
