import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { cartItemSchema, checkoutSchema, productSchema } from '@superemporio/validation';
import { canTransitionOrder, DELIVERY_COMMUNES, ORDER_STATUSES } from '@superemporio/domain';
import { z } from 'zod';
import { createAdminClient, createPublicClient } from './lib/supabase';
import { createFlowPayment, getFlowPaymentStatus } from './lib/flow';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>().basePath('/v1');
type ApiContext = Context<{ Bindings: Env }>;
type AdminSession = { id: string; role: 'owner' | 'operator' };
app.use('*', cors({
  origin: (origin, context) => {
    const configured = [
      context.env.PUBLIC_STORE_URL,
      context.env.PUBLIC_ADMIN_URL,
      context.env.PUBLIC_PREVIEW_STORE_URL,
      context.env.PUBLIC_PREVIEW_ADMIN_URL,
    ].filter(Boolean);
    if (configured.includes(origin)) return origin;
    try {
      const url = new URL(origin);
      if (['localhost', '127.0.0.1'].includes(url.hostname) && ['4321', '4322'].includes(url.port)) return origin;
    } catch { /* Invalid origins are rejected below. */ }
    return '';
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
}));
app.get('/health', (context) => context.json({ ok: true, service: 'superemporio-api' }));

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
async function requireAdmin(context: ApiContext): Promise<AdminSession | null> {
  const bearer = context.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer) return null;
  const auth = createPublicClient(context.env); const { data: userResult } = await auth.auth.getUser(bearer);
  if (!userResult.user) return null;
  const database = createAdminClient(context.env); const { data: membership } = await database.from('admin_members').select('role,active').eq('user_id', userResult.user.id).maybeSingle();
  return membership?.active ? { id: userResult.user.id, role: membership.role } : null;
}
async function requireOwner(context: ApiContext) {
  const admin = await requireAdmin(context);
  return admin?.role === 'owner' ? admin : null;
}
type CustomerSession = { id: string; email: string; firstName: string | null };
async function getCustomer(context: ApiContext): Promise<CustomerSession | null> {
  const bearer = context.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer) return null;
  const { data } = await createPublicClient(context.env).auth.getUser(bearer);
  const email = data.user?.email?.trim().toLowerCase();
  if (!data.user || !email) return null;
  await createAdminClient(context.env).from('profiles').upsert({ id: data.user.id }, { onConflict: 'id', ignoreDuplicates: true });
  return { id: data.user.id, email, firstName: data.user.user_metadata?.first_name ?? null };
}
async function audit(context: ApiContext, admin: AdminSession, action: string, entityType: string, entityId: string | null, oldValue?: unknown, newValue?: unknown) {
  await createAdminClient(context.env).from('audit_logs').insert({ actor_id: admin.id, action, entity_type: entityType, entity_id: entityId, old_value: oldValue ?? null, new_value: newValue ?? null, context: { source: 'admin_api' } });
}

app.get('/catalog/products', async (context) => {
  const database = createAdminClient(context.env);
  const { data, error } = await database.from('products').select('id,slug,name,brand,description,product_variants(id,sku,label,unit_count,price_clp,compare_at_price_clp,inventory(available_quantity,reserved_quantity))').eq('status', 'active').order('created_at', { ascending: false });
  if (error) return context.json({ error: 'CATALOG_UNAVAILABLE' }, 503);
  return context.json({ data });
});
app.get('/catalog/products/:slug', async (context) => {
  const database = createAdminClient(context.env);
  const { data, error } = await database.from('products').select('*,product_variants(*,inventory(*)),product_images(*)').eq('slug', context.req.param('slug')).eq('status', 'active').single();
  if (error) return context.json({ error: 'PRODUCT_NOT_FOUND' }, 404);
  return context.json({ data });
});
app.get('/catalog/categories', async (context) => {
  const database = createAdminClient(context.env);
  const { data, error } = await database.from('categories').select('id,slug,name,description,image_path,sort_order').eq('active', true).order('sort_order');
  if (error) return context.json({ error: 'CATEGORIES_UNAVAILABLE' }, 503);
  return context.json({ data });
});
app.get('/catalog/search', async (context) => {
  const query = context.req.query('q')?.trim() ?? '';
  if (query.length < 2) return context.json({ data: [] });
  const database = createAdminClient(context.env);
  const { data, error } = await database.rpc('search_products', { search_query: query });
  if (error) return context.json({ error: 'SEARCH_UNAVAILABLE' }, 503);
  return context.json({ data });
});

