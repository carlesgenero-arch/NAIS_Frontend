import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HomeReveal } from './home-reveal.directive';

@Component({ imports: [HomeReveal], template: '<section homeReveal><button>Focus</button></section><section homeReveal></section>' })
class Host {}

describe('Home reveal', () => {
  const records: { callback: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  beforeEach(() => {
    records.length = 0;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.stubGlobal('IntersectionObserver', class {
      private record;
      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
        expect(options.threshold).toBe(0.3);
        this.record = { callback, observe: vi.fn(), disconnect: vi.fn() };
        records.push(this.record);
      }
      observe(element: Element) { this.record.observe(element); }
      disconnect() { this.record.disconnect(); }
    });
    TestBed.configureTestingModule({ imports: [Host] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable(); fixture.detectChanges();
    return fixture;
  }
  it('waits for 30%, reveals each target independently and never hides it again', async () => {
    const fixture = await setup();
    const sections = fixture.nativeElement.querySelectorAll('section');
    const emit = (ratio: number) => records[0].callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver);
    emit(0.1); fixture.detectChanges();
    expect(sections[0].classList.contains('home-motion-revealed')).toBe(false);
    emit(0.3); fixture.detectChanges();
    expect(sections[0].classList.contains('home-motion-revealed')).toBe(true);
    expect(sections[1].classList.contains('home-motion-revealed')).toBe(false);
    emit(0); fixture.detectChanges();
    expect(sections[0].classList.contains('home-motion-revealed')).toBe(true);
    expect(records[0].disconnect).toHaveBeenCalledTimes(1);
  });
  it('reveals immediately for focus and disconnects on destruction', async () => {
    const fixture = await setup();
    fixture.nativeElement.querySelector('section').dispatchEvent(new Event('focusin'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.home-motion-revealed')).not.toBeNull();
    fixture.destroy();
    expect(records[1].disconnect).toHaveBeenCalledTimes(1);
  });
  it('keeps reduced-motion content visible without observing it', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const fixture = await setup();
    expect(records).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.home-motion-ready')).toBeNull();
  });
  it('keeps content visible when observation is unsupported', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const fixture = await setup();
    expect(fixture.nativeElement.querySelector('.home-motion-ready')).toBeNull();
  });
});
