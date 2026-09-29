import { Component, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CartDrawerService } from '../../../../services/cart-drawer.service';
import { Navbar } from '../navbar/navbar';
import { CartService } from '../../../../services/cart.service';
import { Modal } from '../../modal/modal';
import { Cart } from '../../../../features/components/cart/cart';

@Component({
  selector: 'app-header',
  imports: [Navbar, Modal, Cart],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly totalQuantity = inject(CartService).totalQuantity;
  private readonly drawer = viewChild<Modal>('cartDrawer');

  constructor() {
    inject(CartDrawerService).openRequested.pipe(takeUntilDestroyed()).subscribe(() => this.drawer()?.open());
  }
}
