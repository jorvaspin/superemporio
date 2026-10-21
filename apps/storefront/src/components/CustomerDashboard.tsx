import { useEffect, useState, type ComponentProps } from 'react';
import { formatCLP } from '@superemporio/domain';
import { saveCustomerSession, type CustomerSession } from '../lib/customerSession';

type SubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0];
type Tab = 'summary' | 'orders' | 'addresses' | 'profile';
type Profile = { id: string; first_name: string | null; last_name: string | null; phone: string | null; marketing_opt_in: boolean };
type Address = { id: string; label: string; region: string; commune: string; street: string; address_detail: string | null; reference: string | null; is_default: boolean };
type OrderItem = { quantity: number; product_name_snapshot: string; variant_label_snapshot: string };
type Order = { id: string; public_code: string; order_status: string; payment_status: string; fulfillment_status: string; fulfillment_method: string; coupon_code: string | null; subtotal_clp: number; discount_clp: number; shipping_clp: number; grand_total_clp: number; created_at: string; order_items: OrderItem[] };
type Overview = { user: CustomerSession['user']; profile: Profile; addresses: Address[]; orders: Order[] };
type Props = { apiUrl: string; session: CustomerSession; onSignOut: () => void };

const orderLabels: Record<string, string> = {
  draft: 'Borrador', pending_payment: 'Esperando pago', pending_manual: 'Por confirmar', confirmed: 'Confirmado',
  preparing: 'Preparando', ready: 'Listo para entregar', dispatched: 'En camino', completed: 'Completado',
  cancelled: 'Cancelado', expired: 'Vencido',
};
const paymentLabels: Record<string, string> = { unpaid: 'Pendiente', pending: 'Procesando', paid: 'Pagado', failed: 'Fallido', refunded: 'Reembolsado', partially_refunded: 'Reembolso parcial' };

