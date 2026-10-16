import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { IS_PAGES_PREVIEW, isPagesPreviewHostname } from './prelaunch-context';
import { ProductService } from './services/product.service';
import { MockProductService } from './testing/product-fixture';

 describe('prelaunch deployment context', () => {
  afterEach(() => vi.restoreAllMocks());

  it('recognizes only preview hosts belonging to this Pages project', () => {
    for (const host of ['a1b2c3d4.nais-frontend.pages.dev', 'client-demo.nais-frontend.pages.dev']) {
      expect(isPagesPreviewHostname(host)).toBe(true);
    }
    for (const host of ['naisdrinks.com', 'www.naisdrinks.com', 'nais-frontend.pages.dev',
      'localhost', 'other.pages.dev', 'demo.nais-frontend.pages.dev.attacker.com',
      'nested.demo.nais-frontend.pages.dev']) {
      expect(isPagesPreviewHostname(host)).toBe(false);
    }
  });

  async function render(preview: boolean) {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(key => key === 'nais.promotion.dismissed.v1' ? '1' : null);
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes),
      { provide: IS_PAGES_PREVIEW, useValue: preview },
      { provide: ProductService, useClass: MockProductService },
    ] }).compileComponents();
    return TestBed.createComponent(App);
  }

  it('keeps production root in prelaunch, including query strings and fragments', async () => {
    const fixture = await render(false);
    await TestBed.inject(Router).navigateByUrl('/?preview=true#home');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-prelaunch-landing')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-header')).toBeNull();
    expect(fixture.nativeElement.classList.contains('prelaunch')).toBe(true);
  });

  it('renders the full preview shell and preserves shop, detail and legal navigation', async () => {
    const fixture = await render(true);
    const router = TestBed.inject(Router);
    for (const [url, selector] of [
      ['/?demo=client#hero', 'app-home-page'],
      ['/shop?view=all#products', 'app-product-grid'],
      ['/products/passion-hugo', 'app-product-selected-detail'],
      ['/privacy', 'app-legal-page'],
      ['/', 'app-home-page'],
    ]) {
      await router.navigateByUrl(url);
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector(selector), url).not.toBeNull();
      expect(fixture.nativeElement.querySelector('app-prelaunch-landing')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-header')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('app-footer')).not.toBeNull();
      expect(fixture.nativeElement.classList.contains('prelaunch')).toBe(false);
      expect(router.url).toBe(url.startsWith('/shop') ? '/products?view=all#products' : url);
    }
  });
});
