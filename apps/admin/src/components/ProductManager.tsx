import { useEffect, useState, type SyntheticEvent } from 'react';
import { restoreAdminToken } from './adminSession';
import { AdminModal } from './AdminModal';

type Category = { id: string; name: string; active: boolean };
type Variant = { id?: string; sku: string; barcode?: string | null; label: string; unit_count: number; price_clp: number; compare_at_price_clp: number | null; active: boolean; inventory?: { available_quantity: number; low_stock_threshold: number }[] };
type ProductImage = { id: string; storage_path: string; alt_text: string; position: number };
type Product = { id: string; name: string; slug: string; brand: string; description: string; status: 'draft' | 'active' | 'archived'; seo_title: string | null; seo_description: string | null; product_categories: { category_id: string }[]; product_variants: Variant[]; product_images: ProductImage[] };
type VariantForm = { id?: string; sku: string; label: string; unitCount: number; priceClp: number; compareAtPriceClp: string; active: boolean; availableQuantity: number; lowStockThreshold: number };
type ProductForm = { id?: string; name: string; slug: string; brand: string; description: string; status: Product['status']; categoryIds: string[]; variants: VariantForm[] };

const blankVariant = (): VariantForm => ({ sku: '', label: 'Unidad', unitCount: 1, priceClp: 0, compareAtPriceClp: '', active: true, availableQuantity: 0, lowStockThreshold: 5 });
const blankProduct = (): ProductForm => ({ name: '', slug: '', brand: '', description: '', status: 'draft', categoryIds: [], variants: [blankVariant()] });
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const fallbackArt = (product: Product) => {
  const value = `${product.name} ${product.brand}`.toLowerCase();
  if (value.includes('papel') || value.includes('servilleta')) return '🧻';
  if (value.includes('quix') || value.includes('lavaloza')) return '🍋';
  if (value.includes('detergente') || value.includes('limpiador')) return '🧼';
  if (value.includes('esponja')) return '🧽';
  if (value.includes('bolsa')) return '🗑️';
  if (value.includes('dental')) return '🪥';
  if (value.includes('shampoo') || value.includes('jabón') || value.includes('jabon')) return '🧴';
  if (value.includes('toalla húmeda')) return '💧';
  return '📦';
};

