import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, Observable, of, startWith, switchMap, tap, timer } from 'rxjs';
import { isCheckoutSessionId, PublicOrderSummary } from '../../../shared/order-summary';
import { OrderLookupService } from '../../services/order-lookup.service';
import { CartService } from '../../services/cart.service';
import { VerifiedOrderCartService } from '../../services/verified-order-cart.service';

const PENDING_RETRY_DELAYS_MS = [1000, 2000, 4000, 6000] as const;

type OrderState = { status: 'missing' | 'invalid' | 'loading' | 'pending' | 'error' | 'not-paid' }
  | { status: 'verified'; order: PublicOrderSummary };

@Component({
  selector: 'app-checkout-success',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './checkout-success.html',
  styleUrl: './checkout-result.css',
})
export class CheckoutSuccess {
  private readonly route = inject(ActivatedRoute);
  private readonly lookup = inject(OrderLookupService);
  private readonly cart = inject(CartService);
  private readonly verifiedCart = inject(VerifiedOrderCartService);
  /** Untrusted reference only. Its presence never confirms payment. */
  readonly sessionId = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('session_id'))),
    { initialValue: this.route.snapshot.queryParamMap.get('session_id') },
  );
  readonly state = toSignal(this.route.queryParamMap.pipe(
    map(params => params.get('session_id')),
    distinctUntilChanged(),
    switchMap(sessionId => {
      if (!sessionId) return of<OrderState>({ status: 'missing' });
      if (!isCheckoutSessionId(sessionId)) return of<OrderState>({ status: 'invalid' });
      const requestedCart = this.cart.getPayload().items;
      return this.findOrder(sessionId).pipe(
        tap(order => { if (order?.paymentStatus === 'paid') this.verifiedCart.clearOnce(order, requestedCart); }),
        map((order): OrderState => !order ? { status: 'pending' }
          : order.paymentStatus === 'paid' ? { status: 'verified', order } : { status: 'not-paid' }),
        catchError(() => of<OrderState>({ status: 'error' })),
        startWith<OrderState>({ status: 'loading' }),
      );
    }),
  ), { initialValue: { status: 'missing' } as OrderState });

  /** Only a pending response schedules another attempt; toSignal cancels on destroy. */
  private findOrder(sessionId: string, attempt = 0): Observable<PublicOrderSummary | null> {
    return this.lookup.findByCheckoutSession(sessionId).pipe(
      switchMap(order => {
        const delay = PENDING_RETRY_DELAYS_MS[attempt];
        if (order !== null || delay === undefined) return of(order);
        return timer(delay).pipe(switchMap(() => this.findOrder(sessionId, attempt + 1)));
      }),
    );
  }

}
