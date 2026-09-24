import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { ProductShopCard } from '../product-shop-card/product-shop-card';
import { AddProductRequest } from '../../../models/product.interface';
import { ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-product-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductShopCard],
  templateUrl: './product-grid.html',
  styleUrl: './product-grid.css',
})
export class ProductGrid {
  protected readonly products = inject(ProductService).products;
  readonly addRequested = output<AddProductRequest>();
}
