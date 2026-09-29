import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
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
  private readonly products = inject(ProductService).products;
  private readonly routeParams = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly selectedProduct = computed(() => {
    const slug = this.routeParams()?.get('slug');
    return slug === null || slug === undefined
      ? this.products[0]
      : this.products.find(product => product.slug === slug);
  });
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
