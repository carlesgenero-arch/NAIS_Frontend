import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, Subscription, switchMap, tap } from 'rxjs';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { TranslationService } from '../../../i18n/translation.service';
import { AdminProductsService, adminProductError } from '../../../services/admin-products.service';
import type { AdminProductDetail } from '../../../models/admin-product.interface';
import type { ProductStatus } from '../../../models/product.interface';
import { centsToEuro, euroToCents } from './product-price';
@Component({
  selector: 'app-admin-product-form', imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './admin-product-form.html', styleUrl: './admin-product-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductForm {
  private readonly i18n = inject(TranslationService);
  private uploadRequest?: Subscription;
  private readonly previewUrl = signal<string | null>(null);
  protected readonly imageFile = signal<File | null>(null);
  protected readonly uploadingImage = signal(false);
  protected readonly imageFeedback = signal('');
  protected readonly imageError = signal('');
  protected readonly imagePreview = computed(() => this.previewUrl() ?? this.product()?.imageUrl ?? null);
  private readonly service = inject(AdminProductsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly fb = inject(FormBuilder);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly imageInput = viewChild<ElementRef<HTMLInputElement>>('imageFileInput');
  private readonly saveButton = viewChild<ElementRef<HTMLButtonElement>>('saveButton');
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
    afterRenderEffect(() => {
      if (this.error()) this.errorSummary()?.nativeElement.focus();
    });
    this.destroyRef.onDestroy(() => this.clearSelectedImage());
    this.route.paramMap.pipe(
      tap(() => { this.uploadRequest?.unsubscribe(); this.uploadingImage.set(false); this.submitting.set(false); this.clearSelectedImage(); this.imageError.set(''); this.imageFeedback.set(''); this.loading.set(true); this.loadError.set(''); this.error.set(''); this.success.set(''); this.created.set(false); this.product.set(null); }),
      switchMap(params => {
        const id = params.get('id');
        return id ? this.service.getProduct(id).pipe(catchError(error => { this.loadError.set(adminProductError(error)); return of(null); })) : of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(product => { this.product.set(product); this.reset(product); this.loading.set(false); });
  }
  private clearSelectedImage(): void {
    const url = this.previewUrl();
    if (url) this.document.defaultView?.URL.revokeObjectURL(url);
    this.previewUrl.set(null); this.imageFile.set(null);
    const input = this.imageInput()?.nativeElement; if (input) input.value = '';
  }
  protected selectImage(event: Event): void {
    if (this.submitting() || this.uploadingImage()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.clearSelectedImage(); this.imageError.set(''); this.imageFeedback.set('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      this.imageError.set(this.i18n.t('admin.product.imageInvalid')); input.value = ''; return;
    }
    this.imageFile.set(file);
    this.previewUrl.set(this.document.defaultView?.URL.createObjectURL(file) ?? null);
  }
  protected uploadImage(): void {
    if (this.submitting() || this.loading() || this.uploadingImage()) return;
    this.performImageUpload();
  }
  private performImageUpload(done?: () => void): void {
    const product = this.product(), file = this.imageFile();
    if (!product || !file || this.uploadingImage()) return;
    this.uploadingImage.set(true); this.imageError.set(''); this.imageFeedback.set('');
    this.uploadRequest = this.service.uploadImage(product.id, file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.product.set({ ...product, ...result }); this.form.controls.imageUrl.setValue(result.imageUrl);
        this.clearSelectedImage(); this.uploadingImage.set(false);
        this.imageFeedback.set(this.i18n.t('admin.product.imageUploaded')); done?.();
      },
      error: () => { this.uploadingImage.set(false); this.submitting.set(false);
        this.imageError.set(this.i18n.t('admin.product.imageError')); },
    });
  }
  private completeSave(existing: boolean): void {
    this.created.set(!existing); this.success.set(this.product()?.stripePriceCleanupPending
      ? 'Producte desat. Neteja de Prices antics de Stripe pendent.' : existing ? 'Producte desat.' : 'Producte creat.');
    void this.router.navigate(['/admin/products'])
      .catch(() => { this.error.set('Producte desat. No s’ha pogut tornar al llistat. Utilitza l’enllaç Tornar als productes.'); })
      .finally(() => this.submitting.set(false));
  }
  private reset(product: AdminProductDetail | null): void {
    this.form.reset({ slug: product?.slug ?? '', name: product?.name ?? '', description: product?.description ?? '',
      status: product?.status ?? 'draft', price: product ? centsToEuro(product.priceCents) : '',
      currency: product?.currency ?? 'eur', imageUrl: product?.imageUrl ?? '', featureImageUrl: product?.featureImageUrl ?? '' });
  }
  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field]; return control.touched && control.invalid;
  }
  private confirm(message: string): boolean {
    // Native dialogs provide keyboard support and modal focus handling without another UI dependency.
    const accepted = this.document.defaultView?.confirm(message) ?? false;
    this.saveButton()?.nativeElement.focus();
    return accepted;
  }
  protected submit(): void {
    if (this.submitting() || this.uploadingImage() || this.loading() || this.loadError() || this.created()) return;
    this.success.set(''); this.error.set(''); this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const cents = euroToCents(value.price);
    if (!value.name.trim()) this.form.controls.name.setErrors({ required: true });
    if (cents === null || (value.status === 'active' && cents === 0)) this.form.controls.price.setErrors({ money: true });
    if (this.form.invalid || cents === null) { this.error.set('Revisa els camps indicats.'); return; }
    const existing = this.product();
    if (!existing && value.status === 'active') {
      this.error.set('Desa primer el producte com a esborrany o properament. Després podràs activar-lo amb Stripe.'); return;
    }
    if (existing && value.status === 'active' && existing.status !== 'active'
      && !this.confirm('Activar aquest producte? El servidor crearà o reutilitzarà un Product de Stripe i crearà un Price si cal. El producte estarà disponible per comprar només quan la sincronització sigui correcta.')) return;
    if (existing?.status === 'active' && value.status === 'active' && cents !== existing.priceCents
      && !this.confirm('Canviar el preu de ' + centsToEuro(existing.priceCents) + ' EUR a ' + centsToEuro(cents)
        + ' EUR? Stripe crearà un Price nou. L’anterior es conservarà com a històric i es desactivarà quan sigui segur. Les compres futures utilitzaran el Price nou.')) return;
    if (value.status === 'archived' && this.product()?.status !== 'archived'
      && !this.confirm('Vols arxivar aquest producte? Deixarà de ser comprable.')) return;
    const input = { slug: value.slug.trim().toLowerCase(), name: value.name.trim(), description: value.description.trim() || null,
      status: value.status, priceCents: cents, currency: value.currency,
      imageUrl: value.imageUrl.trim() || null, featureImageUrl: value.featureImageUrl.trim() || null };
    this.submitting.set(true);
    const request = existing ? this.service.updateProduct(existing.id, input) : this.service.createProduct(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: product => { this.product.set(product); this.reset(product);
        if (this.imageFile()) this.performImageUpload(() => this.completeSave(Boolean(existing)));
        else this.completeSave(Boolean(existing)); },
      error: error => { this.submitting.set(false); this.error.set(adminProductError(error)); },
    });
  }
}
