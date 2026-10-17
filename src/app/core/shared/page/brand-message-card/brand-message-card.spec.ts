import { TestBed } from '@angular/core/testing';
import { BrandMessageCard } from './brand-message-card';

describe('BrandMessageCard', () => {
  it('preserves the Catalan copy and background while updating the accessible heading', async () => {
    await TestBed.configureTestingModule({ imports: [BrandMessageCard] }).compileComponents();
    const fixture = TestBed.createComponent(BrandMessageCard);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent).toBe('No som una beguda de benestar. Existim perquè la beguda en sí és bona');
    expect(element.querySelector('p')).toBeNull();
    expect(element.querySelector('section')?.getAttribute('aria-label')).toBe(element.querySelector('h2')?.textContent);
    expect(element.querySelectorAll('img').length).toBe(1);
    expect(element.querySelector('img')?.getAttribute('src')).toBe('images/brand-message/jakob-owens-qoFQxxuk3QY-unsplash.jpg');
    expect(element.querySelector('.brand-message--ready')).toBeNull();
    element.querySelector('img')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(element.querySelector('.brand-message--ready')).not.toBeNull();
    expect(element.querySelector('a')).toBeNull();

    fixture.componentRef.setInput('ctaHref', '/variety-pack');
    fixture.componentRef.setInput('heading', 'Updated heading');
    await fixture.whenStable();
    expect(element.querySelector('a')).toBeNull();
    expect(element.querySelector('h2')?.textContent).toBe('Updated heading');
    expect(element.querySelector('section')?.getAttribute('aria-label')).toBe('Updated heading');
  });
});


it('returns to the white loading state for a new image and handles a missing image without a dark placeholder', async () => {
  TestBed.configureTestingModule({ imports: [BrandMessageCard] });
  const fixture = TestBed.createComponent(BrandMessageCard);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  root.querySelector('img')!.dispatchEvent(new Event('load')); fixture.detectChanges();
  expect(root.querySelector('.brand-message--ready')).not.toBeNull();
  fixture.componentRef.setInput('imageSrc', 'new-image.jpg'); fixture.detectChanges();
  expect(root.querySelector('.brand-message--ready')).toBeNull();
  root.querySelector('img')!.dispatchEvent(new Event('error')); fixture.detectChanges();
  expect(root.querySelector('.brand-message--ready.brand-message--failed')).not.toBeNull();
});