const campaignPlacementSchema = z.enum(['announcement', 'hero', 'banner', 'modal', 'home_intro', 'home_offers', 'home_favorites']);
const campaignSchema = z.object({
  placement: campaignPlacementSchema,
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().max(600).nullable().optional(),
  imagePath: z.string().trim().max(500).nullable().optional(),
  linkUrl: z.string().trim().max(500).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(-100).max(100).default(0),
  imageContainsCopy: z.boolean().default(false),
  active: z.boolean().default(true),
});
const categorySchema = z.object({
  name: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(1000).nullable().optional(), imagePath: z.string().trim().max(500).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(), sortOrder: z.number().int().min(0).max(9999).default(0), active: z.boolean().default(true),
});
const variantSchema = z.object({
  id: z.string().uuid().optional(), sku: z.string().trim().min(3).max(80), barcode: z.string().trim().max(80).nullable().optional(),
  label: z.string().trim().min(1).max(160), unitCount: z.number().int().min(1).max(9999).default(1), priceClp: z.number().int().min(0),
  compareAtPriceClp: z.number().int().min(0).nullable().optional(), active: z.boolean().default(true),
  availableQuantity: z.number().int().min(0).optional(), lowStockThreshold: z.number().int().min(0).max(9999).default(5),
}).superRefine((value, issue) => { if (value.compareAtPriceClp !== null && value.compareAtPriceClp !== undefined && value.compareAtPriceClp < value.priceClp) issue.addIssue({ code: z.ZodIssueCode.custom, message: 'El precio anterior no puede ser menor al precio actual.' }); });
const productWriteSchema = productSchema.extend({
  status: z.enum(['draft', 'active', 'archived']).default('draft'), seoTitle: z.string().trim().max(160).nullable().optional(), seoDescription: z.string().trim().max(320).nullable().optional(),
  categoryIds: z.array(z.string().uuid()).max(12).default([]), variants: z.array(variantSchema).min(1).max(60),
});
const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,32}$/), type: z.enum(['fixed', 'percentage', 'free_shipping']), value: z.number().int().min(0),
  minimumSubtotalClp: z.number().int().min(0).default(0), usageLimit: z.number().int().min(1).nullable().optional(), perCustomerLimit: z.number().int().min(1).nullable().optional(),
  requiresAccount: z.boolean().default(false), allowedWeekdays: z.array(z.number().int().min(1).max(7)).max(7).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional(), active: z.boolean().default(true),
}).superRefine((value, issue) => { if (value.type === 'percentage' && (value.value < 1 || value.value > 100)) issue.addIssue({ code: z.ZodIssueCode.custom, message: 'El porcentaje debe estar entre 1 y 100.' }); });
const deliveryZoneSchema = z.object({ region: z.string().trim().min(2).max(100).default('Metropolitana de Santiago'), commune: z.string().trim().min(2).max(100), feeClp: z.number().int().min(0), minimumOrderClp: z.number().int().min(0).default(0), freeShippingThresholdClp: z.number().int().min(0).nullable().optional(), active: z.boolean().default(true) });
const orderStatusSchema = z.enum(ORDER_STATUSES);
const authEmailSchema = z.string().trim().toLowerCase().email().max(254);
const authPasswordSchema = z.string().min(8).max(72);

app.post('/auth/login', zValidator('json', z.object({ email: authEmailSchema, password: authPasswordSchema })), async (context) => {
  const input = context.req.valid('json');
  const { data, error } = await createPublicClient(context.env).auth.signInWithPassword(input);
  if (error || !data.session || !data.user) return context.json({ error: 'INVALID_CREDENTIALS' }, 401);
  return context.json({ data: {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email, firstName: data.user.user_metadata?.first_name ?? null },
  } });
});

app.get('/auth/session', async (context) => {
  const customer = await getCustomer(context);
  if (!customer) return context.json({ error: 'UNAUTHORIZED' }, 401);
  return context.json({ data: { user: customer } });
});

