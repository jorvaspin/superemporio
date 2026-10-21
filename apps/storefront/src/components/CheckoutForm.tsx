import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useStore } from '@nanostores/react';
import { formatCLP } from '@superemporio/domain';
import { $cart, $cartTotal } from '../lib/cart';
import { readCustomerSession } from '../lib/customerSession';

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0];
type Quote = {
  subtotalClp: number;
  discountClp: number;
  shippingClp: number;
  grandTotalClp: number;
  couponCode: string | null;
  couponApplied: boolean;
  couponStatus: string;
  couponMessage: string | null;
};
type CreatedOrder = { id: string; publicCode: string; grandTotalClp: number; couponCode: string | null };
type Props = { apiUrl: string };

const communes = ['Ñuñoa', 'La Florida', 'Macul', 'Providencia'];

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('56') ? digits.slice(2) : digits;
  return `+56${local}`;
}

function apiMessage(payload: { error?: string; detail?: string }) {
  if (payload.detail?.includes('VARIANT_UNAVAILABLE')) return 'Uno de los productos ya no tiene stock suficiente.';
  if (payload.detail?.includes('MINIMUM_ORDER_NOT_REACHED')) return 'La compra no alcanza el mínimo requerido para esa comuna.';
  if (payload.detail?.includes('DELIVERY_ZONE_UNAVAILABLE')) return 'Todavía no tenemos despacho disponible para esa comuna.';
  if (payload.detail?.includes('COUPON_REJECTED')) return 'El cupón ya no puede aplicarse a este pedido. Revísalo e intenta nuevamente.';
  return 'No pudimos validar el pedido. Intenta nuevamente.';
}

