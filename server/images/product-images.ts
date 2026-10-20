/** R2 is available only through a server binding; no browser credentials. */
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = MAX_PRODUCT_IMAGE_BYTES + 64 * 1024;
export interface ProductImageBucket {
  put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; httpEtag: string } | null>;
}
export interface ProductImagesEnvironment { PRODUCT_IMAGES?: ProductImageBucket; }
export class ImageUploadError extends Error {
  readonly status: 400 | 404 | 409 | 413 | 415;
  readonly code: string;
  constructor(status: ImageUploadError['status'], code: string) { super(code); this.status = status; this.code = code; }
}
const invalid = () => new ImageUploadError(400, 'invalid_upload');

/** Bound the complete multipart envelope before asking the runtime to parse it. */
export async function imageFile(request: Request): Promise<{ bytes: ArrayBuffer; mime: string; extension: string }> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body) throw invalid();
  const length = request.headers.get('Content-Length');
  if (length && /^\d+$/.test(length) && Number(length) > MAX_UPLOAD_BYTES) throw new ImageUploadError(413, 'upload_too_large');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_UPLOAD_BYTES) throw new ImageUploadError(413, 'upload_too_large');
      chunks.push(chunk.value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* No contents in errors/logs. */ }
    throw error instanceof ImageUploadError ? error : invalid();
  } finally { reader.releaseLock(); }
  const envelope = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { envelope.set(chunk, offset); offset += chunk.byteLength; }
  let form: FormData;
  try { form = await new Response(envelope, { headers: { 'Content-Type': contentType } }).formData(); }
  catch { throw invalid(); }
  const entries: [string, FormDataEntryValue][] = [];
  form.forEach((value, key) => entries.push([key, value]));
  if (entries.length !== 1 || entries[0]![0] !== 'image' || typeof entries[0]![1] === 'string') throw invalid();
  const file = entries[0]![1] as File;
  if (!file.size) throw invalid();
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) throw new ImageUploadError(413, 'upload_too_large');
  const bytes = await file.arrayBuffer(); const data = new Uint8Array(bytes);
  const ascii = (start: number, end: number) => String.fromCharCode(...data.subarray(start, end));
  let mime = '', extension = '';
  if (data.length >= 12 && data[0] === 255 && data[1] === 216 && data[2] === 255
    && data[data.length - 2] === 255 && data[data.length - 1] === 217) { mime = 'image/jpeg'; extension = 'jpg'; }
  else if (data.length >= 45 && [137,80,78,71,13,10,26,10].every((value, index) => data[index] === value)
    && new DataView(bytes).getUint32(8) === 13 && ascii(12,16) === 'IHDR'
    && new DataView(bytes).getUint32(16) > 0 && new DataView(bytes).getUint32(20) > 0
    && ascii(data.length - 8, data.length - 4) === 'IEND') { mime = 'image/png'; extension = 'png'; }
  else if (data.length >= 20 && ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(12,16))
    && new DataView(bytes).getUint32(4, true) === data.length - 8) { mime = 'image/webp'; extension = 'webp'; }
  if (!mime || file.type.toLowerCase() !== mime) throw new ImageUploadError(415, 'unsupported_image');
  return { bytes, mime, extension };
}

/** Only our generated keys can be served. Never resolve arbitrary bucket paths. */
export function isProductImageKey(key: string): boolean {
  return /^products\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.(?:jpg|png|webp)$/.test(key)
    && key.split('/')[1]!.length <= 200;
}