app.post('/auth/register', zValidator('json', z.object({
  email: authEmailSchema, password: authPasswordSchema,
  firstName: z.string().trim().min(2).max(80), lastName: z.string().trim().min(2).max(80),
})), async (context) => {
  const input = context.req.valid('json');
  const { data, error } = await createPublicClient(context.env).auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${context.env.PUBLIC_STORE_URL}/cuenta`,
      data: { first_name: input.firstName, last_name: input.lastName, full_name: `${input.firstName} ${input.lastName}` },
    },
  });
  if (error) return context.json({ error: error.message.toLowerCase().includes('registered') ? 'EMAIL_ALREADY_REGISTERED' : 'REGISTRATION_FAILED' }, 422);
  if (!data.user || data.user.identities?.length === 0) return context.json({ error: 'EMAIL_ALREADY_REGISTERED' }, 409);
  return context.json({ data: {
    requiresEmailConfirmation: !data.session,
    ...(data.session ? {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    } : {}),
    user: { id: data.user.id, email: data.user.email, firstName: input.firstName },
  } }, 201);
});

app.post('/auth/recover', zValidator('json', z.object({ email: authEmailSchema })), async (context) => {
  const { email } = context.req.valid('json');
  await createPublicClient(context.env).auth.resetPasswordForEmail(email, { redirectTo: `${context.env.PUBLIC_STORE_URL}/cuenta?restablecer=1` });
  return context.json({ data: { accepted: true } }, 202);
});

const customerProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(80), lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(30).nullable().optional(), marketingOptIn: z.boolean().default(false),
});
const customerAddressSchema = z.object({
  label: z.string().trim().min(2).max(40), region: z.string().trim().min(2).max(100).default('Metropolitana de Santiago'),
  commune: z.enum(DELIVERY_COMMUNES), street: z.string().trim().min(4).max(160),
  addressDetail: z.string().trim().max(160).nullable().optional(), reference: z.string().trim().max(240).nullable().optional(),
  isDefault: z.boolean().default(false),
});

app.get('/account/overview', async (context) => {
  const customer = await getCustomer(context);
  if (!customer) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const database = createAdminClient(context.env);
  await database.from('orders').update({ customer_id: customer.id }).is('customer_id', null).eq('contact_email', customer.email);
  const [profileResult, addressesResult, ordersResult] = await Promise.all([
    database.from('profiles').select('id,first_name,last_name,phone,marketing_opt_in').eq('id', customer.id).single(),
    database.from('customer_addresses').select('id,label,region,commune,street,address_detail,reference,is_default,created_at').eq('customer_id', customer.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
    database.from('orders').select('id,public_code,order_status,payment_status,fulfillment_status,fulfillment_method,coupon_code,subtotal_clp,discount_clp,shipping_clp,grand_total_clp,created_at,order_items(quantity,product_name_snapshot,variant_label_snapshot)').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(50),
  ]);
  if (profileResult.error || addressesResult.error || ordersResult.error) return context.json({ error: 'ACCOUNT_UNAVAILABLE' }, 503);
  return context.json({ data: { user: customer, profile: profileResult.data, addresses: addressesResult.data, orders: ordersResult.data } });
});

app.put('/account/profile', zValidator('json', customerProfileSchema), async (context) => {
  const customer = await getCustomer(context);
  if (!customer) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const input = context.req.valid('json');
  const { data, error } = await createAdminClient(context.env).from('profiles').upsert({
    id: customer.id, first_name: input.firstName, last_name: input.lastName,
    phone: input.phone || null, marketing_opt_in: input.marketingOptIn,
  }, { onConflict: 'id' }).select('id,first_name,last_name,phone,marketing_opt_in').single();
  return error ? context.json({ error: 'PROFILE_UPDATE_FAILED' }, 422) : context.json({ data });
});

app.post('/account/addresses', zValidator('json', customerAddressSchema), async (context) => {
  const customer = await getCustomer(context);
  if (!customer) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const input = context.req.valid('json'); const database = createAdminClient(context.env);
  if (input.isDefault) await database.from('customer_addresses').update({ is_default: false }).eq('customer_id', customer.id);
  const { data, error } = await database.from('customer_addresses').insert({
    customer_id: customer.id, label: input.label, region: input.region, commune: input.commune, street: input.street,
    address_detail: input.addressDetail || null, reference: input.reference || null, is_default: input.isDefault,
  }).select().single();
  return error ? context.json({ error: 'ADDRESS_CREATE_FAILED' }, 422) : context.json({ data }, 201);
});

app.put('/account/addresses/:id', zValidator('json', customerAddressSchema), async (context) => {
  const customer = await getCustomer(context); const id = z.string().uuid().safeParse(context.req.param('id'));
  if (!customer) return context.json({ error: 'UNAUTHORIZED' }, 401);
  if (!id.success) return context.json({ error: 'INVALID_ADDRESS' }, 422);
  const input = context.req.valid('json'); const database = createAdminClient(context.env);
  if (input.isDefault) await database.from('customer_addresses').update({ is_default: false }).eq('customer_id', customer.id);
  const { data, error } = await database.from('customer_addresses').update({
    label: input.label, region: input.region, commune: input.commune, street: input.street,
    address_detail: input.addressDetail || null, reference: input.reference || null, is_default: input.isDefault,
  }).eq('id', id.data).eq('customer_id', customer.id).select().maybeSingle();
  if (error) return context.json({ error: 'ADDRESS_UPDATE_FAILED' }, 422);
  return data ? context.json({ data }) : context.json({ error: 'ADDRESS_NOT_FOUND' }, 404);
});

app.delete('/account/addresses/:id', async (context) => {
  const customer = await getCustomer(context); const id = z.string().uuid().safeParse(context.req.param('id'));
  if (!customer) return context.json({ error: 'UNAUTHORIZED' }, 401);
  if (!id.success) return context.json({ error: 'INVALID_ADDRESS' }, 422);
  const { error } = await createAdminClient(context.env).from('customer_addresses').delete().eq('id', id.data).eq('customer_id', customer.id);
  return error ? context.json({ error: 'ADDRESS_DELETE_FAILED' }, 422) : context.body(null, 204);
});

app.get('/content/campaigns', async (context) => {
  const placement = context.req.query('placement');
  const validatedPlacement = placement ? campaignPlacementSchema.safeParse(placement) : null;
  if (validatedPlacement && !validatedPlacement.success) return context.json({ error: 'INVALID_PLACEMENT' }, 422);
  const { data, error } = await createPublicClient(context.env).from('campaigns').select('id,placement,title,body,image_path,link_url,starts_at,ends_at,priority,image_contains_copy').order('priority', { ascending: false });
  if (error) return context.json({ error: 'CAMPAIGNS_UNAVAILABLE' }, 503);
  const filtered = validatedPlacement?.data ? data.filter((campaign) => campaign.placement === validatedPlacement.data) : data;
  return context.json({ data: filtered });
});

const cartSchema = z.object({ items: z.array(cartItemSchema).min(1), cartToken: z.string().min(24).max(120).optional() });
const cartTokenSchema = z.string().min(24).max(120);
app.post('/carts', async (context) => {
  const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`;
  const database = createAdminClient(context.env); const { data, error } = await database.from('carts').insert({ token_hash: await sha256(token) }).select('id,expires_at').single();
  if (error) return context.json({ error: 'CART_UNAVAILABLE' }, 503);
  return context.json({ data: { cart: data, token } }, 201);
});
app.get('/carts/:token', async (context) => {
  const token = cartTokenSchema.safeParse(context.req.param('token')); if (!token.success) return context.json({ error: 'CART_NOT_FOUND' }, 404);
  const database = createAdminClient(context.env); const { data, error } = await database.from('carts').select('id,status,expires_at,cart_items(quantity,last_seen_price_clp,product_variants(id,sku,label,price_clp,product_id,products(id,slug,name,brand)))').eq('token_hash', await sha256(token.data)).eq('status', 'active').single();
  if (error) return context.json({ error: 'CART_NOT_FOUND' }, 404);
  return context.json({ data });
});
app.put('/carts/:token/items/:variantId', zValidator('json', z.object({ quantity: z.number().int().min(1).max(99) })), async (context) => {
  const token = cartTokenSchema.safeParse(context.req.param('token')); const variantId = z.string().uuid().safeParse(context.req.param('variantId')); if (!token.success || !variantId.success) return context.json({ error: 'INVALID_CART_ITEM' }, 422);
  const database = createAdminClient(context.env); const { data: cart } = await database.from('carts').select('id').eq('token_hash', await sha256(token.data)).eq('status', 'active').maybeSingle();
  if (!cart) return context.json({ error: 'CART_NOT_FOUND' }, 404);
  const { data: variant } = await database.from('product_variants').select('id,price_clp,active').eq('id', variantId.data).maybeSingle();
  if (!variant?.active) return context.json({ error: 'VARIANT_NOT_FOUND' }, 404);
  const { data, error } = await database.from('cart_items').upsert({ cart_id: cart.id, variant_id: variant.id, quantity: context.req.valid('json').quantity, last_seen_price_clp: variant.price_clp }, { onConflict: 'cart_id,variant_id' }).select().single();
  if (error) return context.json({ error: 'CART_UPDATE_FAILED' }, 422);
  return context.json({ data });
});
app.delete('/carts/:token/items/:variantId', async (context) => {
  const token = cartTokenSchema.safeParse(context.req.param('token')); const variantId = z.string().uuid().safeParse(context.req.param('variantId')); if (!token.success || !variantId.success) return context.json({ error: 'INVALID_CART_ITEM' }, 422);
  const database = createAdminClient(context.env); const { data: cart } = await database.from('carts').select('id').eq('token_hash', await sha256(token.data)).eq('status', 'active').maybeSingle();
  if (!cart) return context.json({ error: 'CART_NOT_FOUND' }, 404);
  await database.from('cart_items').delete().eq('cart_id', cart.id).eq('variant_id', variantId.data);
  return context.body(null, 204);
});
app.post('/checkout/quote', zValidator('json', z.object({ items: z.array(cartItemSchema).min(1), commune: z.string().optional(), couponCode: z.string().trim().toUpperCase().max(32).optional(), email: z.string().email().optional() })), async (context) => {
  const database = createAdminClient(context.env);
  const input = context.req.valid('json');
  const customer = await getCustomer(context);
  const { data, error } = await database.rpc('quote_checkout_for_customer', { p_items: input.items, p_commune: input.commune ?? null, p_coupon_code: input.couponCode ?? null, p_email: input.email ?? customer?.email ?? null, p_customer_id: customer?.id ?? null });
  if (error) return context.json({ error: 'QUOTE_UNAVAILABLE', detail: error.message }, 422);
  return context.json({ data });
});
app.post('/orders', zValidator('json', z.object({ cart: cartSchema, checkout: checkoutSchema, channel: z.enum(['web', 'whatsapp']).default('web') })), async (context) => {
  const input = context.req.valid('json'); const database = createAdminClient(context.env);
  const customer = await getCustomer(context);
  const { data, error } = await database.rpc('create_checkout_order_for_customer', { p_items: input.cart.items, p_checkout: input.checkout, p_channel: input.channel, p_cart_token: input.cart.cartToken ?? null, p_customer_id: customer?.id ?? null });
  if (error) return context.json({ error: 'ORDER_REJECTED', detail: error.message }, 422);
  return context.json({ data }, 201);
});
app.get('/orders/:publicCode/status', async (context) => {
  const database = createAdminClient(context.env);
  const { data, error } = await database.from('orders').select('public_code,order_status,payment_status,fulfillment_status,grand_total_clp').eq('public_code', context.req.param('publicCode')).single();
  if (error) return context.json({ error: 'ORDER_NOT_FOUND' }, 404);
  return context.json({ data });
});
app.post('/payments/flow/session', zValidator('json', z.object({ orderId: z.string().uuid() })), async (context) => {
  const database = createAdminClient(context.env); const { orderId } = context.req.valid('json');
  const { data: order, error } = await database.from('orders').select('id,public_code,grand_total_clp,contact_email,payment_status').eq('id', orderId).single();
  if (error || order.payment_status === 'paid') return context.json({ error: 'ORDER_NOT_PAYABLE' }, 409);
  try { const payment = await createFlowPayment(context.env, { orderNumber: order.public_code, amount: order.grand_total_clp, email: order.contact_email }); await database.from('payments').upsert({ order_id: order.id, provider: 'flow', provider_payment_id: payment.token, amount_clp: order.grand_total_clp, payment_status: 'pending' }, { onConflict: 'provider,provider_payment_id' }); return context.json({ data: payment }); }
  catch (error) { return context.json({ error: error instanceof Error ? error.message : 'FLOW_UNAVAILABLE' }, 503); }
});
app.post('/payments/flow/callback', async (context) => {
  const form = await context.req.parseBody(); const token = String(form.token ?? '');
  if (!token) return context.text('missing token', 400);
  try { const status = await getFlowPaymentStatus(context.env, token); const database = createAdminClient(context.env); const paid = status.status === 2;
    await database.rpc('record_flow_callback', { p_token: token, p_provider_status: status.status, p_provider_order: String(status.flowOrder), p_paid: paid, p_amount: status.amount });
    return context.text('ok');
  } catch { return context.text('retry', 503); }
});

