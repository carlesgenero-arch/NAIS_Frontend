import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe, DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AdminProductsService, adminProductError } from '../../../services/admin-products.service';
import { TranslationService } from '../../../i18n/translation.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import type { AdminProductSummary } from '../../../models/admin-product.interface';

type ProductsState = { kind: 'loading' } | { kind: 'error'; accessDenied: boolean }
  | { kind: 'ready'; products: readonly AdminProductSummary[] };
@Component({
  selector: 'app-admin-products', imports: [DatePipe, DecimalPipe, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-products.html', styleUrl: './admin-products.css',
})
export class AdminProducts {
  private readonly i18n = inject(TranslationService);
  private readonly service = inject(AdminProductsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  protected readonly archiving = signal<string | null>(null);
  protected readonly reconciling = signal<string | null>(null);
  protected readonly deleting = signal<string | null>(null);
  protected readonly loading = signal(false);
  private readonly previousProducts = signal<readonly AdminProductSummary[]>([]);
  protected readonly visibleProducts = computed(() => { const state = this.state(); return state.kind === 'ready' ? state.products : this.previousProducts(); });
  protected readonly feedback = signal('');
  protected readonly mutationError = signal('');
  protected archive(product: AdminProductSummary): void {
    if (this.state().kind !== 'ready' || this.archiving() || this.deleting() || this.reconciling() || product.status === 'archived') return;
    if (!this.document.defaultView?.confirm(this.i18n.t('admin.feedback.archiveConfirm', { name: product.name }))) return;
    this.archiving.set(product.id); this.feedback.set(''); this.mutationError.set('');
    this.service.archiveProduct(product.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.state.update(current => current.kind === 'ready'
          ? { kind: 'ready', products: current.products.map(p => p.id === updated.id ? updated : p) } : current);
        this.archiving.set(null); this.feedback.set('Producte arxivat.');
      },
      error: error => { this.archiving.set(null); this.mutationError.set(adminProductError(error)); },
    });
  }
  protected deletePermanently(product: AdminProductSummary): void {
    if (this.state().kind !== 'ready' || this.archiving() || this.deleting() || this.reconciling() || !['draft', 'archived'].includes(product.status)) return;
    if (!this.document.defaultView?.confirm(this.i18n.t('admin.feedback.deleteConfirm', { name: product.name }))) return;
    this.deleting.set(product.id); this.feedback.set(''); this.mutationError.set('');
    this.service.deleteProduct(product.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.state.update(current => current.kind === 'ready'
          ? { kind: 'ready', products: current.products.filter(p => p.id !== product.id) } : current);
        this.deleting.set(null); this.feedback.set('Producte eliminat definitivament.');
      },
      error: error => { this.deleting.set(null); this.mutationError.set(adminProductError(error)); },
    });
  }
  protected reconcile(product: AdminProductSummary): void {
    if (this.state().kind !== 'ready' || this.reconciling() || this.archiving() || this.deleting()) return;
    this.reconciling.set(product.id); this.feedback.set(''); this.mutationError.set('');
    this.service.reconcilePrices(product.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.state.update(current => current.kind === 'ready'
          ? { kind: 'ready', products: current.products.map(p => p.id === updated.id ? updated : p) } : current);
        this.reconciling.set(null);
        this.feedback.set(updated.stripePriceCleanupPending
          ? 'El preu està desat. La neteja de Prices antics de Stripe continua pendent; pots reintentar-la més tard.'
          : 'Neteja de Prices antics de Stripe completada. El preu vigent no ha canviat.');
      },
      error: error => { this.reconciling.set(null); this.mutationError.set(adminProductError(error)); },
    });
  }
  protected readonly state = signal<ProductsState>({ kind: 'loading' });
  protected readonly statusLabels: Record<AdminProductSummary['status'], string> = {
    active: 'Actiu', 'sold-out': 'SOLD OUT', 'coming-soon': 'Properament', draft: 'Esborrany', archived: 'Arxivat',
  };
  constructor() { this.load(); }
  protected load(): void {
    if (this.loading() || this.archiving() || this.reconciling() || this.deleting()) return;
    const previous = this.state(); if (previous.kind === 'ready') this.previousProducts.set(previous.products);
    this.loading.set(true); this.state.set({ kind: 'loading' });
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: products => { this.mutationError.set(''); this.state.set({ kind: 'ready', products }); this.loading.set(false); },
      error: (error: unknown) => { this.loading.set(false);
        if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) this.previousProducts.set([]);
        this.state.set({ kind: 'error', accessDenied:
        error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403) }); },
    });
  }
}
