import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import type { CartEntry } from '../models/cart.interface';

export interface CheckoutRequest {
  readonly items: readonly CartEntry[];
}

export interface CheckoutResponse {
  readonly url: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly http = inject(HttpClient);

  createCheckout(items: readonly CartEntry[]): Observable<CheckoutResponse> {
    // Explicit projection prevents enriched cart objects from sending prices or totals.
    const body: CheckoutRequest = {
      items: items.map(({ productId, quantity }) => ({ productId, quantity })),
    };
    return this.http.post<unknown>('/api/checkout', body).pipe(
      map((response): CheckoutResponse => {
        if (!response || typeof response !== 'object' || !('url' in response)
          || typeof response.url !== 'string' || !response.url.trim()) {
          throw new Error('Invalid checkout response');
        }
        const url = new URL(response.url);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com'
          || url.port || url.username || url.password) {
          throw new Error('Invalid checkout URL');
        }
        return { url: response.url };
      }),
      // Never forward backend error bodies, Stripe details or raw HTTP errors to the UI.
      catchError(() => throwError(() => new Error(
        "No s'ha pogut iniciar el pagament. Torna-ho a provar.",
      ))),
    );
  }
}
