import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  imports: [ProductGrid, ProductSelectedDetail],
  templateUrl: './shop-page.html',
  styleUrl: './shop-page.css',
})
export class ShopPage {
  private readonly cart = inject(CartService);
  private readonly cartDrawer = inject(CartDrawerService);
  protected readonly catalogue = inject(ProductService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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
  protected readonly selectedProduct = computed(() => this.detail().status === 'catalogue'
    ? this.catalogue.activeProducts[0] : this.detail().product);
  protected readonly cartMessage = signal('');

  protected requestAdd({ product, quantity }: AddProductRequest): void {
    const added = this.cart.addItem(product.id, quantity);
    this.cartMessage.set(added
      ? `${product.name}: afegit al carret. Total: ${this.cart.totalQuantity()} unitats.`
      : `No s'ha afegit ${product.name}. La quantitat ha de ser un enter positiu i el total per producte no pot superar ${MAX_CART_QUANTITY} unitats.`);
    if (added) this.cartDrawer.open();
  }

  protected requestSelectedProductAdd(product: Product): void {
    this.requestAdd({ product, quantity: 1 });
  }
}
