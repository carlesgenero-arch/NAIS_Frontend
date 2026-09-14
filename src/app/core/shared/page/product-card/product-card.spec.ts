import { TestBed } from '@angular/core/testing';
import { Product } from '../../../../models/product.interface';
import { ProductService } from '../../../../services/product.service';
import { ProductCard } from './product-card';

describe('ProductCard', () => {
  it('emits the current product from its optional catalogue action', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCard] }).compileComponents();
    const fixture = TestBed.createComponent(ProductCard);
    const products = TestBed.inject(ProductService).products;
    fixture.componentRef.setInput('product', products[0]);
    fixture.componentRef.setInput('presentation', 'catalogue');
    const received: Product[] = [];
    fixture.componentInstance.addRequested.subscribe(product => received.push(product));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('a.button--buy')).toBeNull();
    const button = element.querySelector<HTMLButtonElement>('button.button--add')!;
    expect(button.type).toBe('button');
    button.click();
    fixture.componentRef.setInput('product', products[1]);
    await fixture.whenStable();
    button.click();
    expect(received).toEqual([products[0], products[1]]);
  });

  it('renders all catalogue products through the same input without retaining previous content', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCard] }).compileComponents();
    const products = TestBed.inject(ProductService).products;
    expect(products.map(product => product.name)).toEqual(['ORANGE SPRITZ', 'PASSION HUGO', 'GINGER MANGO']);
    expect(new Set(products.map(product => product.imageUrl)).size).toBe(3);
    expect(products.map(product => product.fruitImage?.url)).toEqual([
      'images/info-card/orange.png', 'images/info-card/lemon.jpg', 'images/info-card/mango.png',
    ]);
    expect(products.map(product => product.variant)).toEqual(['citrus', 'botanical', 'ginger']);
    const fixture = TestBed.createComponent(ProductCard);
    const element = fixture.nativeElement as HTMLElement;
    for (const product of products) {
      fixture.componentRef.setInput('product', product);
      await fixture.whenStable();
      expect(element.querySelector('h2')?.textContent).toBe(product.name);
      expect(element.querySelector('.product-description')?.textContent).toBe(product.description);
      expect(element.querySelector('.product-ingredients')?.textContent).toBe(product.ingredients);
      expect(element.querySelector('img')?.getAttribute('src')).toBe(product.imageUrl);
      expect(element.querySelector('img')?.getAttribute('alt')).toBe(product.imageAlt);
      const preview = element.querySelector<HTMLElement>('.product-image-switcher');
      expect(preview?.tabIndex).toBe(0);
      expect(element.querySelector('.product-image--fruit')?.getAttribute('src')).toBe(product.fruitImage?.url);
      expect(element.querySelector('.product-image--fruit')?.getAttribute('alt')).toBe(product.fruitImage?.alt);
      preview?.focus();
      expect(document.activeElement).toBe(preview);
      expect(element.querySelector('article')?.getAttribute('data-variant')).toBe(product.variant);
      expect(element.querySelectorAll('a.button--buy').length).toBe(1);
    }
  });

  it('renders the service product and updates when a different product is supplied', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCard] }).compileComponents();
    const fixture = TestBed.createComponent(ProductCard);
    const firstProduct = TestBed.inject(ProductService).products[0];
    fixture.componentRef.setInput('product', firstProduct);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent).toBe('ORANGE SPRITZ');
    expect(element.querySelector('.product-description')?.textContent).toBe('AFRUITADA AMB CON UN TOC AMARG MEMORABLE. CARÀCTER NATURAL A CADA GLOP');
    expect(element.querySelector('.product-ingredients')?.textContent).toBe('Taronja, Llimona, Gerds, Arrel de genciana');
    expect(element.querySelector('article')?.getAttribute('data-variant')).toBe('citrus');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(firstProduct.imageUrl);
    expect(element.querySelector('img')?.getAttribute('alt')).toBe(firstProduct.imageAlt);
    expect(element.querySelector('a.button--buy')?.getAttribute('href')).toBe('/shop');

    const nextProduct: Product = {
      id: 'test-product', name: 'Test flavour', description: 'Test description',
      imageUrl: 'images/test.png', variant: 'neutral', purchaseUrl: '/test-product',
    };
    fixture.componentRef.setInput('product', nextProduct);
    await fixture.whenStable();
    expect(element.querySelector('h2')?.textContent).toBe('Test flavour');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/test.png');
    expect(element.querySelector('img')?.getAttribute('alt')).toBe('Test flavour can');
    expect(element.querySelector('article')?.getAttribute('data-variant')).toBe('neutral');
    expect(element.querySelector('.product-ingredients')).toBeNull();
    expect(element.querySelector('.product-image--fruit')).toBeNull();
    expect(element.querySelector('.product-image-switcher')?.hasAttribute('tabindex')).toBe(false);
    expect(element.querySelector('a.button--buy')?.getAttribute('href')).toBe('/test-product');
  });
});
