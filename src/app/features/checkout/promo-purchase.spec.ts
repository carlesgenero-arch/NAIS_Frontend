import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { ProductService } from '../../services/product.service';
import { MockProductService } from '../../testing/product-fixture';
import { PROMOTION_PURCHASE_KEY } from '../../services/promotion-modal';

describe('Purchase confirmation promo suppression', () => {
  let showDescriptor: PropertyDescriptor | undefined;
  let closeDescriptor: PropertyDescriptor | undefined;
  beforeEach(() => {
    // jsdom does not implement the native dialog API used by afterNextRender.
    showDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    });
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      const values = new Map<string, string>();
      vi.spyOn(window, name, 'get').mockReturnValue({
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); },
      } as Storage);
    }
    TestBed.configureTestingModule({ imports: [App], providers: [
      provideRouter(routes), provideHttpClient(), provideHttpClientTesting(),
      { provide: ProductService, useClass: MockProductService },
    ] });
  });
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } finally {
      TestBed.resetTestingModule();
      vi.restoreAllMocks();
      for (const [name, descriptor] of [['showModal', showDescriptor], ['close', closeDescriptor]] as const) {
        if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
      }
      document.documentElement.classList.remove('nais-drawer-open');
      document.documentElement.lang = 'ca';
    }
  });

  it('does not mount the popup during confirmation and keeps it suppressed on return to the shop after paid verification', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const root = fixture.nativeElement as HTMLElement;
    await router.navigateByUrl('/products');
    await fixture.whenStable();
    expect(root.querySelector('app-promotion dialog[open]')).not.toBeNull();
    const sessionId = 'cs_test_' + 'P'.repeat(32);
    await router.navigateByUrl(`/checkout/success?session_id=${sessionId}`);
    await fixture.whenStable();
    expect(root.querySelector('app-promotion')).toBeNull();
    expect(document.documentElement.classList.contains('nais-drawer-open')).toBe(false);
    expect(localStorage.getItem(PROMOTION_PURCHASE_KEY)).toBeNull();
    TestBed.inject(HttpTestingController).expectOne(`/api/orders/checkout-session/${sessionId}`).flush({
      orderNumber: 'NAIS-TEST', paymentStatus: 'paid', fulfillmentStatus: 'pending',
      totalAmount: 3600, currency: 'eur', createdAt: '2026-10-05T10:00:00.000Z',
      items: [{ productName: 'Orange Spritz', quantity: 1, unitAmount: 3600, lineTotalAmount: 3600 }],
    });
    await fixture.whenStable();
    expect(localStorage.getItem(PROMOTION_PURCHASE_KEY)).toBe('1');
    await router.navigateByUrl('/products');
    await fixture.whenStable();
    expect(root.querySelector('app-promotion')).toBeNull();
  });

  it('does not persist suppression from a success URL alone and leaves normal eligible visitors unchanged', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/checkout/success?session_id=untrusted');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-promotion')).toBeNull();
    expect(localStorage.getItem(PROMOTION_PURCHASE_KEY)).toBeNull();
    await router.navigateByUrl('/products');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-promotion dialog[open]')).not.toBeNull();
  });
});
