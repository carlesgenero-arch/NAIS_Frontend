import { TranslationService } from '../../i18n/translation.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, distinctUntilChanged, map, Observable, of, startWith, switchMap, take, tap, timer } from 'rxjs';
import { isCheckoutSessionId, PublicOrderSummary } from '../../../shared/order-summary';
import { OrderLookupService } from '../../services/order-lookup.service';
import { CartService } from '../../services/cart.service';
import { VerifiedOrderCartService } from '../../services/verified-order-cart.service';
import { PromotionModal } from '../../services/promotion-modal';

const PENDING_RETRY_DELAYS_MS = [1000, 2000, 4000, 6000] as const;

type OrderState = { status: 'missing' | 'invalid' | 'loading' | 'pending' | 'error' | 'not-paid' }
  | { status: 'verified'; order: PublicOrderSummary };

@Component({
  selector: 'app-checkout-success',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './checkout-success.html',
  styleUrl: './checkout-result.css',
})
export class CheckoutSuccess {
  protected formatAmount(cents: number, currency: string): string {
    return new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency }).format(cents / 100);
  }
  protected readonly i18n = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly lookup = inject(OrderLookupService);
  private readonly cart = inject(CartService);
  private readonly verifiedCart = inject(VerifiedOrderCartService);
  private readonly promotionModal = inject(PromotionModal);
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
      // A full-page Stripe return can verify before the catalogue restores the cart.
      // Capture its baseline after restoration, once, without delaying verification.
      const requestedCart$ = this.cart.restored$.pipe(
        take(1), map(() => this.cart.getPayload().items), startWith(null),
      );
      const verification$ = this.findOrder(sessionId).pipe(
        tap(order => { if (order?.paymentStatus === 'paid') this.promotionModal.suppressAfterPurchase(); }),
      );
      return combineLatest([requestedCart$, verification$]).pipe(
        tap(([requestedCart, order]) => {
          if (order?.paymentStatus === 'paid' && requestedCart !== null) {
            this.verifiedCart.clearOnce(order, requestedCart);
          }
        }),
        map(([, order]): OrderState => !order ? { status: 'pending' }
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
