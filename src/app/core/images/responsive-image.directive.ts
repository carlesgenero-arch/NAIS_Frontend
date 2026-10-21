import { computed, Directive, input } from '@angular/core';
import { IMAGE_ASSETS } from './image-manifest';

/** Static, allowlisted delivery variants only. API/R2/remote URLs remain authoritative. */
@Directive({
  selector: 'img[responsiveImage]',
  host: {
    '[attr.srcset]': 'srcset()',
    '[attr.sizes]': 'asset() ? responsiveSizes() : null',
    '[src]': 'src()',
  },
})
export class ResponsiveImage {
  readonly src = input.required<string>();
  readonly responsiveSizes = input('100vw');
  protected readonly asset = computed(() => {
    // Never rewrite uploaded URLs, arbitrary origins, query strings or versioned paths.
    const source = this.src();
    if (!/^(?:\/)?images\//.test(source) || /[?#]/.test(source)) return undefined;
    let key: string;
    try { key = decodeURIComponent(source.replace(/^\//, '')); } catch { return undefined; }
    return Object.hasOwn(IMAGE_ASSETS, key) ? IMAGE_ASSETS[key] : undefined;
  });
  protected readonly srcset = computed(() => this.asset()?.variants
    .map(variant => `${variant.src} ${variant.width}w`).join(', ') ?? null);
}
