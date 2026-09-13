import { TestBed } from '@angular/core/testing';
import { InfoCard, type InfoCardContent } from './info-card';

describe('InfoCard', () => {
  it('renders and updates typed benefit text and colour without images', async () => {
    await TestBed.configureTestingModule({ imports: [InfoCard] }).compileComponents();
    const fixture = TestBed.createComponent(InfoCard);
    const content: InfoCardContent = {
      text: 'Sense sucres afegits ni edulcorants',
      colour: 'pink',
    };
    fixture.componentRef.setInput('content', content);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('article h2')?.textContent).toBe(content.text);
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('article')?.getAttribute('data-colour')).toBe('pink');

    fixture.componentRef.setInput('content', {
      text: 'sense filtrar',
      colour: 'green',
    } satisfies InfoCardContent);
    await fixture.whenStable();
    expect(element.querySelector('h2')?.textContent).toBe('sense filtrar');
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('article')?.getAttribute('data-colour')).toBe('green');
  });
});