export default function CheckoutForm({ apiUrl }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const lines = useStore($cart);
  const localSubtotal = useStore($cartTotal);
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery');
  const [documentType, setDocumentType] = useState<'receipt' | 'invoice'>('receipt');
  const [commune, setCommune] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponTone, setCouponTone] = useState<'success' | 'error'>('success');
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const items = useMemo(() => lines.map((line) => ({ variantId: line.variant.id, quantity: line.quantity })), [lines]);
  const itemsKey = useMemo(() => JSON.stringify(items), [items]);

  useEffect(() => {
    const session = readCustomerSession();
    if (!session) return;
    let current = true;
    fetch(`${apiUrl}/account/overview`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { data?: { profile?: { first_name?: string; last_name?: string; phone?: string }; addresses?: Array<{ commune: string; street: string; address_detail?: string; reference?: string; is_default: boolean }> } } | null) => {
        if (!current || !payload?.data || !formRef.current) return;
        const form = formRef.current.elements;
        const fill = (name: string, value?: string | null) => { const field = form.namedItem(name) as HTMLInputElement | null; if (field && !field.value && value) field.value = value; };
        fill('firstName', payload.data.profile?.first_name || session.user.firstName); fill('lastName', payload.data.profile?.last_name);
        fill('email', session.user.email); fill('phone', payload.data.profile?.phone);
        const address = payload.data.addresses?.find((item) => item.is_default) ?? payload.data.addresses?.[0];
        if (address) { setCommune(address.commune); window.setTimeout(() => { fill('address', address.street); fill('addressDetail', address.address_detail); fill('reference', address.reference); }); }
      }).catch(() => undefined);
    return () => { current = false; };
  }, [apiUrl]);

  async function requestQuote(couponCode?: string, email?: string) {
    const response = await fetch(`${apiUrl}/checkout/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        commune: fulfillment === 'delivery' && commune ? commune : undefined,
        couponCode: couponCode || undefined,
        email: email || undefined,
      }),
    });
    const payload = await response.json() as { data?: Quote; error?: string; detail?: string };
    if (!response.ok || !payload.data) throw new Error(apiMessage(payload));
    return payload.data;
  }

  useEffect(() => {
    if (!items.length) return;
    let current = true;
    const timer = window.setTimeout(async () => {
      try {
        const nextQuote = await requestQuote(appliedCoupon ?? undefined);
        if (!current) return;
        setQuote(nextQuote);
        if (appliedCoupon && !nextQuote.couponApplied) {
          setAppliedCoupon(null);
          setCouponTone('error');
          setCouponMessage(nextQuote.couponMessage ?? 'El cupón dejó de ser aplicable a esta compra.');
        }
      } catch (error) {
        if (current) setNotice(error instanceof Error ? error.message : 'No pudimos actualizar el total.');
      }
    }, 180);
    return () => { current = false; window.clearTimeout(timer); };
  }, [apiUrl, itemsKey, fulfillment, commune, appliedCoupon]);

  if (!lines.length) return <div className="checkout-card"><h2>Necesitas productos para pagar</h2><p className="muted">Tu carrito está vacío.</p><a className="button" href="/catalogo">Ver catálogo</a></div>;

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponTone('error'); setCouponMessage('Escribe un código de descuento.'); return; }
    setQuoteBusy(true); setCouponMessage(''); setNotice('');
    try {
      const email = String(new FormData(formRef.current ?? undefined).get('email') ?? '').trim();
      const nextQuote = await requestQuote(code, email.includes('@') ? email : undefined);
      setQuote(nextQuote);
      if (nextQuote.couponApplied && nextQuote.couponCode) {
        setAppliedCoupon(nextQuote.couponCode);
        setCouponInput(nextQuote.couponCode);
        setCouponTone('success');
        setCouponMessage(nextQuote.couponMessage ?? 'Cupón aplicado correctamente.');
      } else {
        setAppliedCoupon(null);
        setCouponTone('error');
        setCouponMessage(nextQuote.couponMessage ?? 'Este cupón no se puede aplicar.');
      }
    } catch (error) {
      setCouponTone('error');
      setCouponMessage(error instanceof Error ? error.message : 'No pudimos validar el cupón.');
    } finally { setQuoteBusy(false); }
  }

  async function removeCoupon() {
    setAppliedCoupon(null); setCouponInput(''); setCouponMessage(''); setQuoteBusy(true);
    try { setQuote(await requestQuote()); } catch { /* The general quote effect retries it. */ }
    finally { setQuoteBusy(false); }
  }

  function checkoutData() {
    const form = new FormData(formRef.current ?? undefined);
    const optional = (name: string) => String(form.get(name) ?? '').trim() || undefined;
    return {
      email: String(form.get('email') ?? '').trim().toLowerCase(),
      firstName: String(form.get('firstName') ?? '').trim(),
      lastName: String(form.get('lastName') ?? '').trim(),
      phone: normalizePhone(String(form.get('phone') ?? '')),
      fulfillment,
      commune: fulfillment === 'delivery' ? commune : undefined,
      address: fulfillment === 'delivery' ? optional('address') : undefined,
      addressDetail: fulfillment === 'delivery' ? optional('addressDetail') : undefined,
      reference: fulfillment === 'delivery' ? optional('reference') : undefined,
      couponCode: appliedCoupon ?? undefined,
      documentType,
      taxId: documentType === 'invoice' ? optional('taxId') : undefined,
      businessName: documentType === 'invoice' ? optional('businessName') : undefined,
      businessActivity: documentType === 'invoice' ? optional('businessActivity') : undefined,
      notes: optional('notes'),
    };
  }

  async function startFlow(order: CreatedOrder) {
    const response = await fetch(`${apiUrl}/payments/flow/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id }),
    });
    const payload = await response.json() as { data?: { url: string; token: string }; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error === 'FLOW_NOT_CONFIGURED' ? 'Flow aún no está configurado. El pedido quedó creado y reservado.' : 'El pedido fue creado, pero Flow no está disponible en este momento.');
    window.location.assign(`${payload.data.url}?token=${encodeURIComponent(payload.data.token)}`);
  }

  async function placeOrder(channel: 'web' | 'whatsapp') {
    if (!formRef.current?.reportValidity()) return;
    setBusy(true); setNotice('');
    try {
      if (createdOrder) {
        if (channel === 'web') await startFlow(createdOrder);
        return;
      }
      const checkout = checkoutData();
      const finalQuote = await requestQuote(appliedCoupon ?? undefined, checkout.email);
      if (appliedCoupon && !finalQuote.couponApplied) {
        setCouponTone('error'); setCouponMessage(finalQuote.couponMessage ?? 'El cupón ya no puede aplicarse.'); setAppliedCoupon(null); setQuote(finalQuote); return;
      }
      setQuote(finalQuote);
      const response = await fetch(`${apiUrl}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(readCustomerSession() ? { Authorization: `Bearer ${readCustomerSession()!.accessToken}` } : {}) },
        body: JSON.stringify({ cart: { items }, checkout, channel }),
      });
      const payload = await response.json() as { data?: CreatedOrder; error?: string; detail?: string };
      if (!response.ok || !payload.data) throw new Error(apiMessage(payload));
      setCreatedOrder(payload.data);
      if (channel === 'web') {
        setNotice(`Pedido ${payload.data.publicCode} creado. Conectando con Flow…`);
        await startFlow(payload.data);
      } else {
        const message = [
          `Hola, quiero coordinar mi pedido Superemporio ${payload.data.publicCode}.`,
          ...lines.map((line) => `• ${line.quantity}× ${line.product.name} (${line.variant.label})`),
          payload.data.couponCode ? `Cupón aplicado: ${payload.data.couponCode}` : '',
          `Total: ${formatCLP(payload.data.grandTotalClp)}`,
        ].filter(Boolean).join('\n');
        window.open(`https://wa.me/56900000000?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
        setNotice(`Pedido ${payload.data.publicCode} creado con stock reservado. Continúa la coordinación por WhatsApp.`);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No pudimos crear el pedido.'); }
    finally { setBusy(false); }
  }

  function submit(event: FormSubmitEvent) { event.preventDefault(); void placeOrder('web'); }

  const subtotal = quote?.subtotalClp ?? localSubtotal;
  const discount = quote?.discountClp ?? 0;
  const shippingPending = fulfillment === 'delivery' && !commune;
  const shipping = quote?.shippingClp ?? 0;
  const total = quote?.grandTotalClp ?? Math.max(0, subtotal - discount + shipping);

  return <form ref={formRef} className="checkout-grid" onSubmit={submit}>
    <section className="checkout-card">
      <div className="eyebrow">Paso final</div><h2>Datos de tu pedido</h2>
      <div className="form-grid">
        <label className="form-field"><span>Nombre</span><input required name="firstName" autoComplete="given-name" /></label>
        <label className="form-field"><span>Apellido</span><input required name="lastName" autoComplete="family-name" /></label>
        <label className="form-field"><span>Correo</span><input required type="email" name="email" autoComplete="email" /></label>
        <label className="form-field"><span>Teléfono</span><input required type="tel" name="phone" placeholder="+56 9 1234 5678" autoComplete="tel" pattern="(?:\\+?56\\s*)?9[0-9\\s-]{8,14}" /></label>
      </div>
      <h3 className="checkout-section-title">¿Cómo recibes tu compra?</h3>
      <div className="radio-row">
        <label className="radio-card"><input type="radio" value="delivery" checked={fulfillment === 'delivery'} onChange={() => setFulfillment('delivery')} name="fulfillment" /> <strong>Despacho local</strong><br /><span className="muted">A tu domicilio</span></label>
        <label className="radio-card"><input type="radio" value="pickup" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')} name="fulfillment" /> <strong>Retiro</strong><br /><span className="muted">Coordinamos contigo</span></label>
      </div>
      {fulfillment === 'delivery' && <div className="form-grid">
        <label className="form-field"><span>Comuna</span><select required name="commune" value={commune} onChange={(event) => setCommune(event.target.value)}><option value="">Selecciona</option>{communes.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="form-field"><span>Dirección</span><input required name="address" placeholder="Calle y número" autoComplete="street-address" /></label>
        <label className="form-field"><span>Departamento o casa</span><input name="addressDetail" placeholder="Opcional" /></label>
        <label className="form-field"><span>Referencia</span><input name="reference" placeholder="Ej: portón azul" /></label>
      </div>}
      <h3 className="checkout-section-title">Documento</h3>
      <div className="radio-row">
        <label className="radio-card"><input type="radio" name="documentType" value="receipt" checked={documentType === 'receipt'} onChange={() => setDocumentType('receipt')} /> Boleta</label>
        <label className="radio-card"><input type="radio" name="documentType" value="invoice" checked={documentType === 'invoice'} onChange={() => setDocumentType('invoice')} /> Factura</label>
      </div>
      {documentType === 'invoice' && <div className="form-grid">
        <label className="form-field"><span>RUT empresa</span><input name="taxId" required placeholder="76.123.456-7" /></label>
        <label className="form-field"><span>Razón social</span><input name="businessName" required /></label>
        <label className="form-field form-field--full"><span>Giro</span><input name="businessActivity" required /></label>
      </div>}
      <label className="form-field checkout-notes"><span>¿Alguna indicación para tu pedido?</span><textarea name="notes" maxLength={240} placeholder="Opcional" /></label>
      {notice && <p className="notice" role="status">{notice}</p>}
    </section>
    <aside className="checkout-card checkout-summary">
      <h2>Tu resumen</h2>
      <div className="checkout-products">{lines.map((line) => <div className="summary-line" key={line.variant.id}><span>{line.quantity}× {line.product.name}</span><strong>{formatCLP(line.quantity * line.variant.price)}</strong></div>)}</div>
      <div className="coupon-box">
        <label htmlFor="coupon-code">¿Tienes un cupón?</label>
        <div className="coupon-row"><input id="coupon-code" value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} maxLength={32} placeholder="Ej: WEL10" readOnly={Boolean(appliedCoupon)} /><button type="button" onClick={() => void (appliedCoupon ? removeCoupon() : applyCoupon())} disabled={quoteBusy}>{quoteBusy ? 'Validando…' : appliedCoupon ? 'Quitar' : 'Aplicar'}</button></div>
        {couponMessage && <p className={`coupon-message coupon-message--${couponTone}`} role="status">{couponMessage}</p>}
      </div>
      <div className="summary-line"><span>Productos</span><span>{formatCLP(subtotal)}</span></div>
      {discount > 0 && <div className="summary-line summary-discount"><span>Descuento {appliedCoupon ? `(${appliedCoupon})` : ''}</span><strong>−{formatCLP(discount)}</strong></div>}
      <div className="summary-line"><span>Despacho</span><span>{shippingPending ? 'Por calcular' : shipping ? formatCLP(shipping) : 'Gratis'}</span></div>
      <div className="summary-line summary-total"><span>{shippingPending ? 'Total estimado' : 'Total'}</span><span>{formatCLP(total)}</span></div>
      <button className="button button--full" type="submit" disabled={busy || quoteBusy} style={{ marginTop: '1rem' }}>{busy ? 'Procesando…' : createdOrder ? 'Reintentar pago con Flow' : 'Pagar con Flow'} <span aria-hidden="true">→</span></button>
      <button className="button button--secondary button--full" type="button" disabled={busy || quoteBusy || Boolean(createdOrder)} onClick={() => void placeOrder('whatsapp')} style={{ marginTop: '.6rem' }}>Continuar por WhatsApp</button>
      <p className="muted checkout-security-note">El cupón, los precios y el stock se validan nuevamente en el servidor antes de crear el pedido.</p>
    </aside>
  </form>;
}
