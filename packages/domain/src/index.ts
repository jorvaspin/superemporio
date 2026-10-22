export const ORDER_STATUSES = [
  'draft', 'pending_payment', 'pending_manual', 'confirmed', 'preparing',
  'ready', 'dispatched', 'completed', 'cancelled', 'expired',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const FULFILLMENT_STATUSES = ['unfulfilled', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];
export const RESERVATION_STATUSES = ['active', 'committed', 'released', 'expired'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const DELIVERY_COMMUNES = ['La Cisterna', 'San Miguel', 'La Granja'] as const;
export type DeliveryCommune = (typeof DELIVERY_COMMUNES)[number];
export const DELIVERY_FEE_CLP = 2990;

export type Money = number;
export const formatCLP = (amount: Money) => new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
}).format(amount);
export const clampQuantity = (quantity: number, available: number) => Math.max(0, Math.min(Math.floor(quantity), available));

export type CatalogVariant = {
  id: string; sku: string; label: string; unitCount: number; price: Money;
  compareAtPrice?: Money; stock: number; image: string;
};
export type CatalogProduct = {
  id: string; slug: string; name: string; brand: string; description: string;
  category: string; badge?: string; emoji: string; image: string; variants: CatalogVariant[];
};

export const canTransitionOrder = (from: OrderStatus, to: OrderStatus) => {
  const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
    draft: ['pending_payment', 'pending_manual', 'cancelled'],
    pending_payment: ['confirmed', 'expired', 'cancelled'],
    pending_manual: ['confirmed', 'cancelled', 'expired'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'dispatched', 'cancelled'],
    ready: ['completed', 'cancelled'],
    dispatched: ['completed', 'cancelled'],
    completed: [], cancelled: [], expired: [],
  };
  return transitions[from].includes(to);
};

export const normalizeRut = (value: string) => value.replace(/[^0-9kK]/g, '').toUpperCase();
export const isValidRut = (value: string) => {
  const rut = normalizeRut(value);
  if (rut.length < 2) return false;
  const body = rut.slice(0, -1);
  const verifier = rut.at(-1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const digit = 11 - (sum % 11);
  const expected = digit === 11 ? '0' : digit === 10 ? 'K' : String(digit);
  return verifier === expected;
};
