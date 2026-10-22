import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { restoreAdminToken } from './adminSession';

type DailySale = { date: string; label: string; revenue: number; orders: number };
type StatusGroup = { key: string; label: string; count: number };
type Channel = { channel: string; count: number };
type RecentOrder = {
  id: string;
  public_code: string;
  channel: string;
  order_status: string;
  payment_status: string;
  contact_first_name: string;
  contact_last_name: string;
  grand_total_clp: number;
  created_at: string;
};
type DashboardData = {
  generatedAt: string;
  month: string;
  totals: {
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    ordersToday: number;
    paidOrdersMonth: number;
    averageTicketMonth: number;
    pendingOrders: number;
    discountsMonth: number;
    activeProducts: number;
    lowStock: number;
  };
  dailySales: DailySale[];
  statusGroups: StatusGroup[];
  channels: Channel[];
  recentOrders: RecentOrder[];
};

const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat('es-CL', { notation: 'compact', style: 'currency', currency: 'CLP', maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Santiago' });
const statusLabels: Record<string, string> = {
  draft: 'Borrador', pending_payment: 'Esperando pago', pending_manual: 'Por confirmar', confirmed: 'Confirmado',
  preparing: 'Preparando', ready: 'Listo', dispatched: 'En ruta', completed: 'Completado', cancelled: 'Cancelado', expired: 'Expirado',
};
const statusColors = ['#e6aa19', '#078b2f', '#2b6e49', '#111411', '#b9c5bb'];

function donutBackground(groups: StatusGroup[]) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  if (!total) return '#e8eee8';
  let cursor = 0;
  const stops = groups.map((group, index) => {
    const start = cursor;
    cursor += (group.count / total) * 100;
    return `${statusColors[index]} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function statusTone(status: string) {
  if (status === 'completed') return 'success';
  if (status === 'cancelled' || status === 'expired') return 'danger';
  if (status === 'preparing' || status === 'ready' || status === 'dispatched') return 'progress';
  return 'pending';
}

export function DashboardOverview({ apiUrl }: { apiUrl: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await restoreAdminToken();
      const response = await fetch(`${apiUrl}/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as { data?: DashboardData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'No fue posible cargar el resumen.');
      setData(payload.data);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'SESSION_EXPIRED') { window.location.assign('/login'); return; }
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el resumen.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [apiUrl]);
  const maxDailyRevenue = Math.max(...(data?.dailySales.map((day) => day.revenue) ?? [0]), 1);
  const weeklyOrders = data?.dailySales.reduce((sum, day) => sum + day.orders, 0) ?? 0;
  const statusTotal = data?.statusGroups.reduce((sum, group) => sum + group.count, 0) ?? 0;
  const channelTotal = data?.channels.reduce((sum, channel) => sum + channel.count, 0) ?? 0;
  const donut = useMemo(() => donutBackground(data?.statusGroups ?? []), [data]);

  if (loading) return <section className="dashboard-loading" aria-live="polite"><span></span><strong>Preparando tus indicadores…</strong><p>Estamos reuniendo ventas, pedidos e inventario.</p></section>;
  if (!data) return <section className="panel dashboard-error"><span>!</span><div><h2>No pudimos cargar el dashboard</h2><p>{error}</p></div><button className="admin-button" type="button" onClick={() => void load()}>Reintentar</button></section>;

  return <div className="dashboard-overview">
    <section className="dashboard-intro">
      <div><span>VISIÓN GENERAL</span><h2>Así se mueve tu negocio</h2><p>Ventas pagadas, operación e inventario en una sola vista.</p></div>
      <small>Actualizado {dateTime.format(new Date(data.generatedAt))}</small>
    </section>

    <section className="dashboard-kpis" aria-label="Indicadores principales">
      <article className="dashboard-kpi dashboard-kpi--featured"><div className="dashboard-kpi__icon">$</div><div><small>Ventas del mes</small><strong>{currency.format(data.totals.revenueMonth)}</strong><span>{data.totals.paidOrdersMonth} ventas pagadas</span></div></article>
      <article className="dashboard-kpi"><div className="dashboard-kpi__icon">↗</div><div><small>Últimos 7 días</small><strong>{currency.format(data.totals.revenueWeek)}</strong><span>{weeklyOrders} ventas · Hoy: {currency.format(data.totals.revenueToday)}</span></div></article>
      <article className="dashboard-kpi"><div className="dashboard-kpi__icon">▤</div><div><small>Pedidos de hoy</small><strong>{data.totals.ordersToday}</strong><span>{data.totals.pendingOrders} por gestionar</span></div></article>
      <article className="dashboard-kpi"><div className="dashboard-kpi__icon">◎</div><div><small>Ticket promedio</small><strong>{currency.format(data.totals.averageTicketMonth)}</strong><span>Promedio del mes</span></div></article>
    </section>

    <section className="dashboard-analytics">
      <article className="dashboard-card dashboard-revenue">
        <header><div><span>VENTAS PAGADAS</span><h2>Ingresos de los últimos 7 días</h2></div><strong>{currency.format(data.totals.revenueWeek)}</strong></header>
        <div className="dashboard-bars" role="img" aria-label="Gráfico de ventas pagadas durante los últimos siete días">
          {data.dailySales.map((day) => {
            const height = day.revenue ? Math.max(10, Math.round((day.revenue / maxDailyRevenue) * 100)) : 3;
            return <div className="dashboard-bar" key={day.date} title={`${day.label}: ${currency.format(day.revenue)} · ${day.orders} pedidos`}>
              <span>{day.revenue ? compactCurrency.format(day.revenue) : '$0'}</span>
              <div><i style={{ height: `${height}%` }}></i></div>
              <small><span>{day.label}</span><b>{day.orders} ped.</b></small>
            </div>;
          })}
        </div>
        <p className="dashboard-chart-note">Solo se consideran pedidos con pago confirmado.</p>
      </article>

      <article className="dashboard-card dashboard-status">
        <header><div><span>OPERACIÓN DEL MES</span><h2>Estado de pedidos</h2></div></header>
        <div className="dashboard-status__body">
          <div className="dashboard-donut" style={{ '--donut': donut } as CSSProperties}><div><strong>{statusTotal}</strong><small>pedidos</small></div></div>
          <div className="dashboard-legend">{data.statusGroups.map((group, index) => <div key={group.key}><i style={{ background: statusColors[index] }}></i><span>{group.label}</span><strong>{group.count}</strong></div>)}</div>
        </div>
        <div className="dashboard-channels"><strong>Canales de venta</strong>{data.channels.map((channel) => {
          const percentage = channelTotal ? Math.round((channel.count / channelTotal) * 100) : 0;
          return <div key={channel.channel}><span>{channel.channel === 'whatsapp' ? 'WhatsApp' : channel.channel === 'admin' ? 'Administración' : 'Tienda web'}</span><div><i style={{ width: `${percentage}%` }}></i></div><small>{percentage}%</small></div>;
        })}</div>
      </article>
    </section>

    <section className="dashboard-health" aria-label="Salud del negocio">
      <article><span>PRODUCTOS</span><strong>{data.totals.activeProducts}</strong><p>Productos activos en catálogo</p><a href="/productos">Administrar productos →</a></article>
      <article data-warning={data.totals.lowStock > 0}><span>INVENTARIO</span><strong>{data.totals.lowStock}</strong><p>Variantes con stock bajo</p><a href="/inventario">Revisar inventario →</a></article>
      <article><span>DESCUENTOS</span><strong>{currency.format(data.totals.discountsMonth)}</strong><p>Descuento entregado este mes</p><a href="/cupones">Ver cupones →</a></article>
    </section>

    <section className="panel dashboard-orders">
      <div className="panel-head"><div><h2>Últimas ventas</h2><p className="campaign-help">Actividad reciente de todos los canales.</p></div><a href="/pedidos" className="admin-button admin-button--soft">Ver todos los pedidos</a></div>
      <div className="table-scroll"><table><thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Estado</th><th>Total</th></tr></thead><tbody>
        {data.recentOrders.map((order) => <tr key={order.id}><td><strong>{order.public_code}</strong></td><td>{dateTime.format(new Date(order.created_at))}</td><td>{order.contact_first_name} {order.contact_last_name}</td><td><span className="dashboard-channel">{order.channel === 'whatsapp' ? 'WhatsApp' : order.channel === 'admin' ? 'Admin' : 'Web'}</span></td><td><span className="dashboard-order-status" data-tone={statusTone(order.order_status)}>{statusLabels[order.order_status] ?? order.order_status}</span></td><td><strong>{currency.format(order.grand_total_clp)}</strong></td></tr>)}
        {!data.recentOrders.length && <tr><td colSpan={6}><div className="dashboard-empty"><span>▥</span><strong>Aún no hay ventas registradas</strong><p>Los primeros pedidos aparecerán aquí automáticamente.</p></div></td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
