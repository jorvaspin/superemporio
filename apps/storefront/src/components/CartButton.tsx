import { useStore } from '@nanostores/react';
import { $cartCount, $isCartOpen } from '../lib/cart';

export default function CartButton() {
  const count = useStore($cartCount);
  return <button className="icon-button" onClick={() => $isCartOpen.set(true)} aria-label={`Abrir carrito, ${count} productos`}>
    <span aria-hidden="true">🛒</span>{count > 0 && <span className="cart-count">{count}</span>}
  </button>;
}
