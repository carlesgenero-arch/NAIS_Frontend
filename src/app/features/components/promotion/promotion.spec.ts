import { TurnstileService } from '../../../services/turnstile.service';
import { PromoSignupService } from '../../../services/promo-signup.service';
import { TestBed } from '@angular/core/testing';
import { Promotion, PROMOTION_SESSION_KEY } from './promotion';
import { PromotionModal, PROMOTION_PURCHASE_KEY } from '../../../services/promotion-modal';

describe('Promotion', () => {
  const register = vi.fn();
  let values: Map<string, string>;
  let showDescriptor: PropertyDescriptor | undefined;
  let closeDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    register.mockReset().mockResolvedValue('registered');
    values = new Map();
    const storage: Storage = {
      get length() { return values.size; },
      key: index => [...values.keys()][index] ?? null,
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
      clear: () => values.clear(),
    };
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(storage);
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({ getItem: () => null, setItem: vi.fn() } as unknown as Storage);
    showDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); } });
    TestBed.configureTestingModule({ imports: [Promotion], providers: [{ provide: PromoSignupService, useValue: { register } }, { provide: TurnstileService, useValue: { mount: async (_container: HTMLElement, _language: string, token: (value: string) => void) => { token('test-token'); return { reset: () => token('fresh-token'), destroy: vi.fn() }; } } }] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    for (const [name, descriptor] of [['showModal', showDescriptor], ['close', closeDescriptor]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
    document.documentElement.classList.remove('nais-drawer-open');
  });

  async function create() {
    const fixture = TestBed.createComponent(Promotion);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('opens once with HTML copy over the background and no URL change', async () => {
    const url = window.location.href;
    const { fixture, element } = await create();
    const dialog = element.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-label')).toBe('ACONSEGUEIX UN 10% DE DESCOMPTE');
    expect(element.querySelector('h2')?.textContent).toContain('ACONSEGUEIX UN 10% DE DESCOMPTE');
    expect(element.querySelector('img')).toBeNull();
    expect(dialog.classList.contains('promotion')).toBe(true);
    expect(document.activeElement).toBe(element.querySelector('.modal-close'));
    fixture.detectChanges();
    expect(window.location.href).toBe(url);
  });

  it('never opens automatically or through the promo control after a confirmed purchase', async () => {
    const store = new Map<string, string>();
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => { store.set(key, value); },
    } as Storage);
    const promo = TestBed.inject(PromotionModal);
    promo.suppressAfterPurchase();
    const { element } = await create();
    promo.open();
    expect(element.querySelector('dialog')!.open).toBe(false);
    expect([...store]).toEqual([[PROMOTION_PURCHASE_KEY, '1']]);
  });

  it('restores only the non-sensitive suppression flag after a refresh', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: key => key === PROMOTION_PURCHASE_KEY ? '1' : null,
    } as Storage);
    const { element } = await create();
    expect(element.querySelector('dialog')!.open).toBe(false);
  });

  it('keeps purchase suppression in memory if storage is unavailable', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw Error('Storage unavailable'); });
    const promo = TestBed.inject(PromotionModal);
    expect(() => promo.suppressAfterPurchase()).not.toThrow();
    expect((await create()).element.querySelector('dialog')!.open).toBe(false);
  });

  it.each(['button', 'escape', 'overlay'])('persists dismissal through %s and does not reopen on remount', async method => {
    const { fixture, element } = await create();
    const dialog = element.querySelector('dialog')!;
    if (method === 'button') element.querySelector<HTMLButtonElement>('.modal-close')!.click();
    if (method === 'escape') dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    if (method === 'overlay') {
      vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 400, 500));
      dialog.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));
    }
    expect(dialog.open).toBe(false);
    expect([...values]).toEqual([[PROMOTION_SESSION_KEY, '1']]);
    expect(document.documentElement.classList.contains('nais-drawer-open')).toBe(false);
    fixture.destroy();
    expect((await create()).element.querySelector('dialog')!.open).toBe(false);
  });

  it('rejects invalid emails and stores only a flag after valid UI submission', async () => {
    const { fixture, element } = await create();
    const input = element.querySelector('input')!;
    const form = element.querySelector('form')!;
    for (const email of ['', 'invalid', 'user@domain']) {
      input.value = email;
      input.dispatchEvent(new Event('input'));
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      fixture.detectChanges();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(element.querySelector('#promotion-error')?.textContent).toContain('vàlid');
      expect(values.size).toBe(0);
    }
    expect(register).not.toHaveBeenCalled();
    input.value = ' person@example.com ';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(register).toHaveBeenCalledExactlyOnceWith('person@example.com', 'test-token');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Revisa el teu correu');
    expect(element.querySelector('input')).toBeNull();
    expect(document.activeElement).toBe(element.querySelector('.modal-close'));
    expect([...values]).toEqual([[PROMOTION_SESSION_KEY, '1']]);
  });

  it('cannot submit without verification, or after its token expires', async () => {
    let receiveToken!: (value: string) => void;
    TestBed.overrideProvider(TurnstileService, { useValue: {
      mount: async (_container: HTMLElement, _language: string, token: (value: string) => void) => {
        receiveToken = token;
        return { reset: vi.fn(), destroy: vi.fn() };
      },
    } });
    const { fixture, element } = await create();
    const input = element.querySelector('input')!;
    input.value = 'user@example.com';
    input.dispatchEvent(new Event('input'));
    const submit = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const form = element.querySelector('form')!;
    fixture.detectChanges();
    expect(submit.disabled).toBe(true);
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(register).not.toHaveBeenCalled();
    receiveToken('valid-token'); fixture.detectChanges();
    expect(submit.disabled).toBe(false);
    receiveToken(''); fixture.detectChanges();
    expect(submit.disabled).toBe(true);
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(register).not.toHaveBeenCalled();
  });

  it('shows a neutral duplicate response without exposing or storing the email', async () => {
    register.mockResolvedValue('already_registered');
    const { fixture, element } = await create();
    const input = element.querySelector('input')!;
    input.value = 'user@example.com';
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('ja s’ha utilitzat');
    expect([...values]).toEqual([[PROMOTION_SESSION_KEY, '1']]);
  });

  it.each(['invalid_email', 'unavailable'])('allows retry after server response %s', async result => {
    register.mockResolvedValue(result);
    const { fixture, element } = await create();
    const input = element.querySelector('input')!;
    input.value = 'user@example.com';
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('input')).not.toBeNull();
    expect(element.querySelector('#promotion-error')?.textContent?.trim()).not.toBe('');
    expect(values.size).toBe(0);
  });

  it('waits for server eligibility and prevents duplicate submissions while pending', async () => {
    let complete!: (result: string) => void;
    register.mockReturnValue(new Promise<string>(resolve => { complete = resolve; }));
    const { fixture, element } = await create();
    const input = element.querySelector('input')!;
    input.value = 'user@example.com';
    input.dispatchEvent(new Event('input'));
    const form = element.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges();
    expect(register).toHaveBeenCalledTimes(1);
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    expect(element.querySelector('.promotion-success')).toBeNull();
    complete('registered');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('.promotion-success')?.textContent).toContain('Registre confirmat');
  });

  it('can open and close when sessionStorage is unavailable', async () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    const { element } = await create();
    expect(element.querySelector('dialog')!.open).toBe(true);
    expect(() => element.querySelector<HTMLButtonElement>('.modal-close')!.click()).not.toThrow();
    expect(element.querySelector('dialog')!.open).toBe(false);
  });
});
