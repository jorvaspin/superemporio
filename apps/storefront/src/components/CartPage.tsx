import { useStore } from '@nanostores/react';
import { formatCLP } from '@superemporio/domain';
import { $cart, $cartTotal, setQuantity } from '../lib/cart';

export default function CartPage() {
  const lines = useStore($cart); const total = useStore($cartTotal);
  if (!lines.length) return <div className="checkout-card"><h2>Tu carrito está vacío</h2><p className="muted">Explora el catálogo para encontrar los esenciales de tu hogar.</p><a className="button" href="/catalogo">Ir al catálogo</a></div>;
  return <div className="checkout-grid"><section className="checkout-card"><h2>Productos en tu carrito</h2>{lines.map((line) => <div className="cart-line" key={line.variant.id}><div className="cart-emoji">{line.product.emoji}</div><div className="cart-line-info"><strong>{line.product.name}</strong><span className="muted">{line.variant.label}</span><div className="quantity"><button onClick={() => setQuantity(line.variant.id, line.quantity - 1)}>−</button><span>{line.quantity}</span><button onClick={() => setQuantity(line.variant.id, line.quantity + 1)}>+</button></div></div><strong>{formatCLP(line.quantity * line.variant.price)}</strong></div>)}</section><aside className="checkout-card"><h2>Resumen</h2><div className="summary-line"><span>Productos</span><span>{formatCLP(total)}</span></div><div className="summary-line"><span>Despacho</span><span>Se calcula al pagar</span></div><div className="summary-line summary-total"><span>Subtotal</span><span>{formatCLP(total)}</span></div><a href="/checkout" className="button button--full" style={{ marginTop: '1rem' }}>Continuar al pago</a></aside></div>;
}
