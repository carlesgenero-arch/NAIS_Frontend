import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

 describe('App routes', () => {
  it('lazy-loads Home and Shop behind the same shared header and footer', async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const navbar = element.querySelector('app-navbar');
    const footer = element.querySelector('app-footer');
    expect(element.querySelectorAll('footer').length).toBe(1);
    expect(footer?.querySelector('a[href="https://www.instagram.com/naisdrinks/"]')).not.toBeNull();
    expect(footer?.querySelector('a[href="mailto:hola@naisdrinks.com"]')).not.toBeNull();
    expect(element.querySelector('main app-footer')).toBeNull();
    const shopButton = element.querySelector<HTMLButtonElement>('nav .shop')!;
    expect(shopButton.hidden).toBe(false);
    expect(element.querySelectorAll('app-navbar').length).toBe(1);
    expect(element.querySelector('app-hero')).not.toBeNull();
    expect(element.querySelectorAll('app-info-card').length).toBe(3);
    expect(element.querySelectorAll('a.button--buy').length).toBe(5);
    expect(routes.find(route => route.path === 'products')?.loadComponent).toBeDefined();
    expect(routes.find(route => route.path === 'products')?.component).toBeUndefined();

    const purchaseLinks = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.button--buy'));
    expect(purchaseLinks.map(link => link.getAttribute('href'))).toEqual([
      '/products/tropical-hops-harvest', '/products/orange-spritz', '/products/passion-hugo', '/products/ginger-crush', '/products/tropical-hops',
    ]);
    purchaseLinks[2].click();
    await fixture.whenStable();
    expect(router.url).toBe('/products/passion-hugo');
    expect(element.querySelector('app-product-selected-detail h1')?.textContent).toBe('PASSION HUGO');

    await router.navigateByUrl('/shop');
    await fixture.whenStable();
    expect(element.querySelector('app-navbar')).toBe(navbar);
    expect(element.querySelector('app-footer')).toBe(footer);
    expect(element.querySelectorAll('footer').length).toBe(1);
    expect(shopButton.hidden).toBe(true);
    expect(element.querySelector('app-hero')).toBeNull();
    expect(element.querySelectorAll('app-product-grid').length).toBe(1);
    expect(element.querySelectorAll('app-product-shop-card').length).toBe(6);
    expect(element.querySelectorAll('app-product-grid button.button--add').length).toBe(6);
    expect(element.querySelector('a.button--buy')).toBeNull();

    await router.navigateByUrl('/shop?view=all#products');
    await fixture.whenStable();
    expect(shopButton.hidden).toBe(true);

    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(shopButton.hidden).toBe(false);
    expect(element.querySelector('app-hero')).not.toBeNull();
    expect(element.querySelector('.button--add')).toBeNull();
  });
});
