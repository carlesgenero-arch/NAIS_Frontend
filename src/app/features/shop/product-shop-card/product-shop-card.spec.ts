import { TestBed } from '@angular/core/testing';
import { ProductShopCard } from './product-shop-card';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.interface';

describe('ProductShopCard', () => {
  it('provides the exact ordered nutrition data for each product and opens its named dialog', async () => {
    await TestBed.configureTestingModule({ imports: [ProductShopCard] }).compileComponents();
    const products = TestBed.inject(ProductService).products;
    const fixture = TestBed.createComponent(ProductShopCard);
    const expected = [
      ['Valor energètic', '76 kJ / 18 kcal'], ['Greixos', '0,1 g'],
      ['dels quals saturats', '0 g'], ['Hidrats de carboni', '5,2 g'],
      ['dels quals sucres', '4,8 g'], ['Proteïnes', '0,1 g'], ['Sal', '0 g'],
    ];
    for (const product of products) {
      fixture.componentRef.setInput('product', product);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const dialog = element.querySelector('dialog')!;
      const showModal = vi.fn();
      Object.defineProperty(dialog, 'showModal', { value: showModal, configurable: true });
      const button = element.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
      expect(button.getAttribute('aria-label')).toContain(product.name);
      button.click();
      expect(showModal).toHaveBeenCalledOnce();
      expect(dialog.getAttribute('aria-label')).toBe(product.name);
      expect(dialog.querySelector('h2')?.textContent).toBe(product.name);
      expect(dialog.querySelector('caption')?.textContent).toBe('Informació nutricional per 100 ml');
      expect(Array.from(dialog.querySelectorAll('tr'), row => [row.querySelector('th')?.textContent, row.querySelector('td')?.textContent])).toEqual(expected);
      expect(product.nutrition).toBe(products[0].nutrition);
    }
  });

  it('updates product details and emits the current product without showing marketing copy', async () => {
    await TestBed.configureTestingModule({ imports: [ProductShopCard] }).compileComponents();
    const fixture = TestBed.createComponent(ProductShopCard);
    const products = TestBed.inject(ProductService).products;
    const added: Product[] = [];
    fixture.componentInstance.addRequested.subscribe(product => added.push(product));
    const element = fixture.nativeElement as HTMLElement;
    for (const product of products) {
      fixture.componentRef.setInput('product', product);
      await fixture.whenStable();
      expect(element.querySelector('h2')?.textContent).toBe(product.name);
      expect(element.querySelector('.product-format')?.textContent).toBe(product.format);
      expect(element.querySelector('.product-price')?.textContent).toBe('36,00 €');
      expect(element.querySelectorAll('img').length).toBe(1);
      expect(element.querySelector('img')?.getAttribute('src')).toBe(product.imageUrl);
      expect(element.querySelector('img')?.getAttribute('alt')).toBe(product.imageAlt);
      expect(element.textContent).not.toContain(product.description);
      const visual = element.querySelector<HTMLElement>('figure')!;
      visual.focus();
      expect(document.activeElement).toBe(visual);
      const button = element.querySelector<HTMLButtonElement>('button')!;
      expect(button.type).toBe('button');
      expect(button.textContent).toBe('AFEGIR');
      button.click();
    }
    expect(added).toEqual(products);
  });
});

