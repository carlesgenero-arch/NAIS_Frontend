import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, Observable, of, ReplaySubject, throwError } from 'rxjs';
import type { Product } from '../models/product.interface';
import type { PublicProduct } from '../models/public-product.interface';
import { PRODUCT_DISPLAY_ORDER, PRODUCT_PRESENTATION } from './product-presentation';

const CATALOGUE_ERROR = 'No hem pogut carregar els productes. Torna-ho a provar.';

function isSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isImageUrl(value: unknown): value is string | null {
  return value === null || (typeof value === 'string'
    && /^(?:images\/|\/images\/|https:\/\/)/.test(value));
}

function readProduct(value: unknown): Product {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(CATALOGUE_ERROR);
  const row = value as Record<string, unknown>;
  if (!isSlug(row['id']) || !isSlug(row['slug']) || typeof row['name'] !== 'string' || !row['name'].trim()
    || (row['description'] !== null && typeof row['description'] !== 'string')
    || (row['status'] !== 'active' && row['status'] !== 'coming-soon')
    || typeof row['priceCents'] !== 'number' || !Number.isSafeInteger(row['priceCents']) || row['priceCents'] < 0
    // Existing storefront money formatting is EUR-only. Do not mislabel other currencies.
    || row['currency'] !== 'eur' || !isImageUrl(row['imageUrl']) || !isImageUrl(row['featureImageUrl'])) {
    throw new Error(CATALOGUE_ERROR);
  }
  const dto: PublicProduct = {
    id: row['id'], slug: row['slug'], name: row['name'], description: row['description'],
    status: row['status'], priceCents: row['priceCents'], currency: row['currency'],
    imageUrl: row['imageUrl'], featureImageUrl: row['featureImageUrl'],
  };
  return {
    ...(Object.hasOwn(PRODUCT_PRESENTATION, dto.id) ? PRODUCT_PRESENTATION[dto.id] : { variant: 'neutral' as const }),
    id: dto.id, slug: dto.slug, name: dto.name, description: dto.description ?? '', status: dto.status,
    price: dto.priceCents / 100, imageUrl: dto.imageUrl ?? undefined,
    featureImageUrl: dto.featureImageUrl ?? undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogue = signal<readonly Product[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly loadedState = signal(false);
  private readonly ready = new ReplaySubject<void>(1);
  readonly ready$ = this.ready.asObservable();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  get products(): readonly Product[] { return this.catalogue(); }
  get activeProducts(): readonly Product[] { return this.products.filter(product => product.status === 'active'); }

  constructor() { this.load(); }

  /** One shared catalogue request; failed requests can be retried explicitly. */
  load(): void {
    if (this.loading() || this.loaded()) return;
    this.loadingState.set(true);
    this.errorState.set(null);
    this.http.get<unknown>('/api/products').pipe(
      map(value => {
        if (!Array.isArray(value)) throw new Error(CATALOGUE_ERROR);
        const products = value.map(readProduct);
        if (new Set(products.map(p => p.id)).size !== products.length
          || new Set(products.map(p => p.slug)).size !== products.length) throw new Error(CATALOGUE_ERROR);
        const rank = (id: string) => { const index = PRODUCT_DISPLAY_ORDER.indexOf(id); return index < 0 ? PRODUCT_DISPLAY_ORDER.length : index; };
        return products.sort((a, b) => rank(a.id) - rank(b.id) || a.slug.localeCompare(b.slug));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: products => {
        this.catalogue.set(products);
        this.loadedState.set(true);
        this.loadingState.set(false);
        this.ready.next();
        this.ready.complete();
      },
      error: () => { this.loadingState.set(false); this.errorState.set(CATALOGUE_ERROR); },
    });
  }

  findBySlug(slug: string): Observable<Product | null> {
    if (!isSlug(slug)) return of(null);
    return this.http.get<unknown>(`/api/products/${encodeURIComponent(slug)}`).pipe(
      map(value => {
        const product = readProduct(value);
        if (product.slug !== slug) throw new Error(CATALOGUE_ERROR);
        return product.status === 'active' ? product : null;
      }),
      catchError(error => error instanceof HttpErrorResponse && error.status === 404
        ? of(null) : throwError(() => new Error(CATALOGUE_ERROR))),
    );
  }
}
