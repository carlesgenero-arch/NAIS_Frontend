# Public image delivery

Run `python scripts/optimize-public-images.py` with Pillow installed to regenerate
`public/images/optimized`, the static TypeScript manifest and `image-audit.csv`.
Original assets are never overwritten. No dependency is needed at runtime or in the
Cloudflare build. Commit the generated assets alongside the manifest.

`ResponsiveImage` supplies WebP width-descriptor `srcset` candidates and explicit
component-specific `sizes`. The original `src` remains the compatibility fallback;
modern browsers select an optimized `currentSrc` before fetching. No diagnostics
are disabled. R2 uploads, remote URLs, unknown paths and versioned URLs pass through
unchanged. Product records, API data and source paths are unchanged.

All resizing preserves aspect ratio (no crop/upscale), existing image CSS, alpha,
embedded ICC profiles and the browser's EXIF orientation. The small symbol uses
lossless WebP; product cutouts use quality 95 and lossless alpha; photography uses
quality 88. When a largest WebP costs more than the original JPEG, the smaller original is retained only as the largest high-DPI candidate. Existing SVG logos stay SVG. The 305x340 ginger artwork is never enlarged.

Home hero keeps eager/high-priority loading (potential LCP). Prelaunch composition
also stays eager. Below-fold Home fruit and brand photography are lazy; existing
card/collage lazy loading is retained. Detail and open-cart imagery stay eager.
Existing explicit dimensions, aspect ratios and reserved visual heights are retained;
the directive deliberately does not override them or set new layout dimensions.

The CSV lists every optimized raster source, original dimensions/bytes, CSS sizing
ranges, loading policy, representative variant and all generated widths. Savings
are estimates for one representative candidate per asset, not a network waterfall
or the sum of every variant. Browsers select different candidates by viewport/DPR.
Unused legacy originals are retained. `celebrating.jpeg` is absent from the current
repository and templates; a warning naming it may come from an older loaded build.

Manual QA after running the app: at 320/375/430, 768/1024/1440px and DPR 1/2, inspect
`img.currentSrc`, Network transfer sizes, crops/alpha/circles and NG0913 console output.
Check Home, Shop, detail, cart and prelaunch. No service-worker configuration exists
in this project. Verify these browser checks in the running application.

## Files in this change

- `src/app/core/shared/base/header/header.ts`
- `src/app/core/shared/base/header/header.html`
- `src/app/core/shared/page/brand-message-card/brand-message-card.ts`
- `src/app/core/shared/page/brand-message-card/brand-message-card.html`
- `src/app/core/shared/page/hero/hero.ts`
- `src/app/core/shared/page/hero/hero.html`
- `src/app/core/shared/page/info-card/info-card.ts`
- `src/app/core/shared/page/info-card/info-card.html`
- `src/app/core/shared/page/media-carousel/media-carousel.ts`
- `src/app/core/shared/page/media-carousel/media-carousel.html`
- `src/app/core/shared/page/product-card/product-card.ts`
- `src/app/core/shared/page/product-card/product-card.html`
- `src/app/core/shared/page/product-feature-card/product-feature-card.ts`
- `src/app/core/shared/page/product-feature-card/product-feature-card.html`
- `src/app/features/components/cart/cart.ts`
- `src/app/features/components/cart/cart.html`
- `src/app/features/home/assorted-pack-promotion/assorted-pack-promotion.ts`
- `src/app/features/home/assorted-pack-promotion/assorted-pack-promotion.html`
- `src/app/features/home/social-collage/social-collage.ts`
- `src/app/features/home/social-collage/social-collage.html`
- `src/app/features/prelaunch/prelaunch-landing/prelaunch-landing.ts`
- `src/app/features/prelaunch/prelaunch-landing/prelaunch-landing.html`
- `src/app/features/shop/product-selected-detail/product-selected-detail.ts`
- `src/app/features/shop/product-selected-detail/product-selected-detail.html`
- `src/app/features/shop/product-shop-card/product-shop-card.ts`
- `src/app/features/shop/product-shop-card/product-shop-card.html`
- `src/app/core/shared/modal/modal.css`
- `src/app/core/images/responsive-image.directive.ts`
- `src/app/core/images/responsive-image.directive.spec.ts`
- `src/app/core/images/image-manifest.ts`
- `scripts/optimize-public-images.py`
- `docs/image-audit.csv`
- `docs/image-delivery.md`
- `public/images/optimized/ (115 WebP files)`
