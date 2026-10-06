import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PromotionModal {
    private opener?: () => void;

  register(opener: () => void): void {
    this.opener = opener;
  }

  open(): void {
    this.opener?.();
  }
  
}
