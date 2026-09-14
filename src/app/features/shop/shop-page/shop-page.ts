import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ProductGrid } from '../product-grid/product-grid';
import { Product } from '../../../models/product.interface';

@Component({
  selector: 'app-shop-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductGrid],
  templateUrl: './shop-page.html',
  styleUrl: './shop-page.css',
})
export class ShopPage {
  protected readonly cartMessage = signal('');

  protected requestAdd(product: Product): void {
    // Connect this event to CartService when its placeholder has an add operation.
    this.cartMessage.set(`El carret encara no està disponible. No s'ha afegit ${product.name}.`);
  }
}
