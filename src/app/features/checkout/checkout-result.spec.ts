import { TranslationService } from '../../i18n/translation.service';
import { MockProductService } from '../../testing/product-fixture';
import { ProductService } from '../../services/product.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { CheckoutSuccess } from './checkout-success';
import { CheckoutCancel } from './checkout-cancel';
import { CartService, CART_STORAGE_KEY } from '../../services/cart.service';
import { PromotionModal, PROMOTION_PURCHASE_KEY } from '../../services/promotion-modal';
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
      expect(TestBed.inject(PromotionModal).purchaseSuppressed()).toBe(false);
      expect(localStorage.getItem(PROMOTION_PURCHASE_KEY)).toBeNull();
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
    expect(TestBed.inject(PromotionModal).purchaseSuppressed()).toBe(false);
    const request = TestBed.inject(HttpTestingController).expectOne(endpoint);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush(summary);
    harness.detectChanges();
    expect(page.state().status).toBe('verified');
    expect(TestBed.inject(PromotionModal).purchaseSuppressed()).toBe(true);
    expect(localStorage.getItem(PROMOTION_PURCHASE_KEY)).toBe('1');
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

  it.each(['ca', 'es'] as const)('keeps verified item amounts and total in dedicated summary fields in %s', async language => {
    const translations = TestBed.inject(TranslationService);
    translations.setLanguage(language);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    const productName = 'Pack Variat Orange Spritz Passion Hugo Ginger Crush';
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush({
      ...summary, totalAmount: 4200,
      items: [{ ...summary.items[0], productName }],
    });
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    const money = (amount: number) => new Intl.NumberFormat(translations.locale(), { style: 'currency', currency: 'eur' }).format(amount / 100);
    expect(element.querySelector('.order-items li')?.textContent).toContain(productName);
    expect(element.querySelector('.order-items .order-amount')?.textContent).toBe(money(3600));
    expect(element.querySelector('.order-total .order-amount')?.textContent).toBe(money(4200));
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/products');
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
    expect(localStorage.getItem(PROMOTION_PURCHASE_KEY)).toBeNull();
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
      expect(localStorage.getItem(PROMOTION_PURCHASE_KEY)).toBeNull();
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

  it.each(['pending', 'not_found'])('retries %s then stops when paid and only then clears the cart', async pendingStatus => {
    const cart = TestBed.inject(CartService);
    cart.addItem('orange-spritz');
    const clear = vi.spyOn(cart, 'clearCart');
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/checkout/success?session_id=${sessionId}`, CheckoutSuccess);
    vi.useFakeTimers();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(endpoint).flush({ status: pendingStatus }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(page.state().status).toBe('loading');
    expect(harness.routeNativeElement?.textContent).toContain('Estem confirmant el teu pagament…');
    expect(harness.routeNativeElement?.textContent).not.toContain('Torna a carregar');
    expect(harness.routeNativeElement?.textContent).toContain('Això pot trigar uns segons.');
    expect(harness.routeNativeElement?.querySelector('.verification-spinner')?.getAttribute('aria-hidden')).toBe('true');
    expect(harness.routeNativeElement?.querySelector('[role="status"]')).not.toBeNull();
    expect(clear).not.toHaveBeenCalled();
    const back = harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a')!;
    expect(back.classList.contains('checkout-return--secondary')).toBe(true);
    back.focus();
    vi.advanceTimersByTime(999);
    http.expectNone(endpoint);
    vi.advanceTimersByTime(1);
    http.expectOne(endpoint).flush(summary);
    expect(page.state().status).toBe('verified');
    expect(clear).toHaveBeenCalledTimes(1);
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('.verification-spinner')).toBeNull();
    expect(back.classList.contains('checkout-return--secondary')).toBe(false);
    expect(document.activeElement).toBe(back);
    vi.advanceTimersByTime(20000);
    http.expectNone(endpoint);
  });

  it.each(['ca', 'es'] as const)('shows calm pending copy after all five attempts in %s', async language => {
    TestBed.inject(TranslationService).setLanguage(language);
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
    const text = harness.routeNativeElement?.textContent;
    expect(text).toContain(TestBed.inject(TranslationService).t('checkout.pending.title'));
    expect(text).toContain(TestBed.inject(TranslationService).t('checkout.pending.hint'));
    expect(text).not.toMatch(/torna a carregar|vuelve a cargar|recarga/i);
    expect(harness.routeNativeElement?.querySelector('.verification-spinner')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('a')?.classList.contains('checkout-return--secondary')).toBe(true);
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
    harness.detectChanges();
    if (status === 503) {
      expect(harness.routeNativeElement?.textContent).toContain('No hem pogut consultar');
      expect(harness.routeNativeElement?.textContent).not.toContain('No cal que tornis a pagar');
    }
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
