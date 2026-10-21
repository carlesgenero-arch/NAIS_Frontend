import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResponsiveImage } from './responsive-image.directive';
import { IMAGE_ASSETS } from './image-manifest';

@Component({imports:[ResponsiveImage],template:`<img responsiveImage [src]="source()" responsiveSizes="34px" width="34" height="34" alt="" loading="lazy">`})
class Host { readonly source=signal('images/brand/nais logos-10.png'); }

it('delivers static WebP candidates while preserving semantics, dimensions and loading policy',async()=>{
 const fixture=TestBed.createComponent(Host);await fixture.whenStable();
 const img=fixture.nativeElement.querySelector('img') as HTMLImageElement;
 expect(img.getAttribute('srcset')).toContain('images/optimized/brand/nais-logos-10-68.webp 68w');
 expect(img.getAttribute('sizes')).toBe('34px');
 expect(img.getAttribute('width')).toBe('34');expect(img.getAttribute('height')).toBe('34');
 expect(img.alt).toBe('');expect(img.getAttribute('loading')).toBe('lazy');
});

it.each(['/images/products/mocktails_3.png','images/products/mocktails_3.png'])('resolves only the exact asset path %s',async source=>{
 const fixture=TestBed.createComponent(Host);fixture.componentInstance.source.set(source);await fixture.whenStable();
 expect(fixture.nativeElement.querySelector('img').getAttribute('srcset')).toContain('images/optimized/products/mocktails_3-640.webp');
});

it.each(['images/uploads/products/id/new.png','https://cdn.example/images/products/mocktails_3.png','images/products/mocktails_3.png?v=2','images/products/%invalid.png'])('leaves uploaded, external, versioned and unknown sources untouched: %s',async source=>{
 const fixture=TestBed.createComponent(Host);await fixture.whenStable();
 fixture.componentInstance.source.set(source);await fixture.whenStable();
 const img=fixture.nativeElement.querySelector('img');
 expect(img.getAttribute('src')).toBe(source);expect(img.hasAttribute('srcset')).toBe(false);expect(img.hasAttribute('sizes')).toBe(false);
});

it('offers no upscaled candidates and retains alpha-capable WebP delivery',()=>{
 for (const asset of Object.values(IMAGE_ASSETS)) for(const variant of asset.variants){
  expect(variant.width).toBeLessThanOrEqual(asset.width);expect(variant.height).toBeLessThanOrEqual(asset.height);
  expect(variant.src).toMatch(/\.(webp|jpe?g|png)$/);
 }
});
