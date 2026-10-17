import { CA } from '../../../i18n/ca';
import { MockProductService } from '../../../testing/product-fixture';
import { TestBed } from '@angular/core/testing';
import { ProductSelectedDetail } from './product-selected-detail';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.interface';
import { TranslationService } from '../../../i18n/translation.service';

beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: ProductService, useClass: MockProductService }] }));

describe('ProductSelectedDetail', () => {
  it('groups translated ingredients and purchase information in reading order without changing the product', async () => {
    TestBed.configureTestingModule({ imports: [ProductSelectedDetail] });
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({ getItem: () => null, setItem: vi.fn() } as unknown as Storage);
    const product = Object.freeze({ ...TestBed.inject(ProductService).products[0], price: 37.5 });
    const fixture = TestBed.createComponent(ProductSelectedDetail);
    fixture.componentRef.setInput('product', product);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const i18n = TestBed.inject(TranslationService);
    expect(root.querySelector('.selected-detail__ingredients')?.textContent).toBe('Taronja · hibisc · gerds · genciana');
    expect(root.querySelector('.selected-detail__price')?.textContent).toContain('37,50');
    expect(root.querySelector('.selected-detail__description')?.textContent).toBe(product.description);
    const content = root.querySelector('.selected-detail__content')!;
    expect([...content.children].filter(child => child.tagName !== 'APP-MODAL').map(child => child.className || child.tagName))
      .toEqual(['H1', 'selected-detail__description', 'selected-detail__ingredient-group',
        'button--nutrition selected-detail__nutrition', 'selected-detail__purchase-info', 'button--buy selected-detail__add']);
    const add = root.querySelector<HTMLButtonElement>('.selected-detail__add')!;
    expect(add.type).toBe('button');
    expect(add.classList.contains('button--add')).toBe(false);
    i18n.setLanguage('es');
    await fixture.whenStable();
    expect(root.querySelector('.selected-detail__ingredients')?.textContent).toBe('Naranja · hibisco · frambuesas · genciana');
    expect(root.querySelector('.selected-detail__format')?.textContent).toContain('latas');
    expect(add.getAttribute('aria-label')).toBe('Añadir ORANGE SPRITZ a la cesta');
    expect(product.ingredients).toBe('TARONJA, HIBISC, GERDS, GENCIANA');
    i18n.setLanguage('ca');
    vi.restoreAllMocks();
  });

  it('provides the exact ordered nutrition data for each product and opens its named dialog', async () => {
    await TestBed.configureTestingModule({ imports: [ProductSelectedDetail] }).compileComponents();
    const products = TestBed.inject(ProductService).products;
    const fixture = TestBed.createComponent(ProductSelectedDetail);
    const expected: Record<string, readonly (readonly string[])[]> = {
      'orange-spritz': [
        ['Valor energètic', '98 kJ / 23 kcal'],
        ['Greixos', '0,0 g'],
        ['dels quals saturats', '0,0 g'],
        ['Hidrats de carboni', '5,2 g'],
        ['dels quals sucres', '4,8 g'],
        ['Proteïnes', '0,1 g'],
        ['Sal', '<0,01 g'],
      ],
      'passion-hugo': [
        ['Valor energètic', '99 kJ / 23 kcal'],
        ['Greixos', '0,0 g'],
        ['dels quals saturats', '0,0 g'],
        ['Hidrats de carboni', '5,1 g'],
        ['dels quals sucres', '4,9 g'],
        ['Proteïnes', '0,1 g'],
        ['Sal', '<0,01 g'],
      ],
      'ginger-crush': [
        ['Valor energètic', '102 kJ / 24 kcal'],
        ['Greixos', '0,0 g'],
        ['dels quals saturats', '0,0 g'],
        ['Hidrats de carboni', '5,3 g'],
        ['dels quals sucres', '5,1 g'],
        ['Proteïnes', '0,1 g'],
        ['Sal', '<0,01 g'],
      ],
      'tropical-hops': [
        ['Valor energètic', '103 kJ / 24 kcal'],
        ['Greixos', '0,2 g'],
        ['dels quals saturats', '0,0 g'],
        ['Hidrats de carboni', '5,3 g'],
        ['dels quals sucres', '4,9 g'],
        ['Proteïnes', '0,2 g'],
        ['Sal', '<0,01 g'],
      ],
    };
    for (const product of products.filter(product => product.nutrition)) {
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
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe(product.name);
      expect(dialog.querySelector('caption')?.textContent).toBe('Informació nutricional per 100 ml');
      expect(Array.from(dialog.querySelectorAll('tr'), row => [row.querySelector('th')?.textContent, row.querySelector('td')?.textContent])).toEqual(expected[product.isSeasonal ? 'tropical-hops' : product.id]);

    }
  });


  it('renders each supplied product and emits that exact product', async () => {
    await TestBed.configureTestingModule({ imports: [ProductSelectedDetail] }).compileComponents();
    const fixture = TestBed.createComponent(ProductSelectedDetail);
    const received: Product[] = [];
    fixture.componentInstance.addRequested.subscribe(product => received.push(product));
    const products = TestBed.inject(ProductService).products;
    const element = fixture.nativeElement as HTMLElement;
    for (const product of products) {
      fixture.componentRef.setInput('product', product);
      await fixture.whenStable();
      expect(element.querySelector('h1')?.textContent).toBe(product.name);
      expect(element.querySelector('.selected-detail__ingredients')?.textContent?.toLocaleUpperCase('ca').replaceAll(' · ', ', ')).toBe(product.ingredients);
      if (product.detailsPending) {
        expect(element.querySelector('.selected-detail__label')).toBeNull();
        expect(element.querySelector('app-modal')).toBeNull();
        expect(element.querySelector('[aria-haspopup="dialog"]')).toBeNull();
        expect(element.querySelector('.selected-detail__format')?.textContent).toBe(product.format);
        expect(element.querySelector('.selected-detail__description')?.textContent).toBe(product.description);
      }
      expect(element.querySelectorAll('img').length).toBe((product.imageUrl ? 1 : 0) + ((product.featureBackgroundImageUrl || product.fruitImage) ? 1 : 0));
      expect(element.querySelector('.selected-detail__can')?.getAttribute('src')).toBe(product.imageUrl);
      expect(element.querySelector('.selected-detail__fruit')?.getAttribute('src')).toBe(product.featureBackgroundImageUrl ? undefined : product.fruitImage?.url);
      expect(element.querySelector('.selected-detail__fruit')?.getAttribute('alt')).toBe(product.featureBackgroundImageUrl ? undefined : product.fruitImage?.alt);
      expect(element.querySelector('section')?.getAttribute('data-variant')).toBe(product.variant);
      const button = element.querySelector<HTMLButtonElement>('.selected-detail__add')!;
      if (product.status !== 'active') {
        expect(button).toBeNull();
        continue;
      }
      expect(button.getAttribute('aria-label')).toContain(product.name);
      button.click();
    }
    expect(received).toEqual(products.filter(product => product.status === 'active'));
    fixture.componentRef.setInput('product', { status: 'active', id: 'missing', slug: 'missing', name: 'Sense dades', description: '' } satisfies Product);
    await fixture.whenStable();
    expect(element.querySelector('.selected-detail__ingredients')?.textContent).toBe('Informació dels ingredients no disponible');
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('[aria-haspopup="dialog"]')).toBeNull();
    expect(element.querySelector('app-modal')).toBeNull();
  });
});


it('preserves Girona capitalization in the Harvest ingredients in CAT and CAST', async () => {
  await TestBed.configureTestingModule({ imports: [ProductSelectedDetail] }).compileComponents();
  const fixture = TestBed.createComponent(ProductSelectedDetail);
  const harvest = new MockProductService().products.find(p => p.id === 'tropical-hops-harvest')!;
  fixture.componentRef.setInput('product', { ...harvest,
    ingredients: CA['ui.tropical_hops_fresh_hops_chinook_dels_camps_de_biolupulus_Girona'] });
  await fixture.whenStable();
  const translations = TestBed.inject(TranslationService);
  for (const [language, expected] of [
    ['ca', 'Tropical hops + fresh hops chinook dels camps de biolupulus-Girona'],
    ['es', 'Tropical hops + fresh hops chinook de los campos de biolupulus-Girona'],
  ] as const) {
    translations.setLanguage(language);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.selected-detail__ingredients')?.textContent).toBe(expected);
  }
});
