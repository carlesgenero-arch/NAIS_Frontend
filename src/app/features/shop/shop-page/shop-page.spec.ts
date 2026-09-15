import { TestBed } from '@angular/core/testing';
import { ShopPage } from './shop-page';
import { ProductService } from '../../../services/product.service';

describe('ShopPage', () => {
  it('renders the service catalogue and reports the pending cart without claiming success', async () => {
    await TestBed.configureTestingModule({ imports: [ShopPage] }).compileComponents();
    const fixture = TestBed.createComponent(ShopPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const products = TestBed.inject(ProductService).products;
    expect(element.querySelectorAll('app-product-grid').length).toBe(1);
    expect(element.querySelector('app-product-card')).toBeNull();
    const cards = Array.from(element.querySelectorAll('app-product-shop-card'));
    expect(cards.length).toBe(products.length);
    cards.forEach((card, index) => {
      expect(card.querySelector('h2')?.textContent).toBe(products[index].name);
      expect(card.querySelector('.product-format')?.textContent).toBe(products[index].format);
      expect(card.querySelector('.product-price')?.textContent).toBe(products[index].price === undefined ? '' : '36,00 €');
      expect(card.querySelectorAll('img').length).toBe(products[index].imageUrl ? 1 : 0);
      expect(card.textContent).not.toContain(products[index].description);

      expect(card.querySelector('article')?.getAttribute('data-variant')).toBe(products[index].variant);
      expect(card.querySelector('.button--add')?.getAttribute('aria-label')).toBe(`Afegir ${products[index].name} al carret`);
    });
    expect(element.querySelector('a.button--buy')).toBeNull();
    element.querySelector<HTMLButtonElement>('.button--add')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('El carret encara no està disponible');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(products[0].name);
  });
});

