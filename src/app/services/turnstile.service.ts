import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(id: string): void;
  reset(id: string): void;
  remove(id: string): void;
}
export interface TurnstileHandle { execute(): void; reset(): void; destroy(): void }
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
    // One widget execution owns one result. Late callbacks cannot revive a failed/removed attempt.
    let state: 'ready' | 'running' | 'settled' | 'destroyed' = 'ready';
    const fail = () => {
      if (state === 'settled' || state === 'destroyed') return;
      state = 'settled';
      failed();
    };
    const id = api.render(container, { sitekey: config.siteKey, action: 'promo_signup',
      execution: 'execute', size: 'compact', appearance: 'interaction-only', theme: 'light', language: language === 'es' ? 'es' : 'auto',
      // The form owns retries. Do not let Cloudflare refresh a consumed or failed execution.
      retry: 'never', 'refresh-expired': 'never', 'refresh-timeout': 'never',
      'response-field': false,
      callback: (value: string) => {
        if (state !== 'running') return;
        if (typeof value !== 'string' || !value.trim()) { fail(); return; }
        state = 'settled';
        token(value);
      },
      'expired-callback': fail, 'timeout-callback': fail,
      'error-callback': () => { fail(); return true; },
    });
    return {
      execute: () => {
        if (state !== 'ready') return;
        state = 'running';
        try { api.execute(id); } catch { fail(); }
      },
      reset: () => {
        if (state === 'destroyed') return;
        state = 'ready';
        token('');
        api.reset(id);
      },
      destroy: () => {
        if (state === 'destroyed') return;
        state = 'destroyed';
        api.remove(id);
      },
    };
  }
}
