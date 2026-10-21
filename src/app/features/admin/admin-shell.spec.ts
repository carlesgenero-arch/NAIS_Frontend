import { TestBed } from '@angular/core/testing';
import { NavigationStart, NavigationEnd, NavigationError, NavigationCancel, Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { AdminShell } from './admin-shell';
import { ADMIN_NAVIGATION_TIMEOUT_MS } from '../../services/admin-request';

describe('admin navigation feedback only', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
  function setup() {
    TestBed.configureTestingModule({providers:[provideRouter([])]});
    const events = new Subject<NavigationStart | NavigationEnd | NavigationError | NavigationCancel>();
    vi.spyOn(TestBed.inject(Router), 'events', 'get').mockReturnValue(events);
    const fixture = TestBed.createComponent(AdminShell);fixture.detectChanges();
    return {events,fixture};
  }
  it('announces route loading and resets on completion/cancellation without changing navigation', () => {
    const {events,fixture}=setup();
    events.next(new NavigationStart(1,'/admin/orders'));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Obrint');
    events.next(new NavigationEnd(1,'/admin/orders','/admin/orders'));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    events.next(new NavigationStart(2,'/admin/products'));events.next(new NavigationCancel(2,'/admin/products','cancelled'));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });
  it('shows a generic recoverable error after navigation failure or long waiting', () => {
    vi.useFakeTimers();const {events,fixture}=setup();
    events.next(new NavigationError(1,'/admin/orders',new Error('private technical detail')));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('private technical detail');
    events.next(new NavigationStart(2,'/admin/products'));vi.advanceTimersByTime(ADMIN_NAVIGATION_TIMEOUT_MS);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    events.next(new NavigationEnd(2,'/admin/products','/admin/products'));fixture.detectChanges();expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});
