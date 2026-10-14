import { TranslationService } from '../../../i18n/translation.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductGrid } from '../product-grid/product-grid';
import { AddProductRequest, Product } from '../../../models/product.interface';
import { ProductService } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';
import { CartDrawerService } from '../../../services/cart-drawer.service';
import { MAX_CART_QUANTITY } from '../../../models/cart.interface';
import { ProductSelectedDetail } from '../product-selected-detail/product-selected-detail';

@Component({
  selector: 'app-shop-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ProductGrid, ProductSelectedDetail],
  templateUrl: './shop-page.html',
  styleUrl: './shop-page.css',
})
export class ShopPage {
  protected readonly i18n = inject(TranslationService);
  private readonly cart = inject(CartService);
  private readonly cartDrawer = inject(CartDrawerService);
  protected readonly catalogue = inject(ProductService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  // Transient navigation info is not restored from history on back/forward.
  protected readonly focusDetail = computed(() => {
    const navigation = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    return navigation?.trigger === 'imperative'
      && navigation.extras.info === 'focus-product-detail'
      && !this.route.snapshot.fragment;
  });
  protected readonly detail = toSignal(this.route.paramMap.pipe(
    map(params => params.get('slug')),
    distinctUntilChanged(),
    switchMap(slug => !slug ? of({ status: 'catalogue' as const, product: null })
      : this.catalogue.findBySlug(slug).pipe(
        tap(product => { if (!product) void this.router.navigateByUrl('/products', { replaceUrl: true }); }),
        map(product => ({ status: 'ready' as const, product })),
        catchError(() => of({ status: 'error' as const, product: null })),
        startWith({ status: 'loading' as const, product: null }),
      )),
  ), { initialValue: { status: 'loading' as const, product: null } });
  protected readonly selectedProduct = computed(() => this.detail().product);
  private readonly selectedDetail = viewChild<ElementRef<HTMLElement>>('selectedDetail');
  private readonly centerRequested = signal<string | null>(
    this.router.currentNavigation()?.extras.info === 'center-product-detail'
      ? this.route.snapshot.paramMap.get('slug') : null,
  );

  constructor() {
    afterRenderEffect(() => {
      const slug = this.centerRequested();
      const card = this.selectedDetail();
      if (slug && this.selectedProduct()?.slug === slug && card) {
        // Wait for the selected product to render; leave keyboard focus in the drawer.
        card.nativeElement.scrollIntoView({ block: 'center', behavior: 'instant' });
        this.centerRequested.set(null);
      }
    });
  }
  private readonly cartFeedback = signal<{ added: boolean; product: string; count: number } | null>(null);
  protected readonly cartMessage = computed(() => {
    const feedback = this.cartFeedback();
    return feedback ? this.i18n.t(feedback.added ? 'cart.added' : 'cart.rejected', { product: this.i18n.text(feedback.product), count: feedback.count, max: MAX_CART_QUANTITY }) : '';
  });

  protected requestAdd({ product, quantity }: AddProductRequest): boolean {
    const added = this.cart.addItem(product.id, quantity);
    this.cartFeedback.set({ added, product: product.name, count: this.cart.totalQuantity() });
    if (added) this.cartDrawer.open();
    return added;
  }

  protected requestGridAdd(request: AddProductRequest): void {
    if (!this.requestAdd(request)) return;
    this.centerRequested.set(request.product.slug);
    void this.router.navigate(['/products', request.product.slug], {
      info: 'center-product-detail',
      queryParamsHandling: 'preserve',
      // This navigation centers the card once rendered instead of scrolling to page top.
      scroll: 'manual',
    }).catch(() => this.centerRequested.set(null));
  }

  protected requestSelectedProductAdd(product: Product): void {
    this.requestAdd({ product, quantity: 1 });
  }
}
