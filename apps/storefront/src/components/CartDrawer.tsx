import { useStore } from '@nanostores/react';
import { formatCLP } from '@superemporio/domain';
import { $cart, $cartTotal, $isCartOpen, setQuantity } from '../lib/cart';

export default function CartDrawer() {
  const open = useStore($isCartOpen); const lines = useStore($cart); const total = useStore($cartTotal);
  return <div className="cart-overlay" data-open={open} onMouseDown={(event) => { if (event.target === event.currentTarget) $isCartOpen.set(false); }}>
    <aside className="cart-drawer" aria-label="Carrito de compras" aria-modal="true" role="dialog">
      <div className="cart-head"><div><strong>Tu carrito</strong><div className="muted" style={{ fontSize: '.78rem' }}>{lines.length ? 'Revisa tus productos antes de pagar.' : 'Aún no agregas productos.'}</div></div><button className="icon-button" onClick={() => $isCartOpen.set(false)} aria-label="Cerrar carrito">×</button></div>
      <div className="cart-lines">{lines.length === 0 ? <p className="empty">Encuentra lo que necesitas y agrégalo aquí.</p> : lines.map((line) => <div className="cart-line" key={line.variant.id}>
        <div className="cart-emoji">{line.product.emoji}</div><div className="cart-line-info"><strong>{line.product.name}</strong><span className="muted">{line.variant.label}</span><div className="quantity"><button onClick={() => setQuantity(line.variant.id, line.quantity - 1)} aria-label="Quitar una unidad">−</button><span>{line.quantity}</span><button onClick={() => setQuantity(line.variant.id, line.quantity + 1)} aria-label="Agregar una unidad">+</button></div></div><strong>{formatCLP(line.variant.price * line.quantity)}</strong>
      </div>)}</div>
      <div className="cart-footer"><div className="cart-total"><span>Subtotal</span><strong>{formatCLP(total)}</strong></div><a className="button button--full" href="/checkout" onClick={() => $isCartOpen.set(false)}>Ir a pagar <span aria-hidden="true">→</span></a><a className="button button--secondary button--full" href="/carrito" onClick={() => $isCartOpen.set(false)} style={{ marginTop: '.6rem' }}>Ver carrito</a></div>
    </aside>
  </div>;
}
