import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.interface';
import { HomePage } from './home-page';

describe('HomePage product placement', () => {
  it('shows the four active regular products without the coming-soon Harvest', async () => {
    await TestBed.configureTestingModule({ imports: [HomePage], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const cards = Array.from(element.querySelectorAll('app-product-card, app-product-feature-card'));
    expect(cards.map(card => card.tagName.toLowerCase())).toEqual([
      ...Array(4).fill('app-product-card'),
    ]);
    expect(cards.map(card => card.classList.contains('product-card--image-left'))).toEqual([false, true, false, true]);
    expect(cards.map(card => card.querySelector('h2')?.textContent)).toEqual([
      'ORANGE SPRITZ', 'PASSION HUGO', 'GINGER CRUSH', 'TROPICAL HOPS',
    ]);
  });

  it('selects featured and seasonal products only, including products with both flags once', async () => {
    const base: Product = { status: 'active', id: 'regular', slug: 'regular', name: 'Regular', description: 'Descripció' };
    const products: Product[] = [base,
      { ...base, id: 'featured', slug: 'featured', isFeatured: true },
      { ...base, id: 'seasonal', slug: 'seasonal', isSeasonal: true },
      { ...base, id: 'both', slug: 'both', isFeatured: true, isSeasonal: true },
    ];
    await TestBed.configureTestingModule({
      imports: [HomePage], providers: [provideRouter([]), { provide: ProductService, useValue: { activeProducts: products } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(Array.from(element.querySelectorAll('app-product-feature-card a')).map(link => link.getAttribute('href')))
      .toEqual(['/products/featured', '/products/seasonal', '/products/both']);
    expect(element.querySelectorAll('app-product-card').length).toBe(1);
  });
});
