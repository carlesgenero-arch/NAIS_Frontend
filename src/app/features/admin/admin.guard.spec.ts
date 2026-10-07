import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { adminGuard } from './admin.guard';
import { routes } from '../../app.routes';

describe('admin routing boundary (UX only)', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function check() {
    return firstValueFrom(TestBed.runInInjectionContext(() => adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<unknown>);
  }
  it('checks backend before allowing admin', async () => {
    const result = check();
    const request = http.expectOne('/api/admin/session');
    expect(request.request.method).toBe('GET');
    request.flush({ role: 'admin' });
    expect(await result).toBe(true);
  });
  for (const status of [401, 403, 503]) {
    it(`redirects to login for ${status} without storing credentials`, async () => {
      const result = check();
      http.expectOne('/api/admin/session').flush({}, { status, statusText: 'Denied' });
      expect(await result).toEqual(TestBed.inject(Router).createUrlTree(['/admin/login']));
    });
  }
  it('rejects unexpected response and does not cache authorization', async () => {
    const first = check(); http.expectOne('/api/admin/session').flush({ role: 'admin' }); await first;
    const second = check(); http.expectOne('/api/admin/session').flush('<html>');
    expect(await second).toEqual(TestBed.inject(Router).createUrlTree(['/admin/login']));
  });
  it('protects shell and future children but leaves login reachable', () => {
    expect(routes.find(r => r.path === 'admin')?.canActivate).toContain(adminGuard);
    expect(routes.find(r => r.path === 'admin')?.canActivateChild).toContain(adminGuard);
    expect(routes.find(r => r.path === 'admin/login')?.canActivate).toBeUndefined();
  });
});