export default function CustomerDashboard({ apiUrl, session, onSignOut }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [editingAddress, setEditingAddress] = useState<Partial<Address> | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function request<T>(path: string, init?: RequestInit) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}`, ...(init?.headers ?? {}) },
    });
    if (response.status === 401) { onSignOut(); throw new Error('Tu sesión venció. Ingresa nuevamente.'); }
    if (!response.ok) throw new Error('No pudimos guardar los cambios. Intenta nuevamente.');
    if (response.status === 204) return null as T;
    const payload = await response.json() as { data: T };
    return payload.data;
  }

  async function load() {
    try { setOverview(await request<Overview>('/account/overview')); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'No pudimos cargar tu cuenta.'); }
  }

  useEffect(() => { void load(); }, [session.accessToken]);

  async function saveProfile(event: SubmitEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const profile = await request<Profile>('/account/profile', { method: 'PUT', body: JSON.stringify({
        firstName: form.get('firstName'), lastName: form.get('lastName'), phone: String(form.get('phone') ?? '').trim() || null,
        marketingOptIn: form.get('marketingOptIn') === 'on',
      }) });
      setOverview((current) => current ? { ...current, profile } : current);
      saveCustomerSession({ ...session, user: { ...session.user, firstName: profile.first_name } });
      setNotice('Tus datos se guardaron correctamente.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No pudimos guardar tus datos.'); }
    finally { setBusy(false); }
  }

  async function saveAddress(event: SubmitEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    const form = new FormData(event.currentTarget); const id = editingAddress?.id;
    try {
      await request(`/account/addresses${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify({
        label: form.get('label'), region: form.get('region'), commune: form.get('commune'), street: form.get('street'),
        addressDetail: String(form.get('addressDetail') ?? '').trim() || null,
        reference: String(form.get('reference') ?? '').trim() || null,
        isDefault: form.get('isDefault') === 'on',
      }) });
      setEditingAddress(null); await load(); setNotice(id ? 'Dirección actualizada.' : 'Dirección agregada.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No pudimos guardar la dirección.'); }
    finally { setBusy(false); }
  }

  async function removeAddress(address: Address) {
    if (!window.confirm(`¿Eliminar la dirección “${address.label}”?`)) return;
    setBusy(true); setNotice('');
    try { await request(`/account/addresses/${address.id}`, { method: 'DELETE' }); await load(); setNotice('Dirección eliminada.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'No pudimos eliminar la dirección.'); }
    finally { setBusy(false); }
  }

  if (!overview) return <section className="customer-dashboard customer-dashboard--loading" aria-live="polite"><span className="account-loader"></span><strong>Cargando tu cuenta…</strong>{notice && <p>{notice}</p>}</section>;
  const name = overview.profile.first_name || session.user.firstName || '';
  const recentOrder = overview.orders[0];

  return <section className="customer-dashboard">
    <header className="customer-dashboard__header">
      <div><span className="account-card__eyebrow">MI SUPEREMPORIO</span><h1>{name ? `Hola, ${name}` : 'Hola'}</h1><p>Administra tus compras y datos desde un solo lugar.</p></div>
      <button className="account-text-button" type="button" onClick={onSignOut}>Cerrar sesión</button>
    </header>
    <div className="customer-dashboard__body">
      <nav className="customer-dashboard__nav" aria-label="Secciones de tu cuenta">
        <button data-active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}><span>⌂</span> Resumen</button>
        <button data-active={activeTab === 'orders'} onClick={() => setActiveTab('orders')}><span>▤</span> Mis pedidos <b>{overview.orders.length}</b></button>
        <button data-active={activeTab === 'addresses'} onClick={() => setActiveTab('addresses')}><span>⌖</span> Direcciones <b>{overview.addresses.length}</b></button>
        <button data-active={activeTab === 'profile'} onClick={() => setActiveTab('profile')}><span>○</span> Mis datos</button>
      </nav>
      <div className="customer-dashboard__content">
        {notice && <p className="account-notice account-notice--success" role="status">{notice}</p>}
        {activeTab === 'summary' && <div>
          <div className="dashboard-title"><div><span>RESUMEN</span><h2>Tu cuenta al día</h2></div><a href="/catalogo">Seguir comprando →</a></div>
          <div className="dashboard-stats">
            <article><i>▤</i><div><strong>{overview.orders.length}</strong><span>Pedidos realizados</span></div></article>
            <article><i>⌖</i><div><strong>{overview.addresses.length}</strong><span>Direcciones guardadas</span></div></article>
            <article><i>✓</i><div><strong>{overview.profile.phone ? 'Completo' : 'Pendiente'}</strong><span>Estado de tus datos</span></div></article>
          </div>
          <section className="dashboard-panel">
            <div className="dashboard-panel__head"><h3>Pedido más reciente</h3>{overview.orders.length > 0 && <button onClick={() => setActiveTab('orders')}>Ver todos</button>}</div>
            {recentOrder ? <OrderRow order={recentOrder} /> : <EmptyState icon="🛒" title="Aún no tienes pedidos" text="Cuando realices tu primera compra aparecerá aquí." action="Explorar productos" href="/catalogo" />}
          </section>
        </div>}
        {activeTab === 'orders' && <div>
          <div className="dashboard-title"><div><span>COMPRAS</span><h2>Mis pedidos</h2></div><a href="/catalogo">Comprar nuevamente →</a></div>
          <div className="account-order-list">{overview.orders.map((order) => <OrderRow key={order.id} order={order} />)}{!overview.orders.length && <EmptyState icon="🛍️" title="Todavía no hay pedidos" text="Tus compras y su estado se mostrarán en esta sección." action="Ir al catálogo" href="/catalogo" />}</div>
        </div>}
        {activeTab === 'addresses' && <div>
          <div className="dashboard-title"><div><span>DESPACHO</span><h2>Mis direcciones</h2></div><button className="button dashboard-add" onClick={() => setEditingAddress({ is_default: !overview.addresses.length, region: 'Metropolitana de Santiago' })}>+ Agregar dirección</button></div>
          <div className="address-grid">{overview.addresses.map((address) => <article className="address-card" key={address.id}>
            <div className="address-card__head"><span aria-hidden="true">⌖</span><div><strong>{address.label}</strong>{address.is_default && <small>Principal</small>}</div></div>
            <p>{address.street}{address.address_detail ? `, ${address.address_detail}` : ''}<br />{address.commune}, {address.region}</p>
            {address.reference && <em>{address.reference}</em>}
            <div><button onClick={() => setEditingAddress(address)}>Editar</button><button onClick={() => void removeAddress(address)} disabled={busy}>Eliminar</button></div>
          </article>)}{!overview.addresses.length && <EmptyState icon="📍" title="Guarda tu primera dirección" text="La tendrás disponible para completar tus próximas compras." action="Agregar dirección" onAction={() => setEditingAddress({ is_default: true, region: 'Metropolitana de Santiago' })} />}</div>
        </div>}
        {activeTab === 'profile' && <div>
          <div className="dashboard-title"><div><span>INFORMACIÓN PERSONAL</span><h2>Mis datos</h2></div></div>
          <form className="profile-form" onSubmit={saveProfile}>
            <div className="account-form__names"><label>Nombre<input name="firstName" defaultValue={overview.profile.first_name ?? ''} required minLength={2} /></label><label>Apellido<input name="lastName" defaultValue={overview.profile.last_name ?? ''} required minLength={2} /></label></div>
            <label>Correo electrónico<input value={session.user.email ?? ''} disabled /><small>El correo identifica tu cuenta y no puede modificarse aquí.</small></label>
            <label>Teléfono<input name="phone" type="tel" defaultValue={overview.profile.phone ?? ''} placeholder="+56 9 1234 5678" /></label>
            <label className="profile-form__check"><input name="marketingOptIn" type="checkbox" defaultChecked={overview.profile.marketing_opt_in} /> Quiero recibir ofertas y novedades de Superemporio.</label>
            <button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
          </form>
        </div>}
      </div>
    </div>
    {editingAddress && <div className="account-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditingAddress(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
        <header><div><span>NUEVA DIRECCIÓN</span><h2 id="address-modal-title">{editingAddress.id ? 'Editar dirección' : 'Agregar dirección'}</h2></div><button type="button" onClick={() => setEditingAddress(null)} aria-label="Cerrar">×</button></header>
        <form className="address-form" onSubmit={saveAddress}>
          <div className="account-form__names"><label>Nombre de la dirección<input name="label" defaultValue={editingAddress.label ?? 'Casa'} required /></label><label>Comuna<input name="commune" defaultValue={editingAddress.commune ?? ''} placeholder="Ej: Providencia" required /></label></div>
          <label>Región<input name="region" defaultValue={editingAddress.region ?? 'Metropolitana de Santiago'} required /></label>
          <label>Calle y número<input name="street" defaultValue={editingAddress.street ?? ''} placeholder="Av. Siempre Viva 123" required /></label>
          <div className="account-form__names"><label>Departamento o casa<input name="addressDetail" defaultValue={editingAddress.address_detail ?? ''} placeholder="Opcional" /></label><label>Referencia<input name="reference" defaultValue={editingAddress.reference ?? ''} placeholder="Ej: portón azul" /></label></div>
          <label className="profile-form__check"><input name="isDefault" type="checkbox" defaultChecked={editingAddress.is_default} /> Usar como dirección principal</label>
          <footer><button className="button button--secondary" type="button" onClick={() => setEditingAddress(null)} disabled={busy}>Cancelar</button><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar dirección'}</button></footer>
        </form>
      </section>
    </div>}
  </section>;
}

