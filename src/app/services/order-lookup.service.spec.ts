import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { OrderLookupService } from './order-lookup.service';

describe('OrderLookupService', () => {
  const sessionId = 'cs_test_' + 'A'.repeat(32);
  const endpoint = `/api/orders/checkout-session/${sessionId}`;
  const summary = { orderNumber: 'NAIS-TEST', paymentStatus: 'paid', fulfillmentStatus: 'pending',
    totalAmount: 3600, currency: 'eur', createdAt: '2026-10-05T10:00:00Z',
    items: [{ productName: 'Orange Spritz', quantity: 1, unitAmount: 3600, lineTotalAmount: 3600 }] };
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('uses GET with no client totals or body and returns validated summary', () => {
    const received = vi.fn();
    TestBed.inject(OrderLookupService).findByCheckoutSession(sessionId).subscribe(received);
    const request = TestBed.inject(HttpTestingController).expectOne(endpoint);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush(summary);
    expect(received).toHaveBeenCalledWith(summary);
  });
  it('returns null only for a pending/not-found order', () => {
    const received = vi.fn();
    TestBed.inject(OrderLookupService).findByCheckoutSession(sessionId).subscribe(received);
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush({ status: 'pending' }, { status: 404, statusText: 'Not Found' });
    expect(received).toHaveBeenCalledWith(null);
  });
  it('sanitizes backend failures', () => {
    const error = vi.fn();
    TestBed.inject(OrderLookupService).findByCheckoutSession(sessionId).subscribe({ error });
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush({ secret: 'private' }, { status: 503, statusText: 'Unavailable' });
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0].message).not.toContain('private');
  });
  it.each([null, {}, { ...summary, paymentStatus: ['paid'] }, { ...summary, totalAmount: 36.5 }])('rejects malformed response', body => {
    const error = vi.fn();
    TestBed.inject(OrderLookupService).findByCheckoutSession(sessionId).subscribe({ error });
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush(body);
    expect(error).toHaveBeenCalledOnce();
  });
  it('rejects malformed references without HTTP', () => {
    const error = vi.fn();
    TestBed.inject(OrderLookupService).findByCheckoutSession('../orders').subscribe({ error });
    expect(error).toHaveBeenCalledOnce();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
