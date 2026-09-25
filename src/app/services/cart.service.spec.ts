import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAX_CART_QUANTITY } from '../models/cart.interface';
import { ProductService } from './product.service';
import { CART_STORAGE_KEY, CartService } from './cart.service';

describe('CartService', () => {
  const first = 'orange-spritz';
  const second = 'passion-hugo';
  let stored: Map<string, string>;
  let storage: Storage;

  beforeEach(() => {
    stored = new Map();
    storage = {
      get length() { return stored.size; },
      clear: vi.fn(() => stored.clear()),
      key: vi.fn((index: number) => [...stored.keys()][index] ?? null),
      getItem: vi.fn((key: string) => stored.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { stored.set(key, value); }),
      removeItem: vi.fn((key: string) => { stored.delete(key); }),
    };
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage);
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function restore(value: unknown): CartService {
    stored.set(CART_STORAGE_KEY, JSON.stringify(value));
    return TestBed.inject(CartService);
  }

  it('starts empty without overwriting missing storage', () => {
    const cart = TestBed.inject(CartService);
    expect(cart.entries()).toEqual([]);
    expect(cart.items()).toEqual([]);
    expect(cart.totalQuantity()).toBe(0);
    expect(cart.subtotalCents()).toBe(0);
    expect(cart.isEmpty()).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('adds products, merges repeated additions, and derives display data from the catalogue', () => {
    const cart = TestBed.inject(CartService);
    expect(cart.addItem(first)).toBe(true);
    expect(cart.addItem(first, 2)).toBe(true);
    expect(cart.addItem(second, 2)).toBe(true);
    expect(cart.entries()).toEqual([{ productId: first, quantity: 3 }, { productId: second, quantity: 2 }]);
    expect(cart.items()[0].product).toBe(TestBed.inject(ProductService).products[0]);
    expect(cart.totalQuantity()).toBe(5);
    expect(cart.subtotalCents()).toBe(18000);
    expect(cart.isEmpty()).toBe(false);
  });

  it('rejects repeated additions and increases that would exceed the maximum', () => {
    const cart = TestBed.inject(CartService);
    cart.addItem(first, MAX_CART_QUANTITY - 1);
    expect(cart.addItem(first, 2)).toBe(false);
    expect(cart.increaseQuantity(first)).toBe(true);
    expect(cart.increaseQuantity(first)).toBe(false);
    expect(cart.addItem(first)).toBe(false);
    expect(cart.totalQuantity()).toBe(MAX_CART_QUANTITY);
  });

  it('increases, decreases and sets quantity; decreasing one removes the item and persistence', () => {
    const cart = TestBed.inject(CartService);
    expect(cart.setQuantity(first, 3)).toBe(false);
    expect(cart.increaseQuantity(first)).toBe(false);
    expect(cart.decreaseQuantity(first)).toBe(false);
    cart.addItem(first);
    expect(cart.increaseQuantity(first)).toBe(true);
    expect(cart.totalQuantity()).toBe(2);
    expect(cart.setQuantity(first, 4)).toBe(true);
    expect(cart.decreaseQuantity(first)).toBe(true);
    expect(cart.totalQuantity()).toBe(3);
    cart.setQuantity(first, 1);
    expect(cart.decreaseQuantity(first)).toBe(true);
    expect(cart.totalQuantity()).toBe(0);
    expect(cart.subtotalCents()).toBe(0);
    expect(cart.isEmpty()).toBe(true);
    expect(stored.has(CART_STORAGE_KEY)).toBe(false);
  });

  it('removes items and clears only the cart storage key', () => {
    stored.set('unrelated', 'keep');
    const cart = TestBed.inject(CartService);
    cart.addItem(first);
    cart.addItem(second);
    cart.removeItem(first);
    cart.removeItem('unknown');
    expect(cart.entries()).toEqual([{ productId: second, quantity: 1 }]);
    cart.clearCart();
    expect(cart.entries()).toEqual([]);
    expect(stored.has(CART_STORAGE_KEY)).toBe(false);
    expect(stored.get('unrelated')).toBe('keep');
    expect(storage.clear).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -Infinity, 0, -1, 1.5, MAX_CART_QUANTITY + 1])('rejects invalid operation quantity %s', quantity => {
    const cart = TestBed.inject(CartService);
    expect(cart.addItem(first, quantity)).toBe(false);
    cart.addItem(first, 2);
    expect(cart.setQuantity(first, quantity)).toBe(false);
    expect(cart.addItem(first, quantity)).toBe(false);
    expect(cart.totalQuantity()).toBe(2);
  });

  it('rejects unknown products', () => {
    const cart = TestBed.inject(CartService);
    expect(cart.addItem('unknown')).toBe(false);
    expect(cart.setQuantity('unknown', 2)).toBe(false);
    expect(cart.entries()).toEqual([]);
  });

  it('persists and exports only product IDs and quantities', () => {
    const cart = TestBed.inject(CartService);
    cart.addItem(first, 2);
    expect(JSON.parse(stored.get(CART_STORAGE_KEY)!)).toEqual([{ productId: first, quantity: 2 }]);
    const payload = cart.getPayload();
    expect(payload).toEqual({ items: [{ productId: first, quantity: 2 }] });
    payload.items.length = 0;
    expect(cart.totalQuantity()).toBe(2);
    expect(Object.isFrozen(cart.entries())).toBe(true);
    expect(Object.isFrozen(cart.entries()[0])).toBe(true);
  });

  it('restores valid entries before writing and strips untrusted extra data', () => {
    const cart = restore([{ productId: first, quantity: 2, price: 0.01, name: 'fake', email: 'not persisted' }]);
    expect(cart.totalQuantity()).toBe(2);
    expect(cart.subtotalCents()).toBe(7200);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(CART_STORAGE_KEY, JSON.stringify([{ productId: first, quantity: 2 }]));
  });

  it.each(['{bad', '[NaN]', '[Infinity]', ' '.repeat(65537)])('handles malformed or oversized input %#', raw => {
    stored.set(CART_STORAGE_KEY, raw);
    expect(TestBed.inject(CartService).entries()).toEqual([]);
    expect(stored.has(CART_STORAGE_KEY)).toBe(false);
  });

  it.each([null, {}, { items: [] }, 'cart', 42, true])('rejects unexpected top-level JSON %#', value => {
    expect(restore(value).entries()).toEqual([]);
    expect(stored.has(CART_STORAGE_KEY)).toBe(false);
  });

  it('drops malformed entries while retaining valid entries', () => {
    const cart = restore([
      null, [], 'item', {}, { productId: first }, { quantity: 2 },
      { productId: 1, quantity: 2 }, { productId: first, quantity: '2' },
      { productId: first, quantity: null }, { productId: first, quantity: true },
      ...[0, -1, 1.5, MAX_CART_QUANTITY + 1].map(quantity => ({ productId: first, quantity })),
      { productId: 'stale', quantity: 2 }, { productId: second, quantity: 3 },
    ]);
    expect(cart.entries()).toEqual([{ productId: second, quantity: 3 }]);
  });

  it('rejects a finite-JSON literal that parses as infinity', () => {
    stored.set(CART_STORAGE_KEY, `[{"productId":"${first}","quantity":1e400}]`);
    expect(TestBed.inject(CartService).entries()).toEqual([]);
  });

  it('merges valid duplicates in first-seen order, capped at the limit', () => {
    const cart = restore([
      { productId: second, quantity: 2 }, { productId: first, quantity: 20 },
      { productId: second, quantity: 3 }, { productId: first, quantity: 20 },
      { productId: second, quantity: -1 },
    ]);
    const expected = [{ productId: second, quantity: 5 }, { productId: first, quantity: MAX_CART_QUANTITY }];
    expect(cart.entries()).toEqual(expected);
    expect(JSON.parse(stored.get(CART_STORAGE_KEY)!)).toEqual(expected);
  });

  it('survives storage being unavailable or its getter throwing', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    const cart = TestBed.inject(CartService);
    expect(cart.addItem(first, 2)).toBe(true);
    expect(cart.totalQuantity()).toBe(2);
    expect(() => cart.clearCart()).not.toThrow();
  });

  it('does not access browser storage on the server', () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('no browser'); });
    const cart = TestBed.inject(CartService);
    cart.addItem(first);
    cart.clearCart();
    expect(getter).not.toHaveBeenCalled();
  });

  it('does not overwrite unread storage when getItem fails', () => {
    vi.mocked(storage.getItem).mockImplementation(() => { throw new Error('read failed'); });
    const cart = TestBed.inject(CartService);
    expect(cart.entries()).toEqual([]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(cart.addItem(first)).toBe(true);
  });

  it('keeps memory state when setItem or removeItem fails', () => {
    vi.mocked(storage.setItem).mockImplementation(() => { throw new Error('quota'); });
    vi.mocked(storage.removeItem).mockImplementation(() => { throw new Error('blocked'); });
    const cart = TestBed.inject(CartService);
    expect(() => cart.addItem(first)).not.toThrow();
    expect(cart.totalQuantity()).toBe(1);
    expect(() => cart.clearCart()).not.toThrow();
    expect(cart.isEmpty()).toBe(true);
  });

  it.each([undefined, NaN, Infinity, -1])('does not present invalid catalogue prices as free: %s', price => {
    const product = { ...new ProductService().products[0], price };
    TestBed.overrideProvider(ProductService, { useValue: { products: [product] } });
    const cart = TestBed.inject(CartService);
    cart.addItem(product.id);
    expect(cart.subtotalCents()).toBeNull();
  });

  it('calculates decimal display prices in cents', () => {
    const products = new ProductService().products.slice(0, 2).map((product, index) => ({ ...product, price: index ? 0.2 : 0.1 }));
    TestBed.overrideProvider(ProductService, { useValue: { products } });
    const cart = TestBed.inject(CartService);
    cart.addItem(first);
    cart.addItem(second);
    expect(cart.subtotalCents()).toBe(30);
  });
});
