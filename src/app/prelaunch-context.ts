import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';

// Cloudflare hash deployments and branch aliases have one label before the project host.
// Keep the production pages.dev host and custom production domains in prelaunch mode.
export function isPagesPreviewHostname(hostname: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.nais-frontend\.pages\.dev$/.test(hostname.toLowerCase());
}

export const IS_PAGES_PREVIEW = new InjectionToken<boolean>('IS_PAGES_PREVIEW', {
  providedIn: 'root',
  factory: () => isPagesPreviewHostname(inject(DOCUMENT).location?.hostname ?? ''),
});
