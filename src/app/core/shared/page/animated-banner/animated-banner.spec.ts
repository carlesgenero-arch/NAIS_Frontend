import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnimatedBanner } from './animated-banner';

describe('AnimatedBanner', () => {
  let component: AnimatedBanner;
  let fixture: ComponentFixture<AnimatedBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimatedBanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnimatedBanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
