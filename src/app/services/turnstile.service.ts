import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
export interface TurnstileHandle { reset(): void; destroy(): void }
@Injectable({ providedIn: 'root' })
export class TurnstileService {
  private readonly document = inject(DOCUMENT);
  private loading?: Promise<TurnstileApi>;

  private load(): Promise<TurnstileApi> {
    const window = this.document.defaultView as (Window & { turnstile?: TurnstileApi }) | null;
    if (window?.turnstile) return Promise.resolve(window.turnstile);
    if (!window) return Promise.reject(new Error('Verification unavailable'));
    if (!this.loading) {
      this.loading = new Promise<TurnstileApi>((resolve, reject) => {
        const script = this.document.createElement('script');
        const timer = window.setTimeout(() => fail(), 15000);
        const fail = () => {
          window.clearTimeout(timer);
          script.remove();
          reject(new Error('Verification unavailable'));
        };
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = () => {
          window.clearTimeout(timer);
          if (window.turnstile) resolve(window.turnstile); else fail();
        };
        script.onerror = fail;
        this.document.head.appendChild(script);
      }).catch(error => { this.loading = undefined; throw error; });
    }
    return this.loading;
  }

  async mount(container: HTMLElement, language: 'ca' | 'es', token: (value: string) => void,
    failed: () => void): Promise<TurnstileHandle> {
    const response = await fetch('/api/promo-config', { signal: AbortSignal.timeout(10000) });
    const config: unknown = await response.json();
    if (!response.ok || !config || typeof config !== 'object' || !('siteKey' in config)
      || typeof config.siteKey !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(config.siteKey)) {
      throw new Error('Verification unavailable');
    }
    const api = await this.load();
    const id = api.render(container, { sitekey: config.siteKey, action: 'promo_signup',
      size: 'compact', appearance: 'interaction-only', theme: 'light', language: language === 'es' ? 'es' : 'auto',
      'response-field': false, callback: token,
      'expired-callback': () => token(''), 'timeout-callback': () => { token(''); failed(); },
      'error-callback': () => { token(''); failed(); },
    });
    return { reset: () => { token(''); api.reset(id); }, destroy: () => api.remove(id) };
  }
}
