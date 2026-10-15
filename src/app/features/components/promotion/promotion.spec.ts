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
    TestBed.configureTestingModule({ imports: [Promotion], providers: [{ provide: PromoSignupService, useValue: { register } }, { provide: TurnstileService, useValue: { mount: async (_container: HTMLElement, _language: string, token: (value: string) => void) => { return { execute: () => token('test-token'), reset: vi.fn(), destroy: vi.fn() }; } } }] });
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
    expect(element.querySelector('app-promo-turnstile')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
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
    await fixture.whenStable();
    fixture.detectChanges();
    expect(register).toHaveBeenCalledExactlyOnceWith('person@example.com', 'test-token');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Revisa el teu correu');
    expect(element.querySelector('input')).toBeNull();
    expect(document.activeElement).toBe(element.querySelector('.modal-close'));
    expect([...values]).toEqual([[PROMOTION_SESSION_KEY, '1']]);
  });

  it('waits for a visible challenge, then submits automatically exactly once', async () => {
    let receiveToken!: (value: string) => void;
    const execute = vi.fn(); const destroy = vi.fn();
    const mount = vi.fn(async (container: HTMLElement, _language: string, token: (value: string) => void) => {
      receiveToken = token;
      // Simulate the provider's visible compact frame, without contacting/solving Turnstile.
      const frame = document.createElement('iframe');
      frame.title = 'Security verification'; frame.width = '150'; frame.height = '140';
      container.appendChild(frame);
      return { execute, reset: vi.fn(), destroy };
    });
    TestBed.overrideProvider(TurnstileService, { useValue: { mount } });
    const { fixture, element } = await create();
    expect(mount).not.toHaveBeenCalled();
    const form = element.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges(); await fixture.whenStable();
    expect(mount).not.toHaveBeenCalled();
    const input = element.querySelector('input')!;
    input.value = 'user@example.com'; input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges(); await fixture.whenStable();
    expect(execute).toHaveBeenCalledOnce();
    expect(element.querySelector('iframe')?.getAttribute('title')).toBe('Security verification');
    expect(register).not.toHaveBeenCalled();
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(mount).toHaveBeenCalledOnce();
    receiveToken(''); expect(register).not.toHaveBeenCalled();
    receiveToken('valid-token'); receiveToken('valid-token');
    await fixture.whenStable(); fixture.detectChanges();
    expect(register).toHaveBeenCalledExactlyOnceWith('user@example.com', 'valid-token');
    expect(destroy).toHaveBeenCalledOnce();
    expect(element.querySelector('iframe')).toBeNull();
  });

  it('allows a fresh submission after verification fails and cleans up on close', async () => {
    let fail!: () => void;
    const destroy = vi.fn();
    const mount = vi.fn(async (_container: HTMLElement, _language: string, _token: (value: string) => void, failed: () => void) => {
      fail = failed;
      return { execute: vi.fn(), reset: vi.fn(), destroy };
    });
    TestBed.overrideProvider(TurnstileService, { useValue: { mount } });
    const { fixture, element } = await create();
    const input = element.querySelector('input')!;
    input.value = 'user@example.com'; input.dispatchEvent(new Event('input'));
    const submit = () => element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    submit(); fixture.detectChanges(); await fixture.whenStable();
    fail(); fixture.detectChanges();
    expect(register).not.toHaveBeenCalled();
    expect(element.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
    expect(element.querySelector('#promotion-error')!.textContent!.trim()).not.toBe('');
    submit(); fixture.detectChanges(); await fixture.whenStable();
    expect(mount).toHaveBeenCalledTimes(2);
    element.querySelector<HTMLButtonElement>('.modal-close')!.click(); fixture.detectChanges();
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('retries with a new widget/token and ignores callbacks from the failed attempt even before a render', async () => {
    const callbacks: { token: (value: string) => void; failed: () => void }[] = [];
    const destroy = vi.fn();
    TestBed.overrideProvider(TurnstileService, { useValue: {
      mount: vi.fn(async (_container: HTMLElement, _language: string, token: (value: string) => void, failed: () => void) => {
        callbacks.push({ token, failed });
        return { execute: vi.fn(), reset: vi.fn(), destroy };
      }),
    } });
    const { fixture, element } = await create();
    const input = element.querySelector('input')!;
    input.value = 'user@example.com'; input.dispatchEvent(new Event('input'));
    const submit = () => element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    submit(); fixture.detectChanges(); await fixture.whenStable();
    callbacks[0].failed();
    // Retry in the same change detection turn: a boolean @if used to retain the failed widget.
    submit(); callbacks[0].token('stale-token'); callbacks[0].failed();
    fixture.detectChanges(); await fixture.whenStable();
    expect(callbacks).toHaveLength(2); expect(register).not.toHaveBeenCalled();
    callbacks[1].token('fresh-token'); callbacks[1].token('duplicate-token');
    await fixture.whenStable(); fixture.detectChanges();
    expect(register).toHaveBeenCalledExactlyOnceWith('user@example.com', 'fresh-token');
    expect(element.querySelector('.promotion-success')).not.toBeNull();
    expect(element.querySelector('app-promo-turnstile')).toBeNull();
  });

  it('removes a completed challenge while awaiting the provider, then retries API failure with a fresh token', async () => {
    const callbacks: ((token: string) => void)[] = [];
    TestBed.overrideProvider(TurnstileService, { useValue: {
      mount: async (_container: HTMLElement, _language: string, token: (value: string) => void) => {
        callbacks.push(token); return { execute: vi.fn(), reset: vi.fn(), destroy: vi.fn() };
      },
    } });
    let complete!: (result: string) => void;
    register.mockReturnValueOnce(new Promise<string>(resolve => { complete = resolve; }));
    const { fixture, element } = await create();
    const input = element.querySelector('input')!;
    input.value = 'user@example.com'; input.dispatchEvent(new Event('input'));
    const submit = () => element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    submit(); fixture.detectChanges(); await fixture.whenStable();
    callbacks[0]('first-token'); fixture.detectChanges();
    expect(element.querySelector('app-promo-turnstile')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
    complete('unavailable'); await fixture.whenStable(); fixture.detectChanges();
    submit(); fixture.detectChanges(); await fixture.whenStable();
    callbacks[1]('second-token'); await fixture.whenStable(); fixture.detectChanges();
    expect(register.mock.calls).toEqual([['user@example.com', 'first-token'], ['user@example.com', 'second-token']]);
    expect(element.querySelector('.promotion-success')).not.toBeNull();
  });

  it('ignores a late token after closing while widget mounting is still pending', async () => {
    let resolveMount!: (handle: { execute: () => void; reset: () => void; destroy: () => void }) => void;
    let token!: (value: string) => void;
    const execute = vi.fn(); const destroy = vi.fn();
    TestBed.overrideProvider(TurnstileService, { useValue: {
      mount: (_container: HTMLElement, _language: string, receive: (value: string) => void) => {
        token = receive;
        return new Promise(resolve => { resolveMount = resolve; });
      },
    } });
    const { fixture, element } = await create();
    const input = element.querySelector('input')!;
    input.value = 'user@example.com'; input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.modal-close')!.click(); fixture.detectChanges();
    resolveMount({ execute, reset: vi.fn(), destroy }); token('late-token');
    await fixture.whenStable();
    expect(execute).not.toHaveBeenCalled(); expect(destroy).toHaveBeenCalledOnce();
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
    await fixture.whenStable();
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
