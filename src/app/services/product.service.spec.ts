import { TestBed } from '@angular/core/testing';
import { ProductService } from './product.service';

describe('ProductService seasonal products', () => {
  it('adds a distinct Harvest product while reusing the existing Tropical Hops data', () => {
    const products = TestBed.inject(ProductService).products;
    const original = products.find(product => product.slug === 'tropical-hops')!;
    const harvest = products.find(product => product.slug === 'tropical-hops-harvest')!;
    expect(harvest).toEqual({
      ...original,
      status: 'coming-soon',
      id: 'tropical-hops-harvest',
      slug: 'tropical-hops-harvest',
      name: 'Tropical Hops Harvest',
      isSeasonal: true,
      badge: 'NOVA COLLITA',
      featureDescription: original.description,
      imageUrl: 'images/products/hops_2.png',
      imageAlt: 'Llauna de Tropical Hops Harvest amb il·lustracions blaves i verdes de llúpol',
      featureBackgroundImageUrl: 'images/products/hop2.jpg',
    });
    expect(harvest).not.toBe(original);
    expect(harvest.nutrition).toBe(original.nutrition);
    expect(harvest.fruitImage).toBe(original.fruitImage);
    expect(original.isSeasonal).toBeUndefined();
    expect(original.name).toBe('TROPICAL HOPS');
    expect(new Set(products.map(product => product.slug)).size).toBe(products.length);
    expect(new Set(products.map(product => product.id)).size).toBe(products.length);
  });
});


describe('Product availability', () => {
  it('retains Harvest data but excludes it from the five active products', () => {
    const service = new ProductService();
    const harvest = service.products.find(product => product.id === 'tropical-hops-harvest')!;
    expect(harvest.status).toBe('coming-soon');
    expect(service.products.length).toBe(6);
    expect(service.activeProducts.length).toBe(5);
    expect(service.activeProducts).not.toContain(harvest);
    expect(service.activeProducts.every(product => product.status === 'active')).toBe(true);
  });

  it.each(['coming-soon', 'draft', 'archived'] as const)('excludes %s and allows activation through status alone', status => {
    const service = new ProductService();
    const product = service.products[0];
    product.status = status;
    expect(service.activeProducts).not.toContain(product);
    product.status = 'active';
    expect(service.activeProducts).toContain(product);
  });
});
