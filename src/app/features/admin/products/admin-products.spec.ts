import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminProducts } from './admin-products';
import { AdminShell } from '../admin-shell';
import { AdminProductsService } from '../../../services/admin-products.service';
import type { AdminProductSummary } from '../../../models/admin-product.interface';
import { routes } from '../../../app.routes';
import { adminGuard } from '../admin.guard';

const products: AdminProductSummary[] = (['active', 'coming-soon', 'draft', 'archived'] as const).map((status, index) => ({
  id: 'test-' + index, slug: 'test-slug-' + index, name: 'Synthetic product ' + index, status,
  priceCents: 3600, currency: 'eur', stripeProductId: index ? null : 'prod_fixture',
  stripePriceId: index ? null : 'price_fixture', updatedAt: '2026-01-01T10:00:00.000Z',
}));
describe('admin products', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  function render() {
    const fixture = TestBed.createComponent(AdminProducts);
    fixture.detectChanges();
    return fixture;
  }
  it('shows loading before the protected GET returns', () => {
    const fixture = render();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Carregant');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    const request = http.expectOne('/api/admin/products');
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush([]);
  });
  it('renders all operational columns, statuses and admin actions', () => {
    const fixture = render();
    http.expectOne('/api/admin/products').flush(products);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('thead th')).toHaveLength(10);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(Array.from(root.querySelectorAll('.status-badge')).map(node => node.textContent?.trim()))
      .toEqual(['Actiu', 'Properament', 'Esborrany', 'Arxivat']);
    expect(root.textContent).toContain('Synthetic product 0');
    expect(root.textContent).toContain('test-slug-0');
    expect(root.textContent).toContain('36.00');
    expect(root.textContent).toContain('EUR');
    expect(root.textContent).toContain('prod_fixture');
    expect(root.textContent).toContain('price_fixture');
    expect(root.textContent).toContain('No assignat');
    expect(root.textContent).toContain('2026-01-01 10:00');
    expect(root.querySelector('[role="region"]')?.getAttribute('tabindex')).toBe('0');
    expect(root.querySelectorAll('tbody button')).toHaveLength(4);
  });
  it('shows an empty state', () => {
    const fixture = render(); http.expectOne('/api/admin/products').flush([]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hi ha productes');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });
  it('requires confirmation and keeps archived products visible', () => {
    const fixture = render(); http.expectOne('/api/admin/products').flush(products); fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fixture.nativeElement.querySelector('tbody button').click();
    http.expectNone('/api/admin/products/test-0/archive');
    confirm.mockReturnValue(true); fixture.nativeElement.querySelector('tbody button').click();
    const request = http.expectOne('/api/admin/products/test-0/archive');
    expect(request.request.method).toBe('POST'); expect(request.request.body).toEqual({});
    request.flush({ ...products[0], status: 'archived', description: null, imageUrl: null, featureImageUrl: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('tbody .status-badge').textContent).toContain('Arxivat');
    expect(fixture.nativeElement.querySelector('tbody button').disabled).toBe(true);
  });
  it('preserves the row when archive fails', () => {
    const fixture = render(); http.expectOne('/api/admin/products').flush(products); fixture.detectChanges();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.nativeElement.querySelector('tbody button').click();
    http.expectOne('/api/admin/products/test-0/archive').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('tbody .status-badge').textContent).toContain('Actiu');
    expect(fixture.nativeElement.querySelector('tbody button').disabled).toBe(false);
  });
  it('shows a safe error and allows retry', () => {
    const fixture = render();
    http.expectOne('/api/admin/products').flush({ secret: 'not for display' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('not for display');
    fixture.nativeElement.querySelector('button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregant');
    http.expectOne('/api/admin/products').flush(products); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(4);
  });
  for (const status of [401, 403]) it('handles access denial ' + status, () => {
    const fixture = render();
    http.expectOne('/api/admin/products').flush({}, { status, statusText: 'Denied' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"] a').getAttribute('href')).toBe('/admin/login');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });
  it('rejects invalid API responses rather than treating them as an empty catalogue', () => {
    const error = vi.fn();
    TestBed.inject(AdminProductsService).list().subscribe({ error });
    http.expectOne('/api/admin/products').flush('<html>Login</html>');
    expect(error).toHaveBeenCalled();
  });
  it('projects only the typed operational fields and preserves all statuses', () => {
    const next = vi.fn();
    TestBed.inject(AdminProductsService).list().subscribe(next);
    http.expectOne('/api/admin/products').flush(products.map(p => ({ ...p, unrelated: 'ignored' })));
    expect(next).toHaveBeenCalledWith(products);
  });
  it('cancels pending HTTP on navigation away', () => {
    const fixture = render(); const request = http.expectOne('/api/admin/products');
    fixture.destroy(); expect(request.cancelled).toBe(true);
  });
  it('adds products under the existing guarded layout and links from the dashboard', () => {
    const admin = routes.find(route => route.path === 'admin');
    expect(admin?.canActivate).toContain(adminGuard);
    expect(admin?.canActivateChild).toContain(adminGuard);
    expect(admin?.children?.find(route => route.path === 'products')?.loadComponent).toBeDefined();
    expect(admin?.children?.find(route => route.path === 'products/new')?.loadComponent).toBeDefined();
    expect(admin?.children?.find(route => route.path === 'products/:id/edit')?.loadComponent).toBeDefined();
    const fixture = TestBed.createComponent(AdminShell); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav a').getAttribute('href')).toBe('/admin/products');
  });
});
