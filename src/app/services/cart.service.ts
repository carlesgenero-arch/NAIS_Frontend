import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { CartEntry, MAX_CART_QUANTITY } from '../models/cart.interface';
import { CartItem } from '../models/product.interface';
import { ProductService } from './product.service';

export const CART_STORAGE_KEY = 'nais.cart.v1';
const MAX_STORED_CART_LENGTH = 64 * 1024;

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly catalogue = inject(ProductService).products;
  private readonly storage = this.getStorage(inject(PLATFORM_ID));
  private readonly state = signal<readonly CartEntry[]>(Object.freeze([]));

  readonly entries = this.state.asReadonly();
  readonly items = computed<readonly Readonly<CartItem>[]>(() => this.entries().flatMap(entry => {
    const product = this.catalogue.find(candidate => candidate.id === entry.productId);
    return product ? [{ product, quantity: entry.quantity }] : [];
  }));
  readonly totalQuantity = computed(() => this.entries().reduce((sum, entry) => sum + entry.quantity, 0));
  readonly isEmpty = computed(() => this.entries().length === 0);

  /** Display only. Null means a catalogue price is missing or invalid, never a free item. */
  readonly subtotalCents = computed<number | null>(() => {
    let total = 0;
    for (const { product, quantity } of this.items()) {
      const price = product.price;
      if (price === undefined || !Number.isFinite(price) || price < 0) return null;
      const cents = Math.round(price * 100);
      total += cents * quantity;
      if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(total)) return null;
    }
    return total;
  });

  constructor() {
    this.restore();
  }

  /** False means validation failed; state is unchanged. */
  addItem(productId: string, quantity = 1): boolean {
    if (!this.hasProduct(productId) || !this.isQuantity(quantity)) return false;
    const current = this.entries().find(entry => entry.productId === productId);
    if (current) return this.setQuantity(productId, current.quantity + quantity);
    this.commit([...this.entries(), { productId, quantity }]);
    return true;
  }

  removeItem(productId: string): void {
    this.commit(this.entries().filter(entry => entry.productId !== productId));
  }

  increaseQuantity(productId: string): boolean {
    const current = this.entries().find(entry => entry.productId === productId);
    return current ? this.setQuantity(productId, current.quantity + 1) : false;
  }

  /** Decreasing the last pack removes the entry, never storing a zero quantity. */
  decreaseQuantity(productId: string): boolean {
    const current = this.entries().find(entry => entry.productId === productId);
    if (!current) return false;
    if (current.quantity === 1) {
      this.removeItem(productId);
      return true;
    }
    return this.setQuantity(productId, current.quantity - 1);
  }

  setQuantity(productId: string, quantity: number): boolean {
    if (!this.hasProduct(productId) || !this.isQuantity(quantity)
      || !this.entries().some(entry => entry.productId === productId)) return false;
    this.commit(this.entries().map(entry => entry.productId === productId ? { productId, quantity } : entry));
    return true;
  }

  clearCart(): void {
    this.commit([]);
  }

  /** A future server must independently validate these IDs and quantities and calculate prices. */
  getPayload(): { items: CartEntry[] } {
    return { items: this.entries().map(entry => ({ ...entry })) };
  }

  private hasProduct(productId: unknown): productId is string {
    return typeof productId === 'string' && this.catalogue.some(product => product.id === productId);
  }

  private isQuantity(quantity: unknown): quantity is number {
    return typeof quantity === 'number' && Number.isInteger(quantity)
      && quantity >= 1 && quantity <= MAX_CART_QUANTITY;
  }

  private getStorage(platformId: object): Storage | null {
    if (!isPlatformBrowser(platformId)) return null;
    try {
      return typeof window === 'undefined' ? null : window.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private restore(): void {
    let raw: string | null;
    try {
      raw = this.storage?.getItem(CART_STORAGE_KEY) ?? null;
    } catch {
      // A failed read is not proof of corruption. Do not overwrite unread data.
      return;
    }
    if (raw === null) return;
    let parsed: unknown;
    try {
      parsed = raw.length <= MAX_STORED_CART_LENGTH ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    const quantities = new Map<string, number>();
    if (Array.isArray(parsed)) {
      for (const value of parsed) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
        const candidate = value as Record<string, unknown>;
        const productId = candidate['productId'];
        const quantity = candidate['quantity'];
        if (!this.hasProduct(productId) || !this.isQuantity(quantity)) continue;
        // Valid duplicates merge in first-occurrence order, capped at the per-product limit.
        quantities.set(productId, Math.min(MAX_CART_QUANTITY, (quantities.get(productId) ?? 0) + quantity));
      }
    }
    this.commit(Array.from(quantities, ([productId, quantity]) => ({ productId, quantity })));
  }

  private commit(entries: readonly CartEntry[]): void {
    const canonical = Object.freeze(entries.map(({ productId, quantity }) => Object.freeze({ productId, quantity })));
    this.state.set(canonical);
    try {
      if (canonical.length) this.storage?.setItem(CART_STORAGE_KEY, JSON.stringify(canonical));
      else this.storage?.removeItem(CART_STORAGE_KEY);
    } catch {
      // Persistence is optional: keep the valid in-memory state when storage is blocked or full.
    }
  }
}
