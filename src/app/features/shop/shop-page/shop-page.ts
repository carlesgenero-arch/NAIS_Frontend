import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ProductGrid } from '../product-grid/product-grid';
import { AddProductRequest, Product } from '../../../models/product.interface';
import { ProductService } from '../../../services/product.service';
import { ProductSelectedDetail } from '../product-selected-detail/product-selected-detail';

@Component({
  selector: 'app-shop-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductGrid, ProductSelectedDetail],
  templateUrl: './shop-page.html',
  styleUrl: './shop-page.css',
})
export class ShopPage {
  private readonly products = inject(ProductService).products;
  private readonly routeParams = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly selectedProduct = computed(() => {
    const slug = this.routeParams()?.get('slug');
    return slug === null || slug === undefined
      ? this.products[0]
      : this.products.find(product => product.slug === slug);
  });
  protected readonly cartMessage = signal('');

  protected requestAdd({ product }: AddProductRequest): void {
    // Connect this event to CartService when its placeholder has an add operation.
    this.cartMessage.set(`El carret encara no està disponible. No s'ha afegit ${product.name}.`);
  }

  protected requestSelectedProductAdd(product: Product): void {
    this.requestAdd({ product, quantity: 1 });
  }
}
