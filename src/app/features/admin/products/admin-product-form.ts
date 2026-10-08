import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { AdminProductsService, adminProductError } from '../../../services/admin-products.service';
import type { AdminProductDetail } from '../../../models/admin-product.interface';
import type { ProductStatus } from '../../../models/product.interface';
import { centsToEuro, euroToCents } from './product-price';
@Component({
  selector: 'app-admin-product-form', imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-product-form.html', styleUrl: './admin-product-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductForm {
  private readonly service = inject(AdminProductsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly fb = inject(FormBuilder);
  protected readonly product = signal<AdminProductDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly loadError = signal('');
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly created = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    slug: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(10000)],
    status: ['draft' as ProductStatus, Validators.required],
    price: ['', Validators.required], currency: ['eur', Validators.required],
    imageUrl: ['', Validators.maxLength(2048)], featureImageUrl: ['', Validators.maxLength(2048)],
  });
  constructor() {
    this.route.paramMap.pipe(
      tap(() => { this.loading.set(true); this.loadError.set(''); this.error.set(''); this.success.set(''); this.created.set(false); this.product.set(null); }),
      switchMap(params => {
        const id = params.get('id');
        return id ? this.service.getProduct(id).pipe(catchError(error => { this.loadError.set(adminProductError(error)); return of(null); })) : of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(product => { this.product.set(product); this.reset(product); this.loading.set(false); });
  }
  private reset(product: AdminProductDetail | null): void {
    this.form.reset({ slug: product?.slug ?? '', name: product?.name ?? '', description: product?.description ?? '',
      status: product?.status ?? 'draft', price: product ? centsToEuro(product.priceCents) : '',
      currency: product?.currency ?? 'eur', imageUrl: product?.imageUrl ?? '', featureImageUrl: product?.featureImageUrl ?? '' });
  }
  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field]; return control.touched && control.invalid;
  }
  protected submit(): void {
    if (this.submitting() || this.loading() || this.loadError() || this.created()) return;
    this.success.set(''); this.error.set(''); this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const cents = euroToCents(value.price);
    if (!value.name.trim()) this.form.controls.name.setErrors({ required: true });
    if (cents === null || (value.status === 'active' && cents === 0)) this.form.controls.price.setErrors({ money: true });
    if (this.form.invalid || cents === null) { this.error.set('Revisa els camps indicats.'); return; }
    if (value.status === 'archived' && this.product()?.status !== 'archived'
      && !this.document.defaultView?.confirm('Vols arxivar aquest producte? Deixarà de ser comprable.')) return;
    const input = { slug: value.slug.trim().toLowerCase(), name: value.name.trim(), description: value.description.trim() || null,
      status: value.status, priceCents: cents, currency: value.currency,
      imageUrl: value.imageUrl.trim() || null, featureImageUrl: value.featureImageUrl.trim() || null };
    const existing = this.product();
    this.submitting.set(true);
    const request = existing ? this.service.updateProduct(existing.id, input) : this.service.createProduct(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: product => { this.product.set(product); this.reset(product); this.submitting.set(false);
        this.created.set(!existing); this.success.set(existing ? 'Producte desat.' : 'Producte creat.'); },
      error: error => { this.submitting.set(false); this.error.set(adminProductError(error)); },
    });
  }
}
