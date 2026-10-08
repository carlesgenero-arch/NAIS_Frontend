import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, type Observable } from 'rxjs';
import type { AdminProductSummary } from '../models/admin-product.interface';

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
  list(): Observable<readonly AdminProductSummary[]> {
    return this.http.get<unknown>('/api/admin/products').pipe(map(value => {
      if (!Array.isArray(value)) throw new Error('Invalid admin catalogue');
      const products = value.map(readProduct);
      if (new Set(products.map(product => product.id)).size !== products.length) throw new Error('Duplicate product ID');
      return products;
    }));
  }
}
