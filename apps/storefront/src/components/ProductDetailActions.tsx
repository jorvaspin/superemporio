import { useState } from 'react';
import type { CatalogProduct } from '@superemporio/domain';
import { formatCLP } from '@superemporio/domain';
import { addToCart } from '../lib/cart';

export default function ProductDetailActions({ product }: { product: CatalogProduct }) {
  const [variantId, setVariantId] = useState(product.variants[0]!.id);
  const variant = product.variants.find((item) => item.id === variantId)!;
  return <><div className="variant-options" aria-label="Elige un formato">{product.variants.map((item) => <button className="variant-option" data-active={item.id === variantId} onClick={() => setVariantId(item.id)} key={item.id}><span><strong>{item.label}</strong><br /><span className="muted">{item.stock > 0 ? `${item.stock} disponibles` : 'Sin stock'}</span></span><strong>{formatCLP(item.price)}</strong></button>)}</div><div className="detail-actions"><button className="button" onClick={() => addToCart(product, variant)} disabled={!variant.stock}>Agregar al carrito <span aria-hidden="true">＋</span></button><a className="button button--secondary" href="/catalogo">Seguir comprando</a></div></>;
}
