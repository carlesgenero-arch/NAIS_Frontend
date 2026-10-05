import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import { isCheckoutSessionId, isPublicOrderSummary, PublicOrderSummary } from '../../shared/order-summary';

@Injectable({ providedIn: 'root' })
export class OrderLookupService {
  private readonly http = inject(HttpClient);

  findByCheckoutSession(sessionId: string): Observable<PublicOrderSummary | null> {
    if (!isCheckoutSessionId(sessionId)) return throwError(() => new Error('Referència no vàlida.'));
    return this.http.get<unknown>(`/api/orders/checkout-session/${encodeURIComponent(sessionId)}`).pipe(
      map(value => {
        if (!isPublicOrderSummary(value)) throw new Error('Invalid order response');
        return value;
      }),
      catchError(error => error instanceof HttpErrorResponse && error.status === 404
        ? of(null) : throwError(() => new Error('No hem pogut consultar la comanda. Torna-ho a provar.'))),
    );
  }
}
