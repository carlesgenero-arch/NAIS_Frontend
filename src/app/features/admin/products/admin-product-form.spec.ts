import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AdminProductForm } from './admin-product-form';
import { AdminProductsService } from '../../../services/admin-products.service';
import { centsToEuro, euroToCents } from './product-price';

const product = { id: 'fixture', slug: 'fixture', name: 'Fixture product', status: 'draft' as const,
  priceCents: 3610, currency: 'eur', description: null, imageUrl: null, featureImageUrl: null,
  stripeProductId: 'prod_fixture', stripePriceId: 'price_fixture', updatedAt: '2026-01-01T00:00:00Z' };

describe('admin product form', () => {
  let http: HttpTestingController;
  function render(id?: string) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(id ? { id } : {})) } }] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AdminProductForm);
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => { http?.verify(); vi.restoreAllMocks(); });
  function fill(root: HTMLElement, selector: string, value: string) {
    const input = root.querySelector<HTMLInputElement>(selector)!;
    input.value = value; input.dispatchEvent(new Event('input'));
  }
  function submit(root: HTMLElement) { root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
  function fillNew(root: HTMLElement) {
    fill(root, '#product-name', 'Fixture product'); fill(root, '#product-slug', 'fixture'); fill(root, '#product-price', '36,10');
  }
  it('creates with integer cents and prevents duplicate submission', () => {
    const fixture = render(); const root: HTMLElement = fixture.nativeElement;
    fillNew(root); submit(root); submit(root); fixture.detectChanges();
    const request = http.expectOne('/api/admin/products');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ slug: 'fixture', name: 'Fixture product', description: null,
      status: 'draft', priceCents: 3610, currency: 'eur', imageUrl: null, featureImageUrl: null });
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    request.flush(product); fixture.detectChanges();
    expect(root.textContent).toContain('Producte creat'); expect(root.querySelector('form')).toBeNull();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledExactlyOnceWith(['/admin/products']);
  });
  it('loads and edits an existing product with read-only Stripe identifiers', () => {
    const fixture = render('fixture'); const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Carregant');
    http.expectOne('/api/admin/products/fixture').flush(product); fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('#stripe-price')!.readOnly).toBe(true);
    fill(root, '#product-name', 'Updated fixture'); submit(root);
    const request = http.expectOne('/api/admin/products/fixture'); expect(request.request.method).toBe('PATCH');
    expect(request.request.body.name).toBe('Updated fixture'); expect(request.request.body.stripePriceId).toBeUndefined();
    request.flush({ ...product, name: 'Updated fixture' }); fixture.detectChanges();
    expect(root.textContent).toContain('Producte desat');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledExactlyOnceWith(['/admin/products']);
    // Saving stays locked until navigation settles, including after the HTTP response.
    submit(root); http.expectNone('/api/admin/products/fixture');
  });
  it('rejects missing fields and fractional cents before making a request', () => {
    const fixture = render(); const root: HTMLElement = fixture.nativeElement;
    submit(root); fixture.detectChanges(); expect(root.textContent).toContain('Revisa els camps');
    fillNew(root); fill(root, '#product-price', '36.001'); submit(root);
    http.expectNone('/api/admin/products');
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
  for (const [status, code, text] of [[409, 'slug_conflict', 'Aquest slug ja existeix'],
    [400, 'product_not_purchasable', 'No es pot activar'], [503, 'unavailable', 'No s’ha pogut completar']] as const) {
    it('retains entered values and shows safe API error ' + code, () => {
      const fixture = render(); const root: HTMLElement = fixture.nativeElement;
      fillNew(root); submit(root);
      http.expectOne('/api/admin/products').flush({ status: code }, { status, statusText: 'Rejected' }); fixture.detectChanges();
      expect(root.textContent).toContain(text);
      expect(root.querySelector<HTMLInputElement>('#product-name')!.value).toBe('Fixture product');
      expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
      expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    });
  }
  it('never offers a create form when loading an existing product fails', () => {
    const fixture = render('missing');
    http.expectOne('/api/admin/products/missing').flush({}, { status: 404, statusText: 'Not found' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('service strips all operational fields from mutation input', () => {
    render(); const service = TestBed.inject(AdminProductsService);
    service.createProduct(product).subscribe();
    const request = http.expectOne('/api/admin/products');
    expect(Object.keys(request.request.body).sort()).toEqual(['currency', 'description', 'featureImageUrl', 'imageUrl', 'name', 'priceCents', 'slug', 'status']);
    request.flush(product);
  });
});

describe('admin EUR input', () => {
  it('converts without floating-point rounding', () => {
    expect(euroToCents('0.29')).toBe(29); expect(euroToCents('36,10')).toBe(3610);
    expect(centsToEuro(3610)).toBe('36.10'); expect(euroToCents('0')).toBe(0);
    expect(euroToCents('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('rejects unsafe or imprecise amounts', () => {
    for (const value of ['-1', '1.001', '1e2', 'Infinity', '', '90071992547409.92']) expect(euroToCents(value)).toBeNull();
  });
});
