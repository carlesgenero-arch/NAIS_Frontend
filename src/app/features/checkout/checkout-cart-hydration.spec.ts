import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Header } from '../../core/shared/base/header/header';
import { CART_STORAGE_KEY, CartService } from '../../services/cart.service';
import { CheckoutSuccess } from './checkout-success';
import { CheckoutCancel } from './checkout-cancel';

const sessionId = 'cs_test_' + 'H'.repeat(32);
const endpoint = `/api/orders/checkout-session/${sessionId}`;
const path = `/checkout/success?session_id=${sessionId}`;
const marker = 'nais.checkout.cleared.NAIS-HYDRATION-TEST';
const savedCart = JSON.stringify([{ productId: 'orange-spritz', quantity: 1 }]);
const catalogue = [{ id: 'orange-spritz', slug: 'orange-spritz', name: 'ORANGE SPRITZ', description: null,
  status: 'active', priceCents: 3600, currency: 'eur', imageUrl: null, featureImageUrl: null }];
const paid = { orderNumber: 'NAIS-HYDRATION-TEST', paymentStatus: 'paid', fulfillmentStatus: 'pending',
  totalAmount: 4200, currency: 'eur', createdAt: '2026-10-19T10:00:00.000Z',
  items: [{ productName: 'Orange Spritz', quantity: 1, unitAmount: 3600, lineTotalAmount: 3600 }] };

// Real ProductService and CartService: deliberately no preloaded catalogue mock.
describe('Paid checkout after cold cart hydration', () => {
  let stored: Map<string, string>;
  function configure() {
    TestBed.configureTestingModule({ imports: [Header], providers: [provideHttpClient(), provideHttpClientTesting(),
      provideRouter([{ path: 'checkout/success', component: CheckoutSuccess }, { path: 'checkout/cancel', component: CheckoutCancel }])] });
  }
  beforeEach(() => {
    stored = new Map([[CART_STORAGE_KEY, savedCart]]);
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: key => stored.get(key) ?? null, setItem: (key, value) => { stored.set(key, value); },
      removeItem: key => { stored.delete(key); },
    } as Storage);
    configure();
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  async function start(url = path) {
    const header = TestBed.createComponent(Header);
    header.detectChanges();
    const cart = TestBed.inject(CartService);
    const http = TestBed.inject(HttpTestingController);
    const products = http.expectOne('/api/products');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return { header, cart, http, products, harness };
  }

  it.each(['catalogue-first', 'paid-first'])('clears memory, persistence, header badge and subtotal: %s', async timing => {
    const { header, cart, http, products, harness } = await start();
    expect(cart.entries()).toEqual([]); // not restored yet, not a genuinely empty persisted cart
    expect(stored.get(CART_STORAGE_KEY)).toBe(savedCart);
    const clear = vi.spyOn(cart, 'clearCart');
    if (timing === 'catalogue-first') {
      products.flush(catalogue);
      expect(cart.totalQuantity()).toBe(1);
      expect(clear).not.toHaveBeenCalled();
      http.expectOne(endpoint).flush(paid);
    } else {
      http.expectOne(endpoint).flush(paid);
      expect(harness.routeDebugElement?.componentInstance.state().status).toBe('verified');
      expect(stored.get(CART_STORAGE_KEY)).toBe(savedCart);
      products.flush(catalogue);
    }
    header.detectChanges(); harness.detectChanges();
    expect(cart.entries()).toEqual([]);
    expect(cart.items()).toEqual([]);
    expect(cart.totalQuantity()).toBe(0);
    expect(cart.subtotalCents()).toBe(0);
    expect(stored.has(CART_STORAGE_KEY)).toBe(false);
    expect(stored.get(marker)).toBe('1');
    expect(clear).toHaveBeenCalledTimes(1);
    expect((header.nativeElement as HTMLElement).querySelector('.cart__count')?.textContent).toBe('0');
  });

  it.each([404, 503])('preserves the restored cart for pending/not-found or error: %s', async status => {
    const { cart, http, products } = await start();
    products.flush(catalogue);
    http.expectOne(endpoint).flush({ status: status === 404 ? 'not_found' : 'unavailable' }, { status, statusText: 'Response' });
    expect(cart.totalQuantity()).toBe(1);
    expect(stored.get(CART_STORAGE_KEY)).toBe(savedCart);
    expect(stored.has(marker)).toBe(false);
  });

  it('restores and preserves the cart when checkout is cancelled', async () => {
    const { cart, products, http } = await start('/checkout/cancel');
    products.flush(catalogue);
    http.expectNone(endpoint);
    expect(cart.totalQuantity()).toBe(1);
    expect(stored.get(CART_STORAGE_KEY)).toBe(savedCart);
  });

  it('stays empty after a fresh app instance verifies the same paid order again', async () => {
    const first = await start();
    first.products.flush(catalogue); first.http.expectOne(endpoint).flush(paid);
    expect(stored.has(CART_STORAGE_KEY)).toBe(false);
    first.http.verify(); TestBed.resetTestingModule(); configure();
    const second = await start();
    const clear = vi.spyOn(second.cart, 'clearCart');
    second.products.flush(catalogue); second.http.expectOne(endpoint).flush(paid);
    second.header.detectChanges();
    expect(second.cart.entries()).toEqual([]);
    expect(second.cart.subtotalCents()).toBe(0);
    expect(stored.has(CART_STORAGE_KEY)).toBe(false);
    expect(stored.get(marker)).toBe('1');
    expect(clear).not.toHaveBeenCalled();
  });

  it('does not remove a newer persisted cart written by another tab during verification', async () => {
    const { cart, products, http } = await start();
    products.flush(catalogue);
    const newer = JSON.stringify([{ productId: 'orange-spritz', quantity: 2 }]);
    stored.set(CART_STORAGE_KEY, newer);
    http.expectOne(endpoint).flush(paid);
    expect(cart.totalQuantity()).toBe(1);
    expect(stored.get(CART_STORAGE_KEY)).toBe(newer);
    expect(stored.has(marker)).toBe(false);
  });
});
