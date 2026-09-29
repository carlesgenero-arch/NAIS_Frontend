import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Opening requests only. Modal continues to own open/close state. */
@Injectable({ providedIn: 'root' })
export class CartDrawerService {
  private readonly requests = new Subject<void>();
  readonly openRequested = this.requests.asObservable();

  open(): void {
    this.requests.next();
  }
}
