import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, startWith, switchMap, tap } from 'rxjs';
import { AdminOrdersService, adminOrderError } from '../../../services/admin-orders.service';
import type { AdminOrder } from '../../../models/admin-order.interface';
import { PAYMENT_LABELS, FULFILLMENT_LABELS, OrderEuroPipe } from './order-display';

@Component({ selector: 'app-admin-order-detail', imports: [DatePipe, RouterLink, OrderEuroPipe],
  templateUrl: './admin-order-detail.html', styleUrl: './admin-orders.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminOrderDetail {
  private readonly service = inject(AdminOrdersService);
  private readonly route = inject(ActivatedRoute);
  private readonly retry = new Subject<void>();
  protected readonly order = signal<AdminOrder | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly error = signal('');
  protected readonly paymentLabels = PAYMENT_LABELS;
  protected readonly fulfillmentLabels = FULFILLMENT_LABELS;
  constructor() {
    this.route.paramMap.pipe(switchMap(params => this.retry.pipe(startWith(undefined),
      tap(() => { this.order.set(null); this.loading.set(true); this.notFound.set(false); this.error.set(''); }),
      switchMap(() => this.service.getOrder(params.get('id') ?? '').pipe(catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 404) this.notFound.set(true);
        else this.error.set(adminOrderError(error));
        return of(null);
      }))),
    )), takeUntilDestroyed(inject(DestroyRef))).subscribe(order => { this.order.set(order); this.loading.set(false); });
  }
  protected reload(): void { if (!this.loading()) this.retry.next(); }
}
