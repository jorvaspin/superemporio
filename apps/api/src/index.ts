import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { cartItemSchema, checkoutSchema } from '@superemporio/validation';
import { z } from 'zod';
import { createAdminClient, createPublicClient } from './lib/supabase';
import { createFlowPayment, getFlowPaymentStatus } from './lib/flow';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>().basePath('/v1');
type ApiContext = Context<{ Bindings: Env }>;
app.use('*', cors({ origin: (origin, context) => [context.env.PUBLIC_STORE_URL, context.env.PUBLIC_ADMIN_URL].includes(origin) ? origin : context.env.PUBLIC_STORE_URL, credentials: true }));
app.get('/health', (context) => context.json({ ok: true, service: 'superemporio-api' }));

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
async function requireAdmin(context: ApiContext) {
  const bearer = context.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer) return null;
  const auth = createPublicClient(context.env); const { data: userResult } = await auth.auth.getUser(bearer);
  if (!userResult.user) return null;
  const database = createAdminClient(context.env); const { data: membership } = await database.from('admin_members').select('role,active').eq('user_id', userResult.user.id).maybeSingle();
  return membership?.active ? { id: userResult.user.id, role: membership.role } : null;
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

const campaignPlacementSchema = z.enum(['announcement', 'hero', 'banner', 'modal']);
const campaignSchema = z.object({
  placement: campaignPlacementSchema,
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().max(600).nullable().optional(),
  imagePath: z.string().trim().max(500).nullable().optional(),
  linkUrl: z.string().trim().max(500).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(-100).max(100).default(0),
  active: z.boolean().default(true),
});

app.get('/content/campaigns', async (context) => {
  const placement = context.req.query('placement');
  const validatedPlacement = placement ? campaignPlacementSchema.safeParse(placement) : null;
  if (validatedPlacement && !validatedPlacement.success) return context.json({ error: 'INVALID_PLACEMENT' }, 422);
  const { data, error } = await createPublicClient(context.env).from('campaigns').select('id,placement,title,body,image_path,link_url,starts_at,ends_at,priority').order('priority', { ascending: false });
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
app.post('/checkout/quote', zValidator('json', z.object({ items: z.array(cartItemSchema).min(1), commune: z.string().optional(), couponCode: z.string().optional() })), async (context) => {
  const database = createAdminClient(context.env);
  const { data, error } = await database.rpc('quote_checkout', { p_items: context.req.valid('json').items, p_commune: context.req.valid('json').commune ?? null, p_coupon_code: context.req.valid('json').couponCode ?? null });
  if (error) return context.json({ error: 'QUOTE_UNAVAILABLE' }, 422);
  return context.json({ data });
});
app.post('/orders', zValidator('json', z.object({ cart: cartSchema, checkout: checkoutSchema, channel: z.enum(['web', 'whatsapp']).default('web') })), async (context) => {
  const input = context.req.valid('json'); const database = createAdminClient(context.env);
  const { data, error } = await database.rpc('create_checkout_order', { p_items: input.cart.items, p_checkout: input.checkout, p_channel: input.channel, p_cart_token: input.cart.cartToken ?? null });
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

app.get('/admin/products', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('products').select('*,product_variants(*,inventory(*))').order('updated_at', { ascending: false });
  return error ? context.json({ error: 'PRODUCTS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.post('/admin/products', zValidator('json', z.object({ name: z.string().min(3), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), brand: z.string().max(80), description: z.string().min(10) })), async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('products').insert({ ...context.req.valid('json'), status: 'draft' }).select().single();
  return error ? context.json({ error: 'PRODUCT_CREATE_FAILED' }, 422) : context.json({ data }, 201);
});
app.get('/admin/orders', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('orders').select('*,order_items(*)').order('created_at', { ascending: false }).limit(100);
  return error ? context.json({ error: 'ORDERS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.get('/admin/inventory', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('inventory').select('*,product_variants(sku,label,products(name))').order('updated_at', { ascending: false });
  return error ? context.json({ error: 'INVENTORY_UNAVAILABLE' }, 503) : context.json({ data });
});
app.get('/admin/coupons', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('coupons').select('*').order('created_at', { ascending: false });
  return error ? context.json({ error: 'COUPONS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.get('/admin/campaigns', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('campaigns').select('*').order('priority', { ascending: false });
  return error ? context.json({ error: 'CAMPAIGNS_UNAVAILABLE' }, 503) : context.json({ data });
});
app.post('/admin/campaigns', zValidator('json', campaignSchema), async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const input = context.req.valid('json');
  const { data, error } = await createAdminClient(context.env).from('campaigns').insert({
    placement: input.placement, title: input.title, body: input.body ?? null, image_path: input.imagePath ?? null,
    link_url: input.linkUrl ?? null, starts_at: input.startsAt ?? null, ends_at: input.endsAt ?? null,
    priority: input.priority, active: input.active,
  }).select().single();
  return error ? context.json({ error: 'CAMPAIGN_CREATE_FAILED' }, 422) : context.json({ data }, 201);
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
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const id = z.string().uuid().safeParse(context.req.param('id'));
  if (!id.success) return context.json({ error: 'INVALID_CAMPAIGN' }, 422);
  const input = context.req.valid('json');
  const update = {
    ...(input.placement ? { placement: input.placement } : {}), ...(input.title ? { title: input.title } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}), ...(input.imagePath !== undefined ? { image_path: input.imagePath } : {}),
    ...(input.linkUrl !== undefined ? { link_url: input.linkUrl } : {}), ...(input.startsAt !== undefined ? { starts_at: input.startsAt } : {}),
    ...(input.endsAt !== undefined ? { ends_at: input.endsAt } : {}), ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };
  const { data, error } = await createAdminClient(context.env).from('campaigns').update(update).eq('id', id.data).select().single();
  return error ? context.json({ error: 'CAMPAIGN_UPDATE_FAILED' }, 422) : context.json({ data });
});
app.get('/admin/settings', async (context) => {
  if (!await requireAdmin(context)) return context.json({ error: 'UNAUTHORIZED' }, 401);
  const { data, error } = await createAdminClient(context.env).from('site_settings').select('*');
  return error ? context.json({ error: 'SETTINGS_UNAVAILABLE' }, 503) : context.json({ data });
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, execution: ExecutionContext) {
    execution.waitUntil(Promise.all([createAdminClient(env).rpc('expire_stock_reservations'), createAdminClient(env).rpc('dispatch_notification_outbox')]).then(() => undefined));
  },
};