export function ProductManager({ apiUrl, storeUrl }: { apiUrl: string; storeUrl: string }) {
  const [token, setToken] = useState(''); const [products, setProducts] = useState<Product[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [form, setForm] = useState<ProductForm | null>(null); const [message, setMessage] = useState('Verificando catálogo…'); const [busy, setBusy] = useState(false); const [showArchived, setShowArchived] = useState(false);

  const request = async <T,>(path: string, accessToken: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiUrl}${path}`, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? 'No fue posible completar la solicitud.');
    return payload;
  };
  const load = async (accessToken: string) => {
    const [productResponse, categoryResponse] = await Promise.all([request<{ data: Product[] }>('/admin/products', accessToken), request<{ data: Category[] }>('/admin/categories', accessToken)]);
    setProducts(productResponse.data); setCategories(categoryResponse.data.filter((category) => category.active));
  };
  useEffect(() => { restoreAdminToken().then(async (saved) => { setToken(saved); try { await load(saved); setMessage('Sesión activa. Los cambios se guardan en Supabase.'); } catch { setMessage('No fue posible conectar con la API. Verifica que esté levantada en el puerto 8787.'); } }).catch(() => { window.location.assign('/login'); }); }, []);
  const edit = (product: Product) => setForm({ id: product.id, name: product.name, slug: product.slug, brand: product.brand ?? '', description: product.description, status: product.status, categoryIds: product.product_categories.map((item) => item.category_id), variants: product.product_variants.map((variant) => ({ id: variant.id, sku: variant.sku, label: variant.label, unitCount: variant.unit_count, priceClp: variant.price_clp, compareAtPriceClp: variant.compare_at_price_clp?.toString() ?? '', active: variant.active, availableQuantity: variant.inventory?.[0]?.available_quantity ?? 0, lowStockThreshold: variant.inventory?.[0]?.low_stock_threshold ?? 5 })) });
  const updateVariant = (index: number, update: Partial<VariantForm>) => setForm((current) => current ? { ...current, variants: current.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...update } : variant) } : current);
  const save = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!token || !form) return; setBusy(true); setMessage('Guardando producto…');
    const payload = { ...form, variants: form.variants.map((variant) => ({ ...variant, compareAtPriceClp: variant.compareAtPriceClp ? Number(variant.compareAtPriceClp) : null })) };
    try { await request(`/admin/products${form.id ? `/${form.id}` : ''}`, token, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(payload) }); await load(token); setForm(null); setMessage('Producto guardado correctamente.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el producto.'); } finally { setBusy(false); }
  };
  const archive = async (product: Product) => {
    if (!token || !window.confirm(`¿Archivar “${product.name}”?\n\nDejará de aparecer en la tienda, pero sus ventas, inventario e historial se conservarán.`)) return;
    setBusy(true); setMessage(`Archivando ${product.name}…`);
    try { await request(`/admin/products/${product.id}`, token, { method: 'DELETE' }); await load(token); setMessage('Producto archivado. No se eliminó ningún dato histórico.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo archivar el producto.'); }
    finally { setBusy(false); }
  };
  const imageUrl = (product: Product) => {
    const path = [...(product.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path;
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${storeUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  };

  if (!token) return <section className="panel"><h2>Verificando acceso…</h2><p className="campaign-help">Estamos validando tu sesión protegida.</p></section>;

  const archivedCount = products.filter((product) => product.status === 'archived').length;
  const visibleProducts = products.filter((product) => showArchived || product.status !== 'archived');
  const statusName: Record<Product['status'], string> = { active: 'Activo', draft: 'Borrador', archived: 'Archivado' };
  return <><section className="panel product-catalog"><div className="panel-head"><div><h2>Catálogo de productos</h2><p className="campaign-help">Revisa su imagen, variantes y publicación. Archivar nunca borra ventas ni relaciones.</p></div><div className="product-catalog__tools">{archivedCount > 0 && <button className="admin-button admin-button--soft" type="button" onClick={() => setShowArchived((current) => !current)}>{showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedCount})`}</button>}<button className="admin-button" onClick={() => setForm(blankProduct())}>+ Nuevo producto</button></div></div><div className="table-scroll"><table className="product-table"><thead><tr><th>Imagen</th><th>Producto</th><th>Variantes</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visibleProducts.map((product) => { const thumbnail = imageUrl(product); return <tr key={product.id} data-archived={product.status === 'archived'}><td><div className="product-table__image">{thumbnail ? <img src={thumbnail} alt={product.product_images?.[0]?.alt_text || product.name} /> : <span aria-hidden="true">{fallbackArt(product)}</span>}</div></td><td><strong>{product.name}</strong><small>{product.brand || 'Sin marca'} · {product.slug}</small></td><td><strong>{product.product_variants.length}</strong><small>{product.product_variants.filter((variant) => variant.active).length} activas</small></td><td><span className="status" data-product-status={product.status}>{statusName[product.status]}</span></td><td><div className="product-table__actions"><button className="admin-button admin-button--soft" type="button" onClick={() => edit(product)}>Editar</button>{product.status !== 'archived' && <button className="admin-button admin-button--danger-soft" type="button" disabled={busy} onClick={() => void archive(product)}>Archivar</button>}</div></td></tr>; })}{!visibleProducts.length && <tr><td colSpan={5}><div className="dashboard-empty"><span>📦</span><strong>Aún no hay productos</strong><p>Crea el primero para comenzar a completar el catálogo.</p></div></td></tr>}</tbody></table></div></section>{form && <AdminModal title={form.id ? 'Editar producto' : 'Nuevo producto'} description="Completa la información comercial, categorías y variantes del producto." size="large" closeDisabled={busy} onClose={() => setForm(null)}><form className="product-form" onSubmit={save}><label>Nombre<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: form.id ? form.slug : slugify(event.target.value) })} required /></label><label>Slug<input value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} required /></label><label>Marca<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label><label>Estado<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Product['status'] })}><option value="draft">Borrador</option><option value="active">Activo</option><option value="archived">Archivado</option></select></label><label className="product-form__full">Descripción<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required minLength={10} /></label><fieldset className="product-form__full"><legend>Categorías</legend>{categories.map((category) => <label className="choice" key={category.id}><input type="checkbox" checked={form.categoryIds.includes(category.id)} onChange={(event) => setForm({ ...form, categoryIds: event.target.checked ? [...form.categoryIds, category.id] : form.categoryIds.filter((id) => id !== category.id) })} /> {category.name}</label>)}</fieldset><div className="product-form__full"><div className="panel-head"><h3>Variantes</h3><button className="admin-button admin-button--soft" type="button" onClick={() => setForm({ ...form, variants: [...form.variants, blankVariant()] })}>+ Variante</button></div>{form.variants.map((variant, index) => <fieldset className="variant-editor" key={variant.id ?? index}><legend>Variante {index + 1}</legend><label>SKU<input value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} required /></label><label>Formato<input value={variant.label} onChange={(event) => updateVariant(index, { label: event.target.value })} required /></label><label>Unidades<input type="number" min="1" value={variant.unitCount} onChange={(event) => updateVariant(index, { unitCount: Number(event.target.value) })} required /></label><label>Precio CLP<input type="number" min="0" value={variant.priceClp} onChange={(event) => updateVariant(index, { priceClp: Number(event.target.value) })} required /></label><label>Precio anterior<input type="number" min="0" value={variant.compareAtPriceClp} onChange={(event) => updateVariant(index, { compareAtPriceClp: event.target.value })} /></label>{!variant.id && <label>Stock inicial<input type="number" min="0" value={variant.availableQuantity} onChange={(event) => updateVariant(index, { availableQuantity: Number(event.target.value) })} /></label>}<label className="choice"><input type="checkbox" checked={variant.active} onChange={(event) => updateVariant(index, { active: event.target.checked })} /> Activa</label>{form.variants.length > 1 && <button className="text-button" type="button" onClick={() => setForm({ ...form, variants: form.variants.filter((_, variantIndex) => variantIndex !== index) })}>Quitar variante</button>}</fieldset>)}</div><div className="modal-actions product-form__full"><button className="admin-button admin-button--soft" type="button" onClick={() => setForm(null)} disabled={busy}>Cancelar</button><button className="admin-button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar producto'}</button></div></form></AdminModal>}<p className="campaign-message" role="status">{message}</p></>;
}
