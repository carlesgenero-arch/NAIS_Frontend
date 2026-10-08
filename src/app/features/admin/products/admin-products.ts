import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe, UpperCasePipe, DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AdminProductsService, adminProductError } from '../../../services/admin-products.service';
import type { AdminProductSummary } from '../../../models/admin-product.interface';

type ProductsState = { kind: 'loading' } | { kind: 'error'; accessDenied: boolean }
  | { kind: 'ready'; products: readonly AdminProductSummary[] };
@Component({
  selector: 'app-admin-products', imports: [DatePipe, DecimalPipe, UpperCasePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-products.html', styleUrl: './admin-products.css',
})
export class AdminProducts {
  private readonly service = inject(AdminProductsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  protected readonly archiving = signal<string | null>(null);
  protected readonly feedback = signal('');
  protected readonly mutationError = signal('');
  protected archive(product: AdminProductSummary): void {
    if (this.archiving() || product.status === 'archived') return;
    if (!this.document.defaultView?.confirm('Vols arxivar ' + product.name + '? Deixarà de ser comprable.')) return;
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
  protected readonly state = signal<ProductsState>({ kind: 'loading' });
  protected readonly statusLabels: Record<AdminProductSummary['status'], string> = {
    active: 'Actiu', 'coming-soon': 'Properament', draft: 'Esborrany', archived: 'Arxivat',
  };
  constructor() { this.load(); }
  protected load(): void {
    this.state.set({ kind: 'loading' });
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: products => this.state.set({ kind: 'ready', products }),
      error: (error: unknown) => this.state.set({ kind: 'error', accessDenied:
        error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403) }),
    });
  }
}