app.get('/admin/me', async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401);
  await createAdminClient(context.env).from('admin_members').update({ last_seen_at: new Date().toISOString() }).eq('user_id', admin.id);
  return context.json({ data: admin });
});
app.get('/admin/dashboard', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);

  const database = createAdminClient(context.env);
  const timeZone = 'America/Santiago';
  const localParts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const dateKey = (date: Date) => { const parts = localParts(date); return `${parts.year}-${parts.month}-${parts.day}`; };
  const now = new Date();
  const todayParts = localParts(now);
  const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const monthKey = todayKey.slice(0, 7);
  const baseDay = new Date(Date.UTC(Number(todayParts.year), Number(todayParts.month) - 1, Number(todayParts.day), 12));
  const monthStart = new Date(Date.UTC(Number(todayParts.year), Number(todayParts.month) - 1, 1));
  const weekStart = new Date(baseDay.getTime() - 7 * 86_400_000);
  const queryStart = new Date(Math.min(monthStart.getTime(), weekStart.getTime()));
  const activeOrderStatuses = ['pending_payment', 'pending_manual', 'confirmed', 'preparing', 'ready', 'dispatched'];
  const orderFields = 'id,public_code,channel,order_status,payment_status,fulfillment_method,contact_first_name,contact_last_name,grand_total_clp,discount_clp,created_at';

  const [ordersResult, recentResult, pendingResult, productsResult, inventoryResult] = await Promise.all([
    database.from('orders').select(orderFields).gte('created_at', queryStart.toISOString()).order('created_at', { ascending: true }),
    database.from('orders').select(orderFields).order('created_at', { ascending: false }).limit(8),
    database.from('orders').select('id', { count: 'exact', head: true }).in('order_status', activeOrderStatuses),
    database.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    database.from('inventory').select('available_quantity,low_stock_threshold'),
  ]);
  if (ordersResult.error || recentResult.error || pendingResult.error || productsResult.error || inventoryResult.error) {
    return context.json({ error: 'DASHBOARD_UNAVAILABLE' }, 503);
  }

  const orders = ordersResult.data ?? [];
  const monthOrders = orders.filter((order) => dateKey(new Date(order.created_at)).startsWith(monthKey));
  const paidOrders = orders.filter((order) => order.payment_status === 'paid');
  const paidMonthOrders = monthOrders.filter((order) => order.payment_status === 'paid');
  const revenueMonth = paidMonthOrders.reduce((sum, order) => sum + Number(order.grand_total_clp), 0);
  const discountsMonth = paidMonthOrders.reduce((sum, order) => sum + Number(order.discount_clp), 0);
  const activeTodayOrders = orders.filter((order) => dateKey(new Date(order.created_at)) === todayKey && !['draft', 'cancelled', 'expired'].includes(order.order_status));
  const dailySales = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(baseDay.getTime() - (6 - index) * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    const dayOrders = paidOrders.filter((order) => dateKey(new Date(order.created_at)) === key);
    return {
      date: key,
      label: new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(day).replace('.', ''),
      revenue: dayOrders.reduce((sum, order) => sum + Number(order.grand_total_clp), 0),
      orders: dayOrders.length,
    };
  });
  const statusGroups = [
    { key: 'pending', label: 'Pendientes', statuses: ['pending_payment', 'pending_manual', 'confirmed'] },
    { key: 'preparing', label: 'Preparando', statuses: ['preparing', 'ready'] },
    { key: 'dispatched', label: 'En ruta', statuses: ['dispatched'] },
    { key: 'completed', label: 'Completados', statuses: ['completed'] },
    { key: 'cancelled', label: 'Cancelados', statuses: ['cancelled', 'expired'] },
  ].map((group) => ({ ...group, count: monthOrders.filter((order) => group.statuses.includes(order.order_status)).length }));
  const channels = ['web', 'whatsapp', 'admin'].map((channel) => ({
    channel,
    count: monthOrders.filter((order) => order.channel === channel && !['draft', 'cancelled', 'expired'].includes(order.order_status)).length,
  }));
  const lowStock = (inventoryResult.data ?? []).filter((item) => Number(item.available_quantity) <= Number(item.low_stock_threshold)).length;

  return context.json({ data: {
    generatedAt: now.toISOString(),
    totals: {
      revenueToday: dailySales.at(-1)?.revenue ?? 0,
      revenueWeek: dailySales.reduce((sum, day) => sum + day.revenue, 0),
      revenueMonth,
      ordersToday: activeTodayOrders.length,
      paidOrdersMonth: paidMonthOrders.length,
      averageTicketMonth: paidMonthOrders.length ? Math.round(revenueMonth / paidMonthOrders.length) : 0,
      pendingOrders: pendingResult.count ?? 0,
      discountsMonth,
      activeProducts: productsResult.count ?? 0,
      lowStock,
    },
    dailySales,
    statusGroups,
    channels,
    recentOrders: recentResult.data ?? [],
    month: monthKey,
  } });
});
app.get('/admin/categories', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('categories').select('*').order('sort_order').order('name');
  return error ? context.json({ error: 'CATEGORIES_UNAVAILABLE' }, 503) : context.json({ data });
});
app.post('/admin/categories', zValidator('json', categorySchema), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const input = context.req.valid('json'); const { data, error } = await createAdminClient(context.env).from('categories').insert({ name: input.name, slug: input.slug, description: input.description ?? null, image_path: input.imagePath ?? null, parent_id: input.parentId ?? null, sort_order: input.sortOrder, active: input.active }).select().single();
  if (error) return context.json({ error: 'CATEGORY_CREATE_FAILED' }, 422); await audit(context, admin, 'create', 'category', data.id, null, data); return context.json({ data }, 201);
});
app.put('/admin/categories/:id', zValidator('json', categorySchema.partial()), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401); const id = z.string().uuid().safeParse(context.req.param('id')); if (!id.success) return context.json({ error: 'INVALID_CATEGORY' }, 422);
  const database = createAdminClient(context.env); const { data: old } = await database.from('categories').select('*').eq('id', id.data).maybeSingle(); if (!old) return context.json({ error: 'CATEGORY_NOT_FOUND' }, 404);
  const input = context.req.valid('json'); const update = { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.slug !== undefined ? { slug: input.slug } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.imagePath !== undefined ? { image_path: input.imagePath } : {}), ...(input.parentId !== undefined ? { parent_id: input.parentId } : {}), ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}), ...(input.active !== undefined ? { active: input.active } : {}) };
  const { data, error } = await database.from('categories').update(update).eq('id', id.data).select().single(); if (error) return context.json({ error: 'CATEGORY_UPDATE_FAILED' }, 422); await audit(context, admin, 'update', 'category', id.data, old, data); return context.json({ data });
});
app.get('/admin/products', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('products').select('*,product_categories(category_id),product_variants(*,inventory(*)),product_images(id,storage_path,alt_text,position)').order('updated_at', { ascending: false });
  return error ? context.json({ error: 'PRODUCTS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.post('/admin/products', zValidator('json', productWriteSchema), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const input = context.req.valid('json'); const { data: product, error } = await createAdminClient(context.env).rpc('admin_upsert_product', { p_product_id: null, p_payload: input });
  if (error || !product) return context.json({ error: 'PRODUCT_CREATE_FAILED' }, 422);
  await audit(context, admin, 'create', 'product', product.id, null, { name: product.name, slug: product.slug, variants: input.variants.length }); return context.json({ data: product }, 201);
});
app.put('/admin/products/:id', zValidator('json', productWriteSchema), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401); const id = z.string().uuid().safeParse(context.req.param('id')); if (!id.success) return context.json({ error: 'INVALID_PRODUCT' }, 422);
  const input = context.req.valid('json'); const database = createAdminClient(context.env); const { data: old } = await database.from('products').select('*').eq('id', id.data).maybeSingle(); if (!old) return context.json({ error: 'PRODUCT_NOT_FOUND' }, 404);
  const { data: product, error } = await database.rpc('admin_upsert_product', { p_product_id: id.data, p_payload: input });
  if (error || !product) return context.json({ error: 'PRODUCT_UPDATE_FAILED' }, 422);
  await audit(context, admin, 'update', 'product', id.data, old, { name: product.name, status: product.status, variants: input.variants.length }); return context.json({ data: product });
});
app.delete('/admin/products/:id', async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const id = z.string().uuid().safeParse(context.req.param('id')); if (!id.success) return context.json({ error: 'INVALID_PRODUCT' }, 422);
  const database = createAdminClient(context.env);
  const { data: old } = await database.from('products').select('id,name,status').eq('id', id.data).maybeSingle();
  if (!old) return context.json({ error: 'PRODUCT_NOT_FOUND' }, 404);
  const { data, error } = await database.from('products').update({ status: 'archived' }).eq('id', id.data).select('id,name,status').single();
  if (error) return context.json({ error: 'PRODUCT_ARCHIVE_FAILED' }, 422);
  await audit(context, admin, 'archive', 'product', id.data, old, data);
  return context.json({ data });
});
app.get('/admin/orders', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('orders').select('*,order_items(*),order_status_history(*)').order('created_at', { ascending: false }).limit(100);
  return error ? context.json({ error: 'ORDERS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.put('/admin/orders/:id/status', zValidator('json', z.object({ orderStatus: orderStatusSchema, fulfillmentStatus: z.enum(['unfulfilled', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled']).optional(), note: z.string().trim().max(500).optional() })), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401); const id = z.string().uuid().safeParse(context.req.param('id')); if (!id.success) return context.json({ error: 'INVALID_ORDER' }, 422); const database = createAdminClient(context.env); const { data: old } = await database.from('orders').select('id,order_status,fulfillment_status').eq('id', id.data).maybeSingle(); if (!old) return context.json({ error: 'ORDER_NOT_FOUND' }, 404); const input = context.req.valid('json'); if (old.order_status !== input.orderStatus && !canTransitionOrder(old.order_status, input.orderStatus)) return context.json({ error: 'INVALID_ORDER_TRANSITION' }, 422);
  const { data, error } = await database.from('orders').update({ order_status: input.orderStatus, ...(input.fulfillmentStatus ? { fulfillment_status: input.fulfillmentStatus } : {}) }).eq('id', id.data).select().single(); if (error) return context.json({ error: 'ORDER_UPDATE_FAILED' }, 422); if (old.order_status !== input.orderStatus) await database.from('order_status_history').insert({ order_id: id.data, from_status: old.order_status, to_status: input.orderStatus, actor_id: admin.id, note: input.note ?? null }); await audit(context, admin, 'update_status', 'order', id.data, old, data); return context.json({ data });
});
app.get('/admin/inventory', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('inventory').select('*,product_variants(id,sku,label,products(name))').order('updated_at', { ascending: false });
  return error ? context.json({ error: 'INVENTORY_UNAVAILABLE' }, 503) : context.json({ data });
});
app.post('/admin/inventory/adjustments', zValidator('json', z.object({ variantId: z.string().uuid(), deltaAvailable: z.number().int().refine((value) => value !== 0), reason: z.string().trim().min(3).max(160), note: z.string().trim().max(300).optional() })), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401); const input = context.req.valid('json'); const database = createAdminClient(context.env); const { data, error } = await database.rpc('adjust_inventory', { p_variant_id: input.variantId, p_delta_available: input.deltaAvailable, p_reason: input.reason, p_actor_id: admin.id, p_note: input.note ?? null }); if (error) return context.json({ error: 'INVENTORY_ADJUSTMENT_FAILED' }, 422); await audit(context, admin, 'adjust', 'inventory', input.variantId, null, { deltaAvailable: input.deltaAvailable, reason: input.reason }); return context.json({ data });
});
app.get('/admin/coupons', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('coupons').select('*').order('created_at', { ascending: false });
  return error ? context.json({ error: 'COUPONS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.post('/admin/coupons', zValidator('json', couponSchema), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401); const input = context.req.valid('json'); const { data, error } = await createAdminClient(context.env).from('coupons').insert({ code: input.code, type: input.type, value: input.value, minimum_subtotal_clp: input.minimumSubtotalClp, usage_limit: input.usageLimit ?? null, per_customer_limit: input.perCustomerLimit ?? null, requires_account: input.requiresAccount, allowed_weekdays: input.allowedWeekdays ?? null, starts_at: input.startsAt ?? null, ends_at: input.endsAt ?? null, active: input.active }).select().single(); if (error) return context.json({ error: 'COUPON_CREATE_FAILED' }, 422); await audit(context, admin, 'create', 'coupon', data.id, null, data); return context.json({ data }, 201);
});
app.put('/admin/coupons/:id', zValidator('json', couponSchema), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401); const id = z.string().uuid().safeParse(context.req.param('id')); if (!id.success) return context.json({ error: 'INVALID_COUPON' }, 422); const input = context.req.valid('json'); const database = createAdminClient(context.env); const { data: old } = await database.from('coupons').select('*').eq('id', id.data).maybeSingle(); if (!old) return context.json({ error: 'COUPON_NOT_FOUND' }, 404); const { data, error } = await database.from('coupons').update({ code: input.code, type: input.type, value: input.value, minimum_subtotal_clp: input.minimumSubtotalClp, usage_limit: input.usageLimit ?? null, per_customer_limit: input.perCustomerLimit ?? null, requires_account: input.requiresAccount, allowed_weekdays: input.allowedWeekdays ?? null, starts_at: input.startsAt ?? null, ends_at: input.endsAt ?? null, active: input.active }).eq('id', id.data).select().single(); if (error) return context.json({ error: 'COUPON_UPDATE_FAILED' }, 422); await audit(context, admin, 'update', 'coupon', id.data, old, data); return context.json({ data });
});
app.get('/admin/campaigns', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('campaigns').select('*').order('priority', { ascending: false });
  return error ? context.json({ error: 'CAMPAIGNS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.post('/admin/campaigns', zValidator('json', campaignSchema), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const input = context.req.valid('json');
  const { data, error } = await createAdminClient(context.env).from('campaigns').insert({
    placement: input.placement, title: input.title, body: input.body ?? null, image_path: input.imagePath ?? null,
    link_url: input.linkUrl ?? null, starts_at: input.startsAt ?? null, ends_at: input.endsAt ?? null,
    priority: input.priority, image_contains_copy: input.imageContainsCopy, active: input.active,
  }).select().single();
  if (error) return context.json({ error: 'CAMPAIGN_CREATE_FAILED' }, 422); await audit(context, admin, 'create', 'campaign', data.id, null, data); return context.json({ data }, 201);
});
app.post('/admin/campaign-assets', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const form = await context.req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) return context.json({ error: 'INVALID_ASSET' }, 422);
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) return context.json({ error: 'UNSUPPORTED_ASSET_TYPE' }, 422);
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `hero/${crypto.randomUUID()}.${extension}`;
  const database = createAdminClient(context.env);
  const { error } = await database.storage.from('campaign-assets').upload(path, file, { contentType: file.type, upsert: false });
  if (error) return context.json({ error: 'ASSET_UPLOAD_FAILED' }, 422);
  const { data } = database.storage.from('campaign-assets').getPublicUrl(path);
  return context.json({ data: { path, publicUrl: data.publicUrl } }, 201);
});
app.put('/admin/campaigns/:id', zValidator('json', campaignSchema.partial()), async (context) => {
  const admin = await requireAdmin(context); if (!admin) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const id = z.string().uuid().safeParse(context.req.param('id'));
  if (!id.success) return context.json({ error: 'INVALID_CAMPAIGN' }, 422);
  const input = context.req.valid('json');
  const update = {
    ...(input.placement ? { placement: input.placement } : {}), ...(input.title ? { title: input.title } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}), ...(input.imagePath !== undefined ? { image_path: input.imagePath } : {}),
    ...(input.linkUrl !== undefined ? { link_url: input.linkUrl } : {}), ...(input.startsAt !== undefined ? { starts_at: input.startsAt } : {}),
    ...(input.endsAt !== undefined ? { ends_at: input.endsAt } : {}), ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.imageContainsCopy !== undefined ? { image_contains_copy: input.imageContainsCopy } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };
  const database = createAdminClient(context.env); const { data: old } = await database.from('campaigns').select('*').eq('id', id.data).maybeSingle();
  const { data, error } = await database.from('campaigns').update(update).eq('id', id.data).select().single();
  if (error) return context.json({ error: 'CAMPAIGN_UPDATE_FAILED' }, 422); await audit(context, admin, 'update', 'campaign', id.data, old, data); return context.json({ data });
});
app.get('/admin/delivery-zones', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('delivery_zones').select('*').order('commune');
  return error ? context.json({ error: 'DELIVERY_ZONES_UNAVAILABLE' }, 503) : context.json({ data });
});
app.post('/admin/delivery-zones', zValidator('json', deliveryZoneSchema), async (context) => {
  const admin = await requireOwner(context); if (!admin) return context.json({ error: 'FORBIDDEN' }, 403); const input = context.req.valid('json'); const { data, error } = await createAdminClient(context.env).from('delivery_zones').insert({ region: input.region, commune: input.commune, fee_clp: input.feeClp, minimum_order_clp: input.minimumOrderClp, free_shipping_threshold_clp: input.freeShippingThresholdClp ?? null, active: input.active }).select().single(); if (error) return context.json({ error: 'DELIVERY_ZONE_CREATE_FAILED' }, 422); await audit(context, admin, 'create', 'delivery_zone', data.id, null, data); return context.json({ data }, 201);
});
app.put('/admin/delivery-zones/:id', zValidator('json', deliveryZoneSchema), async (context) => {
  const admin = await requireOwner(context); if (!admin) return context.json({ error: 'FORBIDDEN' }, 403); const id = z.string().uuid().safeParse(context.req.param('id')); if (!id.success) return context.json({ error: 'INVALID_DELIVERY_ZONE' }, 422); const input = context.req.valid('json'); const database = createAdminClient(context.env); const { data: old } = await database.from('delivery_zones').select('*').eq('id', id.data).maybeSingle(); if (!old) return context.json({ error: 'DELIVERY_ZONE_NOT_FOUND' }, 404); const { data, error } = await database.from('delivery_zones').update({ region: input.region, commune: input.commune, fee_clp: input.feeClp, minimum_order_clp: input.minimumOrderClp, free_shipping_threshold_clp: input.freeShippingThresholdClp ?? null, active: input.active }).eq('id', id.data).select().single(); if (error) return context.json({ error: 'DELIVERY_ZONE_UPDATE_FAILED' }, 422); await audit(context, admin, 'update', 'delivery_zone', id.data, old, data); return context.json({ data });
});
app.get('/admin/settings', async (context) => {
  if (!await requireOwner(context)) return context.json({ error: 'FORBIDDEN' }, 403);
  const { data, error } = await createAdminClient(context.env).from('site_settings').select('*');
  return error ? context.json({ error: 'SETTINGS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.put('/admin/settings/:key', zValidator('json', z.object({ value: z.record(z.unknown()) })), async (context) => {
  const admin = await requireOwner(context); if (!admin) return context.json({ error: 'FORBIDDEN' }, 403); const key = z.string().regex(/^[a-z0-9_-]{2,80}$/).safeParse(context.req.param('key')); if (!key.success) return context.json({ error: 'INVALID_SETTING' }, 422); const database = createAdminClient(context.env); const { data: old } = await database.from('site_settings').select('*').eq('key', key.data).maybeSingle(); const { data, error } = await database.from('site_settings').upsert({ key: key.data, value: context.req.valid('json').value, updated_by: admin.id }).select().single(); if (error) return context.json({ error: 'SETTING_UPDATE_FAILED' }, 422); await audit(context, admin, 'update', 'site_setting', null, old, data); return context.json({ data });
});
app.get('/admin/members', async (context) => {
  if (!await requireOwner(context)) return context.json({ error: 'FORBIDDEN' }, 403);
  const { data, error } = await createAdminClient(context.env).from('admin_members').select('user_id,role,active,last_seen_at,created_at').order('created_at');
  return error ? context.json({ error: 'MEMBERS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.put('/admin/members/:userId', zValidator('json', z.object({ role: z.enum(['owner', 'operator']).optional(), active: z.boolean().optional() }).refine((input) => input.role !== undefined || input.active !== undefined)), async (context) => {
  const admin = await requireOwner(context); if (!admin) return context.json({ error: 'FORBIDDEN' }, 403); const userId = z.string().uuid().safeParse(context.req.param('userId')); if (!userId.success) return context.json({ error: 'INVALID_MEMBER' }, 422); if (userId.data === admin.id && context.req.valid('json').active === false) return context.json({ error: 'CANNOT_DISABLE_SELF' }, 422); const database = createAdminClient(context.env); const { data: old } = await database.from('admin_members').select('*').eq('user_id', userId.data).maybeSingle(); if (!old) return context.json({ error: 'MEMBER_NOT_FOUND' }, 404); const { data, error } = await database.from('admin_members').update(context.req.valid('json')).eq('user_id', userId.data).select().single(); if (error) return context.json({ error: 'MEMBER_UPDATE_FAILED' }, 422); await audit(context, admin, 'update', 'admin_member', userId.data, old, data); return context.json({ data });
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, execution: ExecutionContext) {
    execution.waitUntil(Promise.all([createAdminClient(env).rpc('expire_stock_reservations'), createAdminClient(env).rpc('dispatch_notification_outbox')]).then(() => undefined));
  },
};
