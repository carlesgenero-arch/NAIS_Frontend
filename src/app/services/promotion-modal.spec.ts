import { TestBed } from '@angular/core/testing';

import { PromotionModal } from './promotion-modal';

describe('PromotionModal', () => {
  let service: PromotionModal;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PromotionModal);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
