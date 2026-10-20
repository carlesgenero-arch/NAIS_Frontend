import { TestBed } from '@angular/core/testing';
import { OrderStatusBadge } from './order-status-badge';
import { ORDER_STATUS_LABEL_KEYS } from './order-display';
import { TranslationService } from '../../../i18n/translation.service';

describe('shared order status badge', () => {
  afterEach(() => vi.restoreAllMocks());
  it('keeps every existing status readable in Catalan and Spanish', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    const fixture = TestBed.createComponent(OrderStatusBadge);
    const i18n = TestBed.inject(TranslationService);
    for (const language of ['ca', 'es'] as const) {
      i18n.setLanguage(language);
      for (const status of Object.keys(ORDER_STATUS_LABEL_KEYS) as (keyof typeof ORDER_STATUS_LABEL_KEYS)[]) {
        fixture.componentRef.setInput('status', status);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent.trim()).toBe(i18n.t(ORDER_STATUS_LABEL_KEYS[status]));
        expect(fixture.nativeElement.getAttribute('data-status')).toBe(status);
        expect(fixture.nativeElement.getAttribute('lang')).toBe(language);
      }
    }
    expect(fixture.nativeElement.textContent.trim()).toBe('Cancelado');
  });
});
