import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Header } from './header';
import { routes } from '../../../../app.routes';

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