function OrderRow({ order }: { order: Order }) {
  const itemCount = order.order_items.reduce((total, item) => total + item.quantity, 0);
  return <article className="account-order">
    <div className="account-order__icon" aria-hidden="true">▣</div>
    <div className="account-order__main"><span>Pedido {order.public_code}</span><strong>{itemCount} {itemCount === 1 ? 'producto' : 'productos'} · {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(order.created_at))}</strong><small>{order.fulfillment_method === 'delivery' ? 'Despacho local' : 'Retiro coordinado'}{order.coupon_code ? ` · Cupón ${order.coupon_code}` : ''}</small></div>
    <div className="account-order__status"><span data-status={order.order_status}>{orderLabels[order.order_status] ?? order.order_status}</span><small>Pago: {paymentLabels[order.payment_status] ?? order.payment_status}</small></div>
    <strong className="account-order__total">{formatCLP(order.grand_total_clp)}</strong>
  </article>;
}

function EmptyState({ icon, title, text, action, href, onAction }: { icon: string; title: string; text: string; action: string; href?: string; onAction?: () => void }) {
  return <div className="dashboard-empty"><span aria-hidden="true">{icon}</span><h3>{title}</h3><p>{text}</p>{href ? <a className="button" href={href}>{action}</a> : <button className="button" onClick={onAction}>{action}</button>}</div>;
}
