import { MockProductService } from '../../../../testing/product-fixture';
import { ProductService } from '../../../../services/product.service';
import { TestBed } from '@angular/core/testing';
import { NavigationStart, provideRouter, Router } from '@angular/router';
import { Header } from './header';
import { routes } from '../../../../app.routes';

beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: ProductService, useClass: MockProductService }] }));

describe('Header cart drawer', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Header], providers: [provideRouter(routes)] });
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('disabled in test'); });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    document.documentElement.classList.remove('nais-drawer-open');
  });

  function setup() {
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog')!;
    const trigger = element.querySelector<HTMLButtonElement>('button.cart')!;
    // jsdom does not implement native modal focus/top-layer behavior.
    Object.defineProperty(dialog, 'showModal', { value: vi.fn(() => dialog.setAttribute('open', '')) });
    Object.defineProperty(dialog, 'close', { value: vi.fn(() => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    }) });
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(500, 0, 480, 800));
    return { fixture, dialog, trigger };
  }

  it('keeps the secondary symbol decorative and non-interactive beside the cart', () => {
    const { fixture, dialog } = setup();
    const symbol = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('img.brand-mark')!;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    expect(symbol.getAttribute('src')).toBe('images/brand/nais logos-10.png');
    expect(symbol.alt).toBe('');
    expect(symbol.closest('a, button')).toBeNull();
    expect(symbol.hasAttribute('tabindex')).toBe(false);
    expect(getComputedStyle(symbol).cursor).toBe('default');
    symbol.click();
    expect(dialog.open).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('uses a mobile picture source while preserving the desktop logo and accessible home link', async () => {
    await TestBed.inject(Router).navigateByUrl('/products');
    const { fixture } = setup();
    const brand = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a.brand')!;
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.getAttribute('aria-label')).toBe('NAIS Drinks, inici');
    const source = brand.querySelector('source')!;
    expect(source.getAttribute('media')).toBe('(max-width: 47.99rem)');
    expect(source.getAttribute('srcset')).toBe('images/brand/nais%20logos-03.svg');
    expect(brand.querySelector('img')?.getAttribute('src')).toBe('images/brand/nais logos-02.svg');
    expect(brand.querySelector('img')?.alt).toBe('NAIS Drinks');
  });

  it('opens without navigation, locks scrolling and returns focus after close', () => {
    const { fixture, dialog, trigger } = setup();
    const router = TestBed.inject(Router);
    const url = router.url;
    const navigate = vi.spyOn(router, 'navigateByUrl');
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('La meva cistella');
    expect(dialog.querySelector('.modal-close')?.getAttribute('aria-label')).toBe('Tancar cistella');
    expect(dialog.querySelector('.modal-close')?.textContent).toBe('X');
    expect(document.activeElement).toBe(dialog.querySelector('.modal-close'));
    expect(dialog.classList.contains('drawer')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.documentElement.classList.contains('nais-drawer-open')).toBe(true);
    dialog.querySelector<HTMLButtonElement>('.modal-close')!.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.documentElement.classList.contains('nais-drawer-open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(router.url).toBe(url);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['/', '/?source=demo#top'])('renders a non-interactive home logo at %s', async url => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const { fixture } = setup();
    const starts: NavigationStart[] = [];
    const subscription = router.events.subscribe(event => {
      if (event instanceof NavigationStart) starts.push(event);
    });
    const element = fixture.nativeElement as HTMLElement;
    const brand = element.querySelector<HTMLElement>('.brand')!;
    expect(brand.tagName).toBe('DIV');
    expect(element.querySelector('a.brand')).toBeNull();
    expect(brand.querySelector('img')?.alt).toBe('NAIS Drinks');
    expect(brand.hasAttribute('href')).toBe(false);
    expect(brand.hasAttribute('tabindex')).toBe(false);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    brand.dispatchEvent(click);
    await fixture.whenStable();
    expect(router.url).toBe(url);
    expect(navigate).not.toHaveBeenCalled();
    expect(starts).toHaveLength(0);
    subscription.unsubscribe();
  });

  it('navigates from Shop to home through the accessible logo link', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products');
    const { fixture } = setup();
    const brand = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a.brand')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    brand.dispatchEvent(click);
    await fixture.whenStable();
    expect(click.defaultPrevented).toBe(true);
    expect(router.url).toBe('/');
    expect((fixture.nativeElement as HTMLElement).querySelector('a.brand')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.brand')?.tagName).toBe('DIV');
    await router.navigateByUrl('/products');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('a.brand')?.getAttribute('href')).toBe('/');
  });

  it('closes on the backdrop and Escape cancellation but not clicks inside the panel', () => {
    const { dialog, trigger } = setup();
    trigger.click();
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 600, clientY: 200, bubbles: true }));
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 200, bubbles: true }));
    expect(dialog.open).toBe(false);
    expect(document.documentElement.classList.contains('nais-drawer-open')).toBe(false);
    trigger.click();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dialog.open).toBe(false);
    expect(document.documentElement.classList.contains('nais-drawer-open')).toBe(false);
  });

  it('releases the scroll lock when the open drawer is destroyed', () => {
    const { fixture, trigger } = setup();
    trigger.click();
    fixture.destroy();
    expect(document.documentElement.classList.contains('nais-drawer-open')).toBe(false);
  });

  it('ignores a delayed native close event after the drawer has reopened', () => {
    const { dialog, trigger } = setup();
    trigger.focus();
    trigger.click();
    dialog.querySelector<HTMLButtonElement>('.modal-close')!.click();
    trigger.click();
    dialog.dispatchEvent(new Event('close'));
    expect(dialog.open).toBe(true);
    expect(document.documentElement.classList.contains('nais-drawer-open')).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('.modal-close'));
  });

  it.each(['/home', '/products', '/products/orange-spritz?from=shop#details', '/cart'])(
    'preserves the complete route while opening and closing from %s', async url => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl(url);
      const { dialog, trigger } = setup();
      trigger.click();
      expect(router.url).toBe(url);
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(router.url).toBe(url);
    },
  );
});
