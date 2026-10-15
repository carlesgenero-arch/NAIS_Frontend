import { Injectable } from '@angular/core';

export type PromoSignupResult = 'registered' | 'already_registered' | 'invalid_email' | 'unavailable';

// Siteverify + two Stripe operations (including bounded retries) + email delivery run serially.
const PROMO_REQUEST_TIMEOUT_MS = 120_000;

@Injectable({ providedIn: 'root' })
export class PromoSignupService {
  async register(email: string, turnstileToken: string): Promise<PromoSignupResult> {
    try {
      const response = await fetch('/api/promo-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken }),
        signal: AbortSignal.timeout(PROMO_REQUEST_TIMEOUT_MS),
      });
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || !('status' in payload)) return 'unavailable';
      if (response.status === 201 && payload.status === 'registered') return 'registered';
      if (response.status === 200 && payload.status === 'already_registered') return 'already_registered';
      if (response.status === 400 && payload.status === 'invalid_email') return 'invalid_email';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  }
}
