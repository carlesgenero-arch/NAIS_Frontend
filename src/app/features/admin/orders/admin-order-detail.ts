import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe, DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription, catchError, of, startWith, switchMap, tap } from 'rxjs';
import { AdminOrdersService, adminOrderError, fulfillmentError } from '../../../services/admin-orders.service';
import { FULFILLMENT_TRANSITIONS, type FulfillmentStatus } from '../../../../shared/order-fulfillment';
import type { AdminOrder } from '../../../models/admin-order.interface';
import { PAYMENT_LABELS, FULFILLMENT_LABELS, OrderEuroPipe } from './order-display';

@Component({ selector: 'app-admin-order-detail', imports: [DatePipe, RouterLink, OrderEuroPipe],
  templateUrl: './admin-order-detail.html', styleUrl: './admin-orders.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminOrderDetail {
  private readonly service = inject(AdminOrdersService);
  private readonly route = inject(ActivatedRoute);
  private readonly retry = new Subject<void>();
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private mutation?: Subscription;
  private readonly feedback = viewChild<ElementRef<HTMLElement>>('feedback');
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly saved = signal('');
  protected readonly nextStatuses = computed(() => {
    const order = this.order(); return order ? FULFILLMENT_TRANSITIONS[order.fulfillmentStatus] : [];
  });
  protected readonly order = signal<AdminOrder | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly error = signal('');
  protected readonly paymentLabels = PAYMENT_LABELS;
  protected readonly fulfillmentLabels = FULFILLMENT_LABELS;
  constructor() {
    afterRenderEffect(() => { if (this.saved() || this.saveError()) this.feedback()?.nativeElement.focus(); });
    this.route.paramMap.pipe(switchMap(params => this.retry.pipe(startWith(undefined),
      tap(() => { this.mutation?.unsubscribe(); this.saving.set(false); this.saveError.set(''); this.saved.set('');
        this.order.set(null); this.loading.set(true); this.notFound.set(false); this.error.set(''); }),
      switchMap(() => this.service.getOrder(params.get('id') ?? '').pipe(catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 404) this.notFound.set(true);
        else this.error.set(adminOrderError(error));
        return of(null);
      }))),
    )), takeUntilDestroyed(inject(DestroyRef))).subscribe(order => { this.order.set(order); this.loading.set(false); });
  }
  protected reload(): void { if (!this.loading() && !this.saving()) this.retry.next(); }
  protected changeFulfillment(next: FulfillmentStatus): void {
    const current = this.order();
    if (!current || this.saving() || this.loading() || !this.nextStatuses().includes(next)) return;
    if (next === 'cancelled' && !this.document.defaultView?.confirm('Cancel·lar la preparació d’aquesta comanda? És un estat final. Aquesta acció no reemborsa ni modifica el pagament.')) return;
    this.saving.set(true); this.saveError.set(''); this.saved.set('');
    this.mutation = this.service.updateFulfillment(current.id, next).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: order => { this.order.set(order); this.saving.set(false); this.saved.set('Estat de preparació actualitzat.'); },
      error: error => { this.saving.set(false); this.saveError.set(fulfillmentError(error)); },
    });
  }
}
