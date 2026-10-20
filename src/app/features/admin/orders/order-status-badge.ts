import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslationService } from '../../../i18n/translation.service';
import { ORDER_STATUS_LABEL_KEYS, type OrderStatus } from './order-display';

/** Shared presentation only: statuses and transitions remain server-owned. */
@Component({
  selector: 'app-order-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ i18n.t(labels[status()]) }}`,
  styleUrl: './order-status-badge.css',
  host: { '[attr.data-status]': 'status()', '[attr.lang]': 'i18n.language()' },
})
export class OrderStatusBadge {
  readonly status = input.required<OrderStatus>();
  protected readonly i18n = inject(TranslationService);
  protected readonly labels = ORDER_STATUS_LABEL_KEYS;
}
