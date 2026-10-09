import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AdminOrders } from './admin-orders';
import { AdminOrderDetail } from './admin-order-detail';
import { OrderEuroPipe, PAYMENT_LABELS, FULFILLMENT_LABELS } from './order-display';
import { AdminOrdersService } from '../../../services/admin-orders.service';
import type { AdminOrder } from '../../../models/admin-order.interface';
import { routes } from '../../../app.routes';
import { adminGuard } from '../admin.guard';
import { AdminShell } from '../admin-shell';

const order: AdminOrder = {
  id: '00000000-0000-4000-8000-000000000001', orderNumber: 'NAIS-TEST-1',
  createdAt: '2026-01-01T10:00:00.000Z', paidAt: '2026-01-01T10:01:00.000Z',
  paymentStatus: 'paid', fulfillmentStatus: 'pending', totalAmount: 3750, currency: 'eur',
  customer: { name: 'Synthetic Customer', email: 'fixture@example.test', phone: '+34000000000' },
  shippingAddress: { name: 'Synthetic Recipient', line1: 'Fixture Street 1', line2: 'Floor 2', postalCode: '00000', city: 'Test City', country: 'ES' },
  items: [{ productId: 'fixture', productName: 'Historical drink', quantity: 2, unitAmount: 1800, lineTotalAmount: 3600 }],
};
describe('protected admin orders UI', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ id: order.id }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: params } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  function list() { const fixture = TestBed.createComponent(AdminOrders); fixture.detectChanges(); return fixture; }
  function detail() { const fixture = TestBed.createComponent(AdminOrderDetail); fixture.detectChanges(); return fixture; }
  function page() { return http.expectOne('/api/admin/orders?limit=25'); }
  it('renders loading and list fields with a detail link', () => {
    const fixture = list(); expect(fixture.nativeElement.textContent).toContain('Carregant');
    const request = page(); expect(request.request.method).toBe('GET');
    request.flush({ items: [order], nextCursor: null }); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    for (const value of ['NAIS-TEST-1', 'Synthetic Customer', 'fixture@example.test', 'Pagat', 'Pendent', '37,50 €', '2026-01-01 10:00']) expect(root.textContent).toContain(value);
    expect(root.querySelector('tbody a')?.getAttribute('href')).toBe('/admin/orders/' + order.id);
    expect(root.querySelector('[role="region"]')?.getAttribute('tabindex')).toBe('0');
  });
  it('renders empty and safe failure/retry states', () => {
    const fixture = list(); page().flush({ private: 'do not display' }, { status: 503, statusText: 'Unavailable' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('do not display');
    fixture.nativeElement.querySelector('button').click();
    page().flush({ items: [], nextCursor: null }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hi ha comandes');
  });
  it('appends pages, prevents duplicate loads and retains the cursor after failure', () => {
    const fixture = list(); page().flush({ items: [order], nextCursor: 'cursor+/=' }); fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click(); fixture.nativeElement.querySelector('button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregant més');
    let request = http.expectOne(r => r.url === '/api/admin/orders' && r.params.get('cursor') === 'cursor+/=');
    expect(request.request.params.get('limit')).toBe('25');
    request.flush({}, { status: 503, statusText: 'Unavailable' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(1);
    fixture.nativeElement.querySelector('button').click();
    request = http.expectOne(r => r.params.get('cursor') === 'cursor+/=');
    request.flush({ items: [{ ...order, id: '00000000-0000-4000-8000-000000000002', orderNumber: 'NAIS-TEST-2' }], nextCursor: null }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
  it('renders complete detail, stored item snapshots and EUR amounts', () => {
    const fixture = detail(); http.expectOne('/api/admin/orders/' + order.id).flush(order); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    for (const value of ['Synthetic Customer', 'Synthetic Recipient', 'fixture@example.test', '+34000000000', 'Fixture Street 1', 'Floor 2', '00000', 'Test City', 'ES', 'Historical drink', '18,00 €', '36,00 €', '37,50 €', '2026-01-01 10:01']) expect(root.textContent).toContain(value);
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/admin/orders');
  });
  it('shows unknown order and clears previous data when route changes', () => {
    const fixture = detail(); http.expectOne('/api/admin/orders/' + order.id).flush(order); fixture.detectChanges();
    params.next(convertToParamMap({ id: 'missing' })); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Synthetic Customer');
    http.expectOne('/api/admin/orders/missing').flush({}, { status: 404, statusText: 'Not found' }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No s’ha trobat aquesta comanda');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });
  it('retries detail errors and cancels pending requests on destroy', () => {
    const fixture = detail(); http.expectOne('/api/admin/orders/' + order.id).flush({}, { status: 503, statusText: 'Unavailable' }); fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    const request = http.expectOne('/api/admin/orders/' + order.id);
    fixture.destroy(); expect(request.cancelled).toBe(true);
  });
  it('never persists customer data in localStorage or sessionStorage', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const fixture = list(); page().flush({ items: [order], nextCursor: null }); fixture.detectChanges();
    const detailFixture = detail(); http.expectOne('/api/admin/orders/' + order.id).flush(order); detailFixture.detectChanges();
    fixture.destroy(); detailFixture.destroy(); expect(write).not.toHaveBeenCalled();
  });
  it('rejects malformed/unsupported monetary data', () => {
    const error = vi.fn(); TestBed.inject(AdminOrdersService).getOrder(order.id).subscribe({ error });
    http.expectOne('/api/admin/orders/' + order.id).flush({ ...order, totalAmount: 1.2 }); expect(error).toHaveBeenCalled();
  });
  it('keeps orders under admin guards and adds dashboard navigation', () => {
    const admin = routes.find(r => r.path === 'admin')!;
    expect(admin.canActivate).toContain(adminGuard); expect(admin.canActivateChild).toContain(adminGuard);
    for (const path of ['orders', 'orders/:id']) expect(admin.children?.find(r => r.path === path)?.loadComponent).toBeDefined();
    const fixture = TestBed.createComponent(AdminShell); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin/orders"]')).not.toBeNull();
  });
  it('provides readable text for every payment and fulfillment status', () => {
    expect(Object.values(PAYMENT_LABELS)).toEqual(['Pagat', 'Reemborsat parcialment', 'Reemborsat']);
    expect(Object.values(FULFILLMENT_LABELS)).toEqual(['Pendent', 'En preparació', 'Enviat', 'Lliurat', 'Cancel·lat']);
  });
  for (const [status, actions] of [
    ['pending', ['preparing', 'cancelled']], ['preparing', ['shipped', 'cancelled']],
    ['shipped', ['delivered']], ['delivered', []], ['cancelled', []],
  ] as const) it('shows only valid fulfillment actions for ' + status, () => {
    const fixture = detail(); http.expectOne('/api/admin/orders/' + order.id).flush({ ...order, fulfillmentStatus: status }); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(Array.from(root.querySelectorAll('[data-fulfillment]')).map(el => el.getAttribute('data-fulfillment'))).toEqual([...actions]);
    expect(root.querySelector('select')).toBeNull();
  });
  it('updates fulfillment only after server success and blocks duplicate submissions', () => {
    const fixture = detail(); http.expectOne('/api/admin/orders/' + order.id).flush(order); fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const button = root.querySelector<HTMLButtonElement>('[data-fulfillment="preparing"]')!;
    button.click(); button.click(); fixture.detectChanges();
    const request = http.expectOne('/api/admin/orders/' + order.id + '/fulfillment');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ fulfillmentStatus: 'preparing' });
    expect(button.disabled).toBe(true); expect(root.querySelector('dl')!.textContent).toContain('Pendent');
    request.flush({ ...order, fulfillmentStatus: 'preparing' }); fixture.detectChanges();
    expect(root.querySelector('dl')!.textContent).toContain('En preparació');
    expect(root.querySelector('dl')!.textContent).toContain('Pagat');
    expect(root.textContent).toContain('Estat de preparació actualitzat');
    expect(root.querySelector('[data-fulfillment="shipped"]')).not.toBeNull();
  });
  it('failed fulfillment update preserves the displayed snapshot and offers reload', () => {
    const fixture = detail(); http.expectOne('/api/admin/orders/' + order.id).flush(order); fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-fulfillment="preparing"]').click();
    http.expectOne('/api/admin/orders/' + order.id + '/fulfillment').flush({ status: 'order_changed' }, { status: 409, statusText: 'Conflict' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dl').textContent).toContain('Pendent');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Torna a carregar');
    expect(fixture.nativeElement.querySelector('[data-fulfillment="preparing"]').disabled).toBe(false);
  });
  it('requires cancellation confirmation and does not change payment status', () => {
    const fixture = detail(); http.expectOne('/api/admin/orders/' + order.id).flush(order); fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fixture.nativeElement.querySelector('[data-fulfillment="cancelled"]').click();
    http.expectNone('/api/admin/orders/' + order.id + '/fulfillment');
    expect(confirm.mock.calls[0][0]).toContain('no reemborsa');
    confirm.mockReturnValue(true); fixture.nativeElement.querySelector('[data-fulfillment="cancelled"]').click();
    const request = http.expectOne('/api/admin/orders/' + order.id + '/fulfillment');
    expect(request.request.body).toEqual({ fulfillmentStatus: 'cancelled' });
    request.flush({ ...order, fulfillmentStatus: 'cancelled' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-fulfillment]')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('dl').textContent).toContain('Pagat');
  });
  it('cancels a pending mutation when navigating to another order', () => {
    const fixture = detail(); http.expectOne('/api/admin/orders/' + order.id).flush(order); fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-fulfillment="preparing"]').click();
    const update = http.expectOne('/api/admin/orders/' + order.id + '/fulfillment');
    params.next(convertToParamMap({ id: 'next' })); expect(update.cancelled).toBe(true);
    http.expectOne('/api/admin/orders/next').flush({}, { status: 404, statusText: 'Not found' });
  });
});
describe('order cents to EUR', () => {
  const pipe = new OrderEuroPipe();
  it('preserves cents without floating point arithmetic', () => {
    expect(pipe.transform(3750)).toBe('37,50 €'); expect(pipe.transform(29)).toBe('0,29 €');
    expect(pipe.transform(0)).toBe('0,00 €'); expect(pipe.transform(Number.MAX_SAFE_INTEGER).endsWith(',91 €')).toBe(true);
    expect(pipe.transform(1.2)).toBe('—');
  });
});
