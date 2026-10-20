# Admin product image upload (R2)

## Contract and safety

POST /api/admin/products/:id/image inherits admin Cloudflare Access JWT + issuer/
audience/JWKS validation and ADMIN_EMAILS. It independently requires admin context,
POST and exact same-origin Origin. Multipart/form-data must have exactly one File
field named `image`. No client URL, key, target field or extra form field is accepted.

Maximum file size: 5 MiB (5,242,880 bytes). The whole multipart request is bounded
at 5 MiB + 64 KiB (5,308,416 bytes), using actual streamed byte counts even if
Content-Length is missing/false. Parsing happens only after this envelope check.
JPEG (image/jpeg), PNG (image/png) and WebP (image/webp) require matching MIME and
binary format signatures/container markers; extension and raw filename are ignored.
SVG/HTML and MIME/signature mismatches are rejected. This does not transcode or
fully decode images. Upload only product photography/artwork intended to be public.

Keys: products/<existing-product-id>/<server-random-UUID>.jpg|png|webp. The extension
comes from detected format. Existing IDs, including generated product UUIDs, follow
the existing product-ID validator. No path traversal, filenames, tokens or credentials
are used in object keys. All errors are generic; no image/body/PII/provider logs.

The server reads the current image_url + updated_at, writes the object first, then
conditionally updates ONLY image_url and updated_at in D1. Concurrent changes return
409 without overwriting the winner. Pricing, status, Stripe fields and feature_image_url
are untouched. No schema migration is required. Returns 200 {imageUrl, updatedAt}.
400 malformed, 404 missing product, 409 concurrent change, 413 too large, 415 invalid
image, 503 unavailable. Auth/origin failures preserve existing 401/403 behavior.

No automatic deletion: legacy /public assets and old R2 objects are retained. A failed
D1 write can leave an orphan; a lost commit acknowledgement is ambiguous, so deleting
the candidate could break the current image. Reload before retrying. Future cleanup
must verify references across every relevant database/deployment and preserve current
objects; do not apply a blanket R2 expiry rule to this prefix.

## UI

Select a file and inspect its local object-URL preview. Existing products can upload
immediately, independently of saving other edits (no Stripe call); unsaved text stays.
Alternatively Save uploads the selection after the metadata save. New products are
created first; only then is their file uploaded using the persisted product ID. If
upload fails, the created product stays editable for retry, without duplicate creation.
The persisted image path is read-only in the form. Existing featured image paths
remain supported and unchanged. Preview URLs are revoked on replace/destroy; pending
upload subscriptions are cancelled when changing routes. Successful image uploads
commit immediately and are not undone by cancelling other form edits.

## Public delivery

Keep R2 buckets PRIVATE: no r2.dev, public custom domain, browser write keys, presigned
upload URL or browser CORS permission is required. New D1 paths are root-relative:
/images/uploads/products/<id>/<UUID>.<ext>. A narrow Pages Function at
functions/images/uploads/[[path]].ts serves only exact generated keys via PRODUCT_IMAGES.
GET/HEAD only; all writes and arbitrary bucket paths are rejected. Content-Type comes
from the verified extension; nosniff, inline disposition, ETag and one-year immutable
browser caching are returned. Unique keys avoid stale replacement caches. No bucket
listing or public upload is provided. Static /images outside /images/uploads are untouched.

If custom Functions routing is added later, include /api/admin/products/*/image and
/images/uploads/*; never force images through the Angular SPA or an Access login page.

## Exact manual Cloudflare setup (not executed)

1. R2 Object Storage -> Create bucket: `nais-product-images-production`. Keep public
   access disabled. Create `nais-product-images-preview` separately for testing.
2. Workers & Pages -> nais-frontend -> Settings -> Bindings -> select Production ->
   Add -> R2 bucket. Variable/binding name: PRODUCT_IMAGES. Choose the production bucket.
3. Select Preview and add PRODUCT_IMAGES pointing to the preview bucket. Use an
   ISOLATED Preview D1 catalogue at the same time. Do not test uploads with a shared
   Production D1 and a separate bucket: root-relative references would point to
   missing objects on Production. If D1 is intentionally shared, R2 must also be
   shared and uploads affect Production; use isolated resources for testing instead.
4. Preserve PROMO_DB and Access configuration. No new secret/API key or D1 migration.
5. Redeploy each environment after adding the binding, including the new read Function.
6. On an Access-protected preview: edit a draft, select each supported format, preview,
   upload, reload; verify returned URL works logged out. Replace the image and check
   the old object remains. Verify unsupported/oversized files and denied/cross-origin
   uploads; check create-with-file, failure/retry, 320/375/430px, tablet and desktop.
7. Verify the public catalogue/Shop uses the saved image URL and existing static paths
   still work; no checkout, Stripe, order, promo or cart changes are necessary.

Wrangler.toml only adds PRODUCT_IMAGES for existing LOCAL Pages development with
local R2 emulation (`bucket_name=nais-product-images-preview`). No remote bucket is
created or contacted by normal local emulation. Production still uses Dashboard
bindings; pages_build_output_dir and deployment architecture are unchanged. Local
admin authentication remains strict: no bypass is introduced for uploader testing.

Sources:
https://developers.cloudflare.com/pages/functions/bindings/#r2-buckets
https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
