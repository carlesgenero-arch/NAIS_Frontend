import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockProductService } from '../../../testing/product-fixture';
import { AssortedPackPromotion } from './assorted-pack-promotion';

describe('Assorted pack sticker reveal', () => {
  let notify: IntersectionObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    observe.mockClear();
    disconnect.mockClear();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    TestBed.configureTestingModule({ imports: [AssortedPackPromotion], providers: [provideRouter([])] });
  });

  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

  async function setup() {
    const fixture = TestBed.createComponent(AssortedPackPromotion);
    fixture.componentRef.setInput('product', new MockProductService().products.find(p => p.id === 'pack-variat')!);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('observes the sticker group, waits for visibility and reveals once', async () => {
    const fixture = await setup();
    const row = fixture.nativeElement.querySelector('.pack-botanicals') as HTMLElement;
    expect(observe).toHaveBeenCalledWith(row);
    expect(row.classList.contains('stickers-reveal')).toBe(true);
    const emit = (ratio: number) => notify([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver);
    emit(0.1);
    fixture.detectChanges();
    expect(row.classList.contains('stickers-revealed')).toBe(false);
    emit(0.2);
    fixture.detectChanges();
    expect(row.classList.contains('stickers-revealed')).toBe(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    emit(0);
    fixture.detectChanges();
    expect(row.classList.contains('stickers-revealed')).toBe(true);
  });

  it('disconnects on destruction before reveal', async () => {
    const fixture = await setup();
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('leaves stickers visible without an observer for reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const fixture = await setup();
    expect(observe).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.stickers-reveal')).toBeNull();
  });

  it('leaves stickers visible when observation is unsupported', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const fixture = await setup();
    expect(fixture.nativeElement.querySelector('.stickers-reveal')).toBeNull();
  });
});
