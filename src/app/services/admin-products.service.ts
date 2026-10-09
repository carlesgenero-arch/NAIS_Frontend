import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { map, type Observable } from 'rxjs';
import type { AdminProductSummary, AdminProductDetail, AdminProductInput } from '../models/admin-product.interface';

export function adminProductError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const code: unknown = error.error?.status;
    if (error.status === 401 || error.status === 403) return 'No tens accés o la sessió ha caducat. Torna a identificar-te.';
    if (error.status === 404) return 'No s’ha trobat el producte.';
    if (error.status === 409 && code === 'product_has_orders') return 'No es pot eliminar: el producte té comandes associades. Arxiva’l per conservar l’historial.';
    if (error.status === 409 && code === 'product_not_deletable') return 'Només es poden eliminar productes en esborrany o arxivats.';
    if (error.status === 409 && code === 'slug_conflict') return 'Aquest slug ja existeix. Tria’n un altre.';
    if (error.status === 409) return 'El producte ha canviat. Torna a carregar-lo abans de desar.';
    if (code === 'product_not_purchasable') return 'No es pot activar: falta una configuració Stripe vàlida o el preu no coincideix.';
    if (error.status === 400) return 'Les dades no són vàlides. Revisa els camps.';
    if (code === 'unavailable' || error.status === 503) return 'El servei no està disponible i no podem confirmar el resultat. Torna al llistat i comprova el producte abans de tornar-ho a provar.';
  }
  return 'No s’ha pogut completar la petició. Torna-ho a provar.';
}
function detail(value: unknown): AdminProductDetail {
  const summary = readProduct(value);
  const row = value as Record<string, unknown>;
  const field = (key: string): string | null => {
    const v = row[key];
    if (v !== null && typeof v !== 'string') throw new Error('Invalid admin product');
    return v;
  };
  return { ...summary, description: field('description'), imageUrl: field('imageUrl'), featureImageUrl: field('featureImageUrl') };
}
function payload(value: AdminProductInput): AdminProductInput {
  // Explicit projection: no Stripe IDs, timestamps or product ID can enter a mutation.
  return { slug: value.slug, name: value.name, description: value.description, status: value.status,
    priceCents: value.priceCents, currency: value.currency, imageUrl: value.imageUrl, featureImageUrl: value.featureImageUrl };
}

function readProduct(value: unknown): AdminProductSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid admin product');
  const row = value as Record<string, unknown>;
  const status = row['status'];
  const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
  if (typeof row['id'] !== 'string' || !row['id'] || typeof row['slug'] !== 'string' || !row['slug']
    || typeof row['name'] !== 'string' || !row['name'].trim()
    || (status !== 'active' && status !== 'coming-soon' && status !== 'draft' && status !== 'archived')
    || typeof row['priceCents'] !== 'number' || !Number.isSafeInteger(row['priceCents']) || row['priceCents'] < 0
    || typeof row['currency'] !== 'string' || !/^[a-z]{3}$/.test(row['currency'])
    || !nullableText(row['stripeProductId']) || !nullableText(row['stripePriceId'])
    || typeof row['updatedAt'] !== 'string' || !Number.isFinite(Date.parse(row['updatedAt']))) {
    throw new Error('Invalid admin product');
  }
  return { id: row['id'], slug: row['slug'], name: row['name'], status,
    priceCents: row['priceCents'], currency: row['currency'], stripeProductId: row['stripeProductId'],
    stripePriceId: row['stripePriceId'], updatedAt: row['updatedAt'] };
}
@Injectable({ providedIn: 'root' })
export class AdminProductsService {
  private readonly http = inject(HttpClient);
  getProduct(id: string): Observable<AdminProductDetail> {
    return this.http.get<unknown>('/api/admin/products/' + encodeURIComponent(id)).pipe(map(detail));
  }
  createProduct(value: AdminProductInput): Observable<AdminProductDetail> {
    return this.http.post<unknown>('/api/admin/products', payload(value)).pipe(map(detail));
  }
  updateProduct(id: string, value: AdminProductInput): Observable<AdminProductDetail> {
    return this.http.patch<unknown>('/api/admin/products/' + encodeURIComponent(id), payload(value)).pipe(map(detail));
  }
  archiveProduct(id: string): Observable<AdminProductDetail> {
    return this.http.post<unknown>('/api/admin/products/' + encodeURIComponent(id) + '/archive', {}).pipe(map(detail));
  }
  deleteProduct(id: string): Observable<{ status: 'deleted' }> {
    return this.http.delete<unknown>('/api/admin/products/' + encodeURIComponent(id)).pipe(map(value => {
      if (!value || typeof value !== 'object' || !('status' in value) || value.status !== 'deleted') {
        throw new Error('Invalid delete response');
      }
      return { status: 'deleted' as const };
    }));
  }
  list(): Observable<readonly AdminProductSummary[]> {
    return this.http.get<unknown>('/api/admin/products').pipe(map(value => {
      if (!Array.isArray(value)) throw new Error('Invalid admin catalogue');
      const products = value.map(readProduct);
      if (new Set(products.map(product => product.id)).size !== products.length) throw new Error('Duplicate product ID');
      return products;
    }));
  }
}
