import { TestBed } from '@angular/core/testing';
import { Promotion, PROMOTION_SESSION_KEY } from './promotion';

describe('Promotion', () => {
  let values: Map<string, string>;
  let showDescriptor: PropertyDescriptor | undefined;
  let closeDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
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
    showDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); } });
    TestBed.configureTestingModule({ imports: [Promotion] });
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
    expect(dialog.getAttribute('aria-label')).toBe('OBTÉN UN 10% DESCOMPTE');
    expect(element.querySelector('h2')?.textContent).toContain('OBTÉN UN 10% DESCOMPTE');
    expect(element.querySelector('img')).toBeNull();
    expect(dialog.classList.contains('promotion')).toBe(true);
    expect(document.activeElement).toBe(element.querySelector('.modal-close'));
    fixture.detectChanges();
    expect(window.location.href).toBe(url);
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
    input.value = 'person@example.com';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('no s’ha enviat cap correu');
    expect(element.querySelector('input')).toBeNull();
    expect(document.activeElement).toBe(element.querySelector('.modal-close'));
    expect([...values]).toEqual([[PROMOTION_SESSION_KEY, '1']]);
  });

  it('can open and close when sessionStorage is unavailable', async () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    const { element } = await create();
    expect(element.querySelector('dialog')!.open).toBe(true);
    expect(() => element.querySelector<HTMLButtonElement>('.modal-close')!.click()).not.toThrow();
    expect(element.querySelector('dialog')!.open).toBe(false);
  });
});
