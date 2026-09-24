import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { Product } from '../../models/product.interface';
import { ProductService } from '../../services/product.service';

export const productResolver: ResolveFn<Product> = route => {
  const product = inject(ProductService).products.find(product => product.slug === route.paramMap.get('slug'));
  return product ?? new RedirectCommand(inject(Router).parseUrl('/products'));
};
