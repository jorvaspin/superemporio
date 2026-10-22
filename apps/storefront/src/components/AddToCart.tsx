import type { CatalogProduct, CatalogVariant } from '@superemporio/domain';
import { addToCart } from '../lib/cart';

export default function AddToCart({ product, variant, full = false }: { product: Pick<CatalogProduct, 'id' | 'slug' | 'name' | 'brand' | 'emoji' | 'image'>; variant: CatalogVariant; full?: boolean }) {
  return <button className={`button ${full ? 'button--full' : ''}`} onClick={() => addToCart(product, variant)} disabled={variant.stock === 0}>{variant.stock ? <>Agregar <span aria-hidden="true">＋</span></> : 'Sin stock'}</button>;
}
