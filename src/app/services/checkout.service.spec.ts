import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let http: HttpTestingController;
  const url = 'https://checkout.stripe.com/c/pay/cs_test_fixture';
  const safeError = "No s'ha pogut iniciar el pagament. Torna-ho a provar.";

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CheckoutService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('POSTs only IDs and quantities, leaving enriched input unchanged', async () => {
    const items = [Object.freeze({ productId: 'orange-spritz', quantity: 2,
      price: 36, subtotal: 72, total: 72, shipping: 0, currency: 'eur',
      stripePriceId: 'price_untrusted', discount: 10, successUrl: 'https://evil.example',
    })];
    const result = firstValueFrom(service.createCheckout(items));
    const req = http.expectOne('/api/checkout');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ items: [{ productId: 'orange-spritz', quantity: 2 }] });
    req.flush({ url, internal: 'not exposed' });
    expect(await result).toEqual({ url });
    expect(items[0].price).toBe(36);
  });

  it('preserves multiple product IDs and quantities', async () => {
    const items = [{ productId: 'orange-spritz', quantity: 1 }, { productId: 'ginger-crush', quantity: 3 }];
    const result = firstValueFrom(service.createCheckout(items));
    const req = http.expectOne('/api/checkout');
    expect(req.request.body).toEqual({ items });
    req.flush({ url });
    expect(await result).toEqual({ url });
  });

  it.each([null, {}, { url: null }, { url: 42 }, { url: '' }, { url: ' ' },
    { url: 'not a URL' }, { url: '/checkout' }, { url: 'javascript:alert(1)' },
    { url: 'http://checkout.stripe.com' }, { url: 'https://evil.example' },
    { url: 'https://checkout.stripe.com.evil.example' },
    { url: 'https://user:pass@checkout.stripe.com' }, { url: 'https://checkout.stripe.com:444' },
  ])('rejects invalid response safely: %j', async payload => {
    const result = firstValueFrom(service.createCheckout([{ productId: 'orange-spritz', quantity: 1 }]));
    const assertion = expect(result).rejects.toThrow(safeError);
    http.expectOne('/api/checkout').flush(payload);
    await assertion;
  });

  it.each([400, 403, 503, 502, 500])('surfaces a safe error for backend status %s', async status => {
    const result = firstValueFrom(service.createCheckout([]));
    const assertion = expect(result).rejects.toThrow(safeError);
    http.expectOne('/api/checkout').flush({ error: 'private Stripe details' }, { status, statusText: 'Failure' });
    await assertion;
  });

  it('surfaces network failure safely', async () => {
    const result = firstValueFrom(service.createCheckout([]));
    const assertion = expect(result).rejects.toThrow(safeError);
    http.expectOne('/api/checkout').error(new ProgressEvent('error'));
    await assertion;
  });
});
