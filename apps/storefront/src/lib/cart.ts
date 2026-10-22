import { atom, computed } from 'nanostores';
import type { CatalogProduct, CatalogVariant } from '@superemporio/domain';

export type CartLine = { variant: CatalogVariant; product: Pick<CatalogProduct, 'id' | 'slug' | 'name' | 'brand' | 'emoji' | 'image'>; quantity: number };
const stored = typeof window !== 'undefined' ? window.localStorage.getItem('superemporio-cart') : null;
export const $cart = atom<CartLine[]>(stored ? JSON.parse(stored) as CartLine[] : []);
export const $isCartOpen = atom(false);
export const $cartTotal = computed($cart, (lines) => lines.reduce((total, line) => total + line.variant.price * line.quantity, 0));
export const $cartCount = computed($cart, (lines) => lines.reduce((total, line) => total + line.quantity, 0));

if (typeof window !== 'undefined') $cart.subscribe((lines) => window.localStorage.setItem('superemporio-cart', JSON.stringify(lines)));
export function addToCart(product: CartLine['product'], variant: CatalogVariant) {
  $cart.set($cart.get().map((line) => line.variant.id === variant.id ? { ...line, quantity: Math.min(line.quantity + 1, variant.stock) } : line).concat(
    $cart.get().some((line) => line.variant.id === variant.id) ? [] : [{ product, variant, quantity: 1 }],
  ));
  $isCartOpen.set(true);
}
export function setQuantity(variantId: string, quantity: number) {
  $cart.set($cart.get().flatMap((line) => line.variant.id !== variantId ? [line] : quantity > 0 ? [{ ...line, quantity: Math.min(quantity, line.variant.stock) }] : []));
}
