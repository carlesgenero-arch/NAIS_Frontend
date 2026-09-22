import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App routes', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App], providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('shows only the prelaunch page at the root, including query strings and fragments', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const element = fixture.nativeElement as HTMLElement;
    for (const url of ['/', '/?source=launch#coming-soon']) {
      await router.navigateByUrl(url);
      await fixture.whenStable();
      expect(element.classList.contains('prelaunch')).toBe(true);
      expect(element.querySelectorAll('main').length).toBe(1);
      expect(element.querySelector('app-prelaunch-landing h1')?.textContent).toContain('nais');
      expect(element.querySelector('app-prelaunch-landing img')?.getAttribute('alt')).toBe('NAIS Drinks');
      expect(element.querySelector('app-header, app-footer, app-navbar, app-product-grid')).toBeNull();
      expect(element.querySelector('a, button, input')).toBeNull();
    }
    expect(routes.find(route => route.path === '')?.loadComponent).toBeDefined();
  });

  it('preserves catalogue, product details and the shop redirect, then restores the landing', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const element = fixture.nativeElement as HTMLElement;
    await router.navigateByUrl('/');
    await fixture.whenStable();
    await router.navigateByUrl('/home');
    await fixture.whenStable();
    expect(element.querySelector('app-home-page')).not.toBeNull();
    expect(element.querySelector('app-hero')).not.toBeNull();
    expect(element.querySelectorAll('app-info-card').length).toBe(3);
    expect(element.querySelectorAll('a.button--buy').length).toBe(5);
    expect(element.querySelector('app-prelaunch-landing')).toBeNull();
    expect(element.querySelector('app-header')).not.toBeNull();
    expect(element.querySelector('app-footer')).not.toBeNull();
    await router.navigateByUrl('/products');
    await fixture.whenStable();
    const header = element.querySelector('app-header');
    const footer = element.querySelector('app-footer');
    expect(header).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(element.classList.contains('prelaunch')).toBe(false);
    expect(element.querySelector('app-prelaunch-landing')).toBeNull();
    expect(element.querySelectorAll('app-product-shop-card').length).toBe(6);

    await router.navigateByUrl('/products/passion-hugo');
    await fixture.whenStable();
    expect(element.querySelector('app-product-selected-detail h1')?.textContent).toBe('PASSION HUGO');
    expect(element.querySelector('app-header')).toBe(header);
    expect(element.querySelector('app-footer')).toBe(footer);

    await router.navigateByUrl('/shop?view=all#products');
    await fixture.whenStable();
    expect(router.url).toBe('/products?view=all#products');
    expect(element.querySelector('app-product-grid')).not.toBeNull();
    expect(element.querySelector('app-header')).toBe(header);
    expect(element.querySelector('app-footer')).toBe(footer);

    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(element.querySelector('app-prelaunch-landing')).not.toBeNull();
    expect(element.querySelector('app-header, app-footer, button, a')).toBeNull();
  });
});
