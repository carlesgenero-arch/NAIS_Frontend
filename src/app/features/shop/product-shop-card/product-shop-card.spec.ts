import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { ProductShopCard } from './product-shop-card';
import { ProductService } from '../../../services/product.service';
import { AddProductRequest } from '../../../models/product.interface';

describe('ProductShopCard', () => {
  it('keeps quantity at least one, emits the chosen quantity, and never selects through its controls', async () => {
    await TestBed.configureTestingModule({ imports: [ProductShopCard], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(ProductShopCard);
    const products = TestBed.inject(ProductService).products;
    fixture.componentRef.setInput('product', products[0]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const added = vi.fn();
    fixture.componentInstance.addRequested.subscribe(added);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const [minus, plus] = element.querySelectorAll<HTMLButtonElement>('.button--quantity');
    const value = element.querySelector<HTMLOutputElement>('output')!;
    expect(value.textContent).toBe('1');
    expect(minus.disabled).toBe(true);
    minus.click();
    plus.focus();
    expect(document.activeElement).toBe(plus);
    plus.click();
    plus.click();
    await fixture.whenStable();
    expect(value.textContent).toBe('3');
    expect(minus.disabled).toBe(false);
    minus.click();
    await fixture.whenStable();
    expect(value.textContent).toBe('2');
    value.click();
    element.querySelector<HTMLButtonElement>('.button--add')!.click();
    expect(added).toHaveBeenCalledWith({ product: products[0], quantity: 2 });
    expect(navigate).not.toHaveBeenCalled();
    minus.click();
    await fixture.whenStable();
    minus.click();
    expect(value.textContent).toBe('1');
    expect(minus.disabled).toBe(true);
    plus.click();
    fixture.componentRef.setInput('product', products[1]);
    await fixture.whenStable();
    expect(value.textContent).toBe('1');
    expect(minus.disabled).toBe(true);
  });

  it('updates product details and emits the current product without showing marketing copy', async () => {
    await TestBed.configureTestingModule({ imports: [ProductShopCard], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(ProductShopCard);
    const products = TestBed.inject(ProductService).products;
    const added: AddProductRequest[] = [];
    fixture.componentInstance.addRequested.subscribe(product => added.push(product));
    const element = fixture.nativeElement as HTMLElement;
    for (const product of products) {
      fixture.componentRef.setInput('product', product);
      await fixture.whenStable();
      expect(element.querySelector('[aria-haspopup="dialog"]')).toBeNull();
      expect(element.querySelector('app-modal')).toBeNull();
      expect(element.querySelector('h2')?.textContent?.trim()).toBe(product.name);
      expect(element.querySelector('.product-format')?.textContent).toBe(product.format);
      expect(element.querySelector('.product-price')?.textContent).toBe(product.price === undefined ? '' : '36,00 €');
      expect(element.querySelectorAll('img').length).toBe(product.imageUrl ? 1 : 0);
      expect(element.querySelector('img')?.getAttribute('src')).toBe(product.cardImageUrl ?? product.imageUrl);
      expect(element.querySelector('img')?.getAttribute('alt')).toBe(product.imageAlt);
      expect(element.textContent).not.toContain(product.description);
      const visual = element.querySelector<HTMLAnchorElement>('a.product-visual')!;
      expect(visual.getAttribute('href')).toBe(`/products/${product.slug}`);
      expect(visual.getAttribute('aria-label')).toBe(product.name);
      visual.focus();
      expect(document.activeElement).toBe(visual);
      const button = element.querySelector<HTMLButtonElement>('button.button--add')!;
      expect(button.type).toBe('button');
      expect(button.textContent).toBe('AFEGIR');
      button.click();
    }
    expect(added).toEqual(products.map(product => ({ product, quantity: 1 })));
  });
});

