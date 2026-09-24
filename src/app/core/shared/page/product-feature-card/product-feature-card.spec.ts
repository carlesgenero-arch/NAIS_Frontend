import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Product } from '../../../../models/product.interface';
import { ProductService } from '../../../../services/product.service';
import { ProductFeatureCard } from './product-feature-card';

describe('ProductFeatureCard', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [ProductFeatureCard],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductFeatureCard);
    const harvest = TestBed.inject(ProductService).products.find(
      product => product.slug === 'tropical-hops-harvest')!;
    fixture.componentRef.setInput('product', harvest);
    await fixture.whenStable();
    return { fixture, harvest, element: fixture.nativeElement as HTMLElement };
  }

  it('renders Harvest assets and an accessible link to its product route', async () => {
    const { element, harvest } = await setup();
    expect(element.querySelector('h2')?.textContent).toBe(harvest.name);
    expect(element.querySelector('.product-feature__badge')?.textContent).toBe('NOVA COLLITA');
    expect(element.querySelector('p')?.textContent).toBe(harvest.featureDescription);
    expect(element.querySelector('.product-feature__background')?.getAttribute('src')).toBe(harvest.featureBackgroundImageUrl);
    expect(element.querySelector('.product-feature__background')?.getAttribute('alt')).toBe('');
    const image = element.querySelector('img.product-feature__image')!;
    expect(image.getAttribute('src')).toBe('images/products/hops_2.png');
    expect(image.getAttribute('alt')).toBe(harvest.imageAlt);
    const link = element.querySelector<HTMLAnchorElement>('a')!;
    expect(link.getAttribute('href')).toBe('/products/tropical-hops-harvest');
    expect(link.getAttribute('aria-label')).toBe('Descobreix Tropical Hops Harvest');
    link.focus();
    expect(document.activeElement).toBe(link);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    link.click();
    expect(navigate).toHaveBeenCalled();
    expect(TestBed.inject(Router).serializeUrl(navigate.mock.calls[0][0] as import('@angular/router').UrlTree))
      .toBe('/products/tropical-hops-harvest');
  });

  it('updates for limited editions and falls back to ordinary product content', async () => {
    const { fixture, element } = await setup();
    const limited: Product = {
      id: 'limited', slug: 'limited', name: 'Edició limitada', description: 'Una edició especial.',
      badge: 'EDICIÓ LIMITADA', imageUrl: 'images/products/hops_1.png',
    };
    fixture.componentRef.setInput('product', limited);
    await fixture.whenStable();
    expect(element.querySelector('h2')?.textContent).toBe(limited.name);
    expect(element.querySelector('p')?.textContent).toBe(limited.description);
    expect(element.querySelector('.product-feature__badge')?.textContent).toBe(limited.badge);
    expect(element.querySelector('.product-feature__background')).toBeNull();
    expect(element.querySelector('img')?.getAttribute('src')).toBe(limited.imageUrl);
    expect(element.querySelector('img')?.getAttribute('alt')).toBe(limited.name);
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/products/limited');
    fixture.componentRef.setInput('product', { ...limited, badge: undefined });
    await fixture.whenStable();
    expect(element.querySelector('.product-feature__badge')?.textContent).toBe('DESTACAT');
  });
});
