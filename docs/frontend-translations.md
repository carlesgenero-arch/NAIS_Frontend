# Frontend languages (CAT / CAST)

The public storefront uses a root TranslationService (signals), TranslatePipe and
one reusable LanguageSelector. No new dependencies or per-language components.
Catalan is the default; Spanish is `es`. The selector never navigates or reloads.
Only `ca` or `es` is stored under `nais.language.v1`; blocked storage falls back
to in-memory selection. Server rendering does not access browser storage.
The document language follows selection. The existing admin area remains Catalan.

## Add copy, including future Home sections

1. Add a stable semantic key to `src/app/i18n/ca.ts`, e.g.
   `'home.story.heading': 'La nostra història'`.
2. Add the same key in `es.ts`: `'home.story.heading': 'Nuestra historia'`.
   TypeScript requires every Catalan key in Spanish. Keep `{parameter}` names equal.
3. Import TranslatePipe in the standalone component's `imports`.
4. Render `{{ 'home.story.heading' | t }}` or bind
   `[attr.aria-label]="'home.story.heading' | t"`.
5. For parameters: `{{ 'cart.add' | t: { product: product().name } }}`.
   In TypeScript inject TranslationService and use `i18n.t(key, params)` inside a
   computed value so an open view updates when language changes.

Do not store already-translated text in state. Existing API/error/source copy is
rendered through `i18n.text` / the pipe's compatibility adapter. All static
storefront copy now lives in resources; legacy presentation defaults reference
CA values to preserve public component/data contracts. Existing `ui.*` keys are
stable migration keys; use feature namespaces for new work. HTML remains in the
component, never in translation strings. Angular escapes interpolated values.

## Catalogue boundary

D1 remains the product/price/availability source. IDs, slugs, API paths, internal
statuses and persisted cart entries are unchanged. Known source descriptions
and presentation text have exact-copy translations, not product-ID overrides.
Unknown or newly edited API descriptions/names remain verbatim until a resource
translation is added. This deliberately avoids displaying stale descriptions.
For arbitrary multilingual admin-authored content, a later backend localized
content contract is needed; this task does not alter schema/API or duplicate a
purchasable catalogue. Historical order item names remain the purchased snapshot.

## Coverage

Header, selector, prelaunch, existing Home copy, product presentation/nutrition,
shop, cart, checkout messages, success/cancel, promo popup and footer. Existing
Home layout/animation/data selection are unchanged. Backend emails/admin copy
are outside this public frontend migration. No translation SDK or network API.

## Validation

- Angular TypeScript and template compilation: `ngc -p tsconfig.app.json --noEmit`
- Spec TypeScript: `tsc -p tsconfig.spec.json --noEmit`
- Focused tests: `npm test -- --watch=false --include=src/app/i18n/translation.spec.ts`
- Production build: `npm run build`

The current local Angular builder has an existing Windows parent-directory
access failure. An additional temporary AOT/Vitest harness under ignored tmp/
can run the compiled tests without changing production or package scripts.
Browser validation uses compiled real components with the test-only catalogue;
never sends checkout/promo requests to production.

Validation result: 93 focused tests passed across 8 files using the temporary AOT/Vitest harness. Angular template and spec TypeScript checks passed. Local real-component preview confirmed language switching without route changes, Spanish preference after reload, 44px language buttons, and no horizontal overflow in shop, prelaunch and promo popup at 320/375/390px. Newsletter's old fixed minimum input width was replaced with a stacked mobile layout. The normal production build remains blocked by the pre-existing Windows parent-directory access error.

