import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminOrdersService, adminOrderError } from '../../../services/admin-orders.service';
import type { AdminOrder } from '../../../models/admin-order.interface';
import { OrderEuroPipe } from './order-display';
import { OrderStatusBadge } from './order-status-badge';
import { Subscription } from 'rxjs';
import { TranslatePipe } from '../../../i18n/translate.pipe';

@Component({ selector: 'app-admin-orders', imports: [DatePipe, RouterLink, OrderEuroPipe, OrderStatusBadge, TranslatePipe],
  templateUrl: './admin-orders.html', styleUrl: './admin-orders.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminOrders {
  private readonly service = inject(AdminOrdersService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly view = signal<'active' | 'archived'>('active');
  protected readonly orders = signal<readonly AdminOrder[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);
  protected readonly error = signal('');
  constructor() { this.load(); }
  protected selectView(view: 'active' | 'archived'): void {
    if (view === this.view()) return;
    this.request?.unsubscribe(); this.view.set(view); this.orders.set([]);
    this.cursor.set(null); this.loaded.set(false); this.loading.set(false); this.load();
  }
  protected load(): void {
    if (this.loading() || (this.loaded() && !this.cursor())) return;
    this.loading.set(true); this.error.set('');
    this.request = this.service.list(this.cursor(), 25, this.view()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => {
        this.orders.update(previous => {
          const ids = new Set(previous.map(order => order.id));
          return [...previous, ...page.items.filter(order => !ids.has(order.id))];
        });
        this.cursor.set(page.nextCursor); this.loaded.set(true); this.loading.set(false);
      },
      error: error => { this.error.set(adminOrderError(error)); this.loading.set(false); },
    });
  }
}
