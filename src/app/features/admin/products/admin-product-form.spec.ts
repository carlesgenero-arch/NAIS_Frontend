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
  afterEach(() => { http?.verify(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  function fill(root: HTMLElement, selector: string, value: string) {
    const input = root.querySelector<HTMLInputElement>(selector)!;
    input.value = value; input.dispatchEvent(new Event('input'));
  }
  function submit(root: HTMLElement) { root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
  function fillNew(root: HTMLElement) {
    fill(root, '#product-name', 'Fixture product'); fill(root, '#product-slug', 'fixture'); fill(root, '#product-price', '36,10');
  }
  function selectImage(root: HTMLElement, type = 'image/png', size = 16) {
    const OriginalURL = window.URL;
    vi.stubGlobal('URL', class extends OriginalURL {
      static override createObjectURL = vi.fn(() => 'blob:synthetic-preview');
      static override revokeObjectURL = vi.fn();
    });
    const input = root.querySelector<HTMLInputElement>('#product-image-file')!;
    const file = new File([new Uint8Array(size)], 'local.png', { type });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change')); return file;
  }
  const uploaded = { imageUrl: '/images/uploads/products/fixture/00000000-0000-4000-8000-000000000001.png', updatedAt: '2026-10-20T12:00:00.000Z' };
  it('previews and uploads without a product/price PATCH, preserves unsaved fields and blocks duplicates', () => {
    const fixture = render('fixture'); const root: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/admin/products/fixture').flush({ ...product, imageUrl: 'images/old.png' }); fixture.detectChanges();
    fill(root, '#product-name', 'Unsaved name'); const file = selectImage(root); fixture.detectChanges();
    expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:synthetic-preview');
    const button = root.querySelector<HTMLButtonElement>('[data-upload-image]')!; button.click(); button.click();
    const request = http.expectOne('/api/admin/products/fixture/image');
    expect(request.request.method).toBe('POST'); expect(request.request.body instanceof FormData).toBe(true);
    expect(request.request.body.get('image')).toBe(file); expect(request.request.headers.has('Content-Type')).toBe(false);
    http.expectNone('/api/admin/products/fixture'); request.flush(uploaded); fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('#product-image')?.value).toBe(uploaded.imageUrl);
    expect(root.querySelector<HTMLInputElement>('#product-name')?.value).toBe('Unsaved name');
    expect(root.querySelector('img')?.getAttribute('src')).toBe(uploaded.imageUrl);
    expect(root.textContent).toContain('Imatge desada'); expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-preview');
  });
  it('keeps existing image reference when upload fails and allows retry', () => {
    const fixture = render('fixture'); const root: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/admin/products/fixture').flush({ ...product, imageUrl: 'images/old.png' }); fixture.detectChanges();
    selectImage(root); fixture.detectChanges(); root.querySelector<HTMLButtonElement>('[data-upload-image]')!.click();
    http.expectOne('/api/admin/products/fixture/image').flush({}, { status: 503, statusText: 'Unavailable' }); fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('#product-image')?.value).toBe('images/old.png');
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('pujada');
    const button = root.querySelector<HTMLButtonElement>('[data-upload-image]')!; expect(button.disabled).toBe(false); button.click();
    http.expectOne('/api/admin/products/fixture/image').flush(uploaded); fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('#product-image')?.value).toBe(uploaded.imageUrl);
  });
  it('creates draft before automatically uploading its selected image', () => {
    const fixture = render(); const root: HTMLElement = fixture.nativeElement;
    fillNew(root); selectImage(root); fixture.detectChanges();
    expect(root.querySelector('[data-upload-image]')).toBeNull(); submit(root); submit(root);
    http.expectOne('/api/admin/products').flush(product); fixture.detectChanges();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    http.expectOne('/api/admin/products/fixture/image').flush(uploaded); fixture.detectChanges();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledExactlyOnceWith(['/admin/products']);
  });
  it('keeps newly created draft editable if its upload fails', () => {
    const fixture = render(); const root: HTMLElement = fixture.nativeElement;
    fillNew(root); selectImage(root); submit(root);
    http.expectOne('/api/admin/products').flush(product);
    http.expectOne('/api/admin/products/fixture/image').flush({}, {status:503,statusText:'Unavailable'});fixture.detectChanges();
    expect(root.querySelector('form')).not.toBeNull(); expect(root.querySelector('[data-upload-image]')).not.toBeNull();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
  it('rejects oversized and unsupported local selections and cleans up preview on destroy', () => {
    const fixture = render('fixture'); const root: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/admin/products/fixture').flush(product); fixture.detectChanges();
    selectImage(root, 'image/svg+xml'); fixture.detectChanges(); expect(root.querySelector('[data-upload-image]')).toBeNull();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('JPEG');
    selectImage(root, 'image/png', 5 * 1024 * 1024 + 1); fixture.detectChanges(); expect(root.querySelector('[data-upload-image]')).toBeNull();
    selectImage(root); fixture.detectChanges(); fixture.destroy();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-preview');
  });
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
    [400, 'product_not_purchasable', 'No es pot activar'], [503, 'unavailable', 'El servei no està disponible'],
    [409, 'product_changed', 'El producte ha canviat'], [400, 'invalid_payload', 'Les dades no són vàlides']] as const) {
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
  for (const status of ['draft', 'coming-soon'] as const) it('confirms activation from ' + status + ' and navigates only after PATCH succeeds', () => {
    const fixture = render('fixture'); const root: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/admin/products/fixture').flush({ ...product, status, stripeProductId: null, stripePriceId: null }); fixture.detectChanges();
    const select = root.querySelector<HTMLSelectElement>('#product-status')!;
    select.value = 'active'; select.dispatchEvent(new Event('change'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    submit(root); http.expectNone('/api/admin/products/fixture');
    expect(confirm.mock.calls[0][0]).toContain('crearà o reutilitzarà');
    expect(document.activeElement).toBe(root.querySelector('button[type="submit"]'));
    confirm.mockReturnValue(true); submit(root); submit(root); fixture.detectChanges();
    const request = http.expectOne('/api/admin/products/fixture');
    expect(request.request.method).toBe('PATCH'); expect(request.request.body.status).toBe('active');
    expect(request.request.body.stripeProductId).toBeUndefined(); expect(request.request.body.stripePriceId).toBeUndefined();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    request.flush({ ...product, status: 'active' });
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledExactlyOnceWith(['/admin/products']);
  });
  it('confirms an active price change, submits cents only and navigates after success', () => {
    const fixture = render('fixture'); const root: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/admin/products/fixture').flush({ ...product, status: 'active' }); fixture.detectChanges();
    fill(root, '#product-price', '37,50');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    submit(root); http.expectNone('/api/admin/products/fixture');
    expect(confirm.mock.calls[0][0]).toContain('Price nou'); expect(confirm.mock.calls[0][0]).toContain('històric');
    confirm.mockReturnValue(true); submit(root); submit(root);
    const request = http.expectOne('/api/admin/products/fixture');
    expect(request.request.body.priceCents).toBe(3750); expect(request.request.method).toBe('PATCH');
    expect(request.request.body.stripePriceId).toBeUndefined();
    request.flush({ ...product, status: 'active', priceCents: 3750, stripePriceId: 'price_newFixture' });
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledExactlyOnceWith(['/admin/products']);
  });
  it('treats a committed price with cleanup pending as success and returns to the list', async () => {
    const fixture = render('fixture'); const root: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/admin/products/fixture').flush({ ...product, status: 'active' }); fixture.detectChanges();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fill(root, '#product-price', '37,50'); submit(root);
    http.expectOne('/api/admin/products/fixture').flush({ ...product, status: 'active', priceCents: 3750,
      stripePriceId: 'price_newFixture', stripePriceCleanupPending: true });
    fixture.detectChanges(); await fixture.whenStable();
    expect(root.querySelector('#form-error')).toBeNull();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Producte desat.');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('pendent');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledExactlyOnceWith(['/admin/products']);
    expect(root.querySelector<HTMLInputElement>('#product-price')!.value).toBe('37.50');
  });
  it('keeps a failed synchronization on the form and focuses the safe error', async () => {
    const fixture = render('fixture'); const root: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/admin/products/fixture').flush({ ...product, status: 'active' }); fixture.detectChanges();
    vi.spyOn(window, 'confirm').mockReturnValue(true); fill(root, '#product-price', '37,50'); submit(root);
    http.expectOne('/api/admin/products/fixture').flush({ status: 'unavailable', secret: 'private' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges(); await fixture.whenStable();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLInputElement>('#product-price')!.value).toBe('37,50');
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(root.textContent).not.toContain('private');
    expect(document.activeElement).toBe(root.querySelector('#form-error'));
  });
  it('views legacy Stripe mapping without writes and does not prompt for unchanged price', () => {
    const fixture = render('fixture'); const root: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/admin/products/fixture').flush({ ...product, status: 'active', stripeProductId: null }); fixture.detectChanges();
    http.expectNone('/api/admin/products/fixture');
    expect(root.querySelector<HTMLInputElement>('#stripe-product')!.readOnly).toBe(true);
    expect(root.querySelector<HTMLInputElement>('#stripe-price')!.readOnly).toBe(true);
    expect(root.querySelector('#stripe-price')!.hasAttribute('formControlName')).toBe(false);
    const confirm = vi.spyOn(window, 'confirm');
    fill(root, '#product-name', 'Updated name'); submit(root);
    expect(confirm).not.toHaveBeenCalled();
    const request = http.expectOne('/api/admin/products/fixture');
    expect(Object.keys(request.request.body).sort()).toEqual(['currency', 'description', 'featureImageUrl', 'imageUrl', 'name', 'priceCents', 'slug', 'status']);
    request.flush({ ...product, status: 'active', name: 'Updated name' });
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
