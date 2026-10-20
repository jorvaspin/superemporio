-- Superemporio: source of truth for commerce data. Amounts are integer CLP.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.product_status as enum ('draft', 'active', 'archived');
create type public.order_status as enum ('draft', 'pending_payment', 'pending_manual', 'confirmed', 'preparing', 'ready', 'dispatched', 'completed', 'cancelled', 'expired');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.fulfillment_status as enum ('unfulfilled', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled');
create type public.reservation_status as enum ('active', 'committed', 'released', 'expired');
create type public.admin_role as enum ('owner', 'operator');
create type public.fulfillment_method as enum ('delivery', 'pickup');
create type public.sales_channel as enum ('web', 'whatsapp', 'admin');
create type public.document_type as enum ('receipt', 'invoice');
create type public.coupon_type as enum ('fixed', 'percentage', 'free_shipping');
create type public.campaign_placement as enum ('announcement', 'hero', 'banner', 'modal');

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = timezone('utc', now()); return new; end; $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.admin_members where user_id = auth.uid() and active = true); $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text, last_name text, phone text, marketing_opt_in boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null default 'operator', active boolean not null default true,
  last_seen_at timestamptz, created_at timestamptz not null default timezone('utc', now())
);
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Casa', region text not null, commune text not null, street text not null, address_detail text, reference text,
  is_default boolean not null default false, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), parent_id uuid references public.categories(id), slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null, description text, image_path text, sort_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.products (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), name text not null,
  brand text, description text not null, status public.product_status not null default 'draft', seo_title text, seo_description text,
  search_text text not null default '', created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.product_categories (product_id uuid not null references public.products(id) on delete restrict, category_id uuid not null references public.categories(id) on delete restrict, primary key(product_id, category_id));
create table public.product_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict,
  sku text not null unique, barcode text unique, label text not null, unit_count integer not null default 1 check (unit_count > 0),
  price_clp integer not null check (price_clp >= 0), compare_at_price_clp integer check (compare_at_price_clp is null or compare_at_price_clp >= price_clp),
  active boolean not null default true, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete restrict,
  available_quantity integer not null default 0 check (available_quantity >= 0), reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0), updated_at timestamptz not null default timezone('utc', now())
);
create table public.product_images (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict, variant_id uuid references public.product_variants(id) on delete restrict,
  storage_path text not null, width integer, height integer, alt_text text not null, position integer not null default 0, created_at timestamptz not null default timezone('utc', now())
);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.product_variants(id) on delete restrict,
  delta_available integer not null default 0, delta_reserved integer not null default 0, reason text not null, reference_type text, reference_id uuid,
  actor_id uuid references auth.users(id), created_at timestamptz not null default timezone('utc', now())
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(), region text not null default 'Metropolitana de Santiago', commune text not null unique,
  fee_clp integer not null default 0 check (fee_clp >= 0), minimum_order_clp integer not null default 0 check (minimum_order_clp >= 0),
  free_shipping_threshold_clp integer, active boolean not null default true, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.pickup_points (
  id uuid primary key default gen_random_uuid(), name text not null, region text not null, commune text not null, street text not null, instructions text, opening_hours text,
  active boolean not null default true, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(), code text not null unique, type public.coupon_type not null, value integer not null check(value >= 0),
  minimum_subtotal_clp integer not null default 0 check(minimum_subtotal_clp >= 0), usage_limit integer, per_customer_limit integer,
  starts_at timestamptz, ends_at timestamptz, active boolean not null default true, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  check ((type = 'percentage' and value between 1 and 100) or (type in ('fixed','free_shipping') and value >= 0))
);
create table public.coupon_products (coupon_id uuid not null references public.coupons(id) on delete cascade, product_id uuid not null references public.products(id) on delete restrict, primary key(coupon_id, product_id));
create table public.coupon_categories (coupon_id uuid not null references public.coupons(id) on delete cascade, category_id uuid not null references public.categories(id) on delete restrict, primary key(coupon_id, category_id));
create table public.campaigns (
  id uuid primary key default gen_random_uuid(), placement public.campaign_placement not null, title text not null, body text, image_path text, link_url text,
  starts_at timestamptz, ends_at timestamptz, priority integer not null default 0, active boolean not null default true, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.site_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default timezone('utc', now()), updated_by uuid references auth.users(id));

create table public.carts (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.profiles(id) on delete set null, token_hash text not null unique,
  status text not null default 'active' check(status in ('active','converted','abandoned')), expires_at timestamptz not null default timezone('utc', now()) + interval '30 days',
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.cart_items (cart_id uuid not null references public.carts(id) on delete cascade, variant_id uuid not null references public.product_variants(id) on delete restrict, quantity integer not null check(quantity > 0 and quantity <= 99), last_seen_price_clp integer not null check(last_seen_price_clp >= 0), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), primary key(cart_id, variant_id));

create sequence public.order_number_seq;
create table public.orders (
  id uuid primary key default gen_random_uuid(), public_code text not null unique, customer_id uuid references public.profiles(id) on delete set null,
  channel public.sales_channel not null default 'web', order_status public.order_status not null default 'draft', payment_status public.payment_status not null default 'unpaid', fulfillment_status public.fulfillment_status not null default 'unfulfilled',
  fulfillment_method public.fulfillment_method not null, coupon_code text, contact_email text not null, contact_phone text not null, contact_first_name text not null, contact_last_name text not null,
  subtotal_clp integer not null check(subtotal_clp >= 0), discount_clp integer not null default 0 check(discount_clp >= 0), shipping_clp integer not null default 0 check(shipping_clp >= 0), grand_total_clp integer not null check(grand_total_clp >= 0), notes text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict, product_id uuid references public.products(id) on delete set null, variant_id uuid references public.product_variants(id) on delete set null,
  sku_snapshot text not null, product_name_snapshot text not null, variant_label_snapshot text not null, unit_price_clp integer not null check(unit_price_clp >= 0), quantity integer not null check(quantity > 0), line_total_clp integer not null check(line_total_clp >= 0), created_at timestamptz not null default timezone('utc', now())
);
create table public.order_addresses (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete restrict, address_kind text not null check(address_kind in ('shipping','billing')),
  region text, commune text, street text, address_detail text, reference text, created_at timestamptz not null default timezone('utc', now())
);
create table public.order_tax_details (order_id uuid primary key references public.orders(id) on delete restrict, document_type public.document_type not null default 'receipt', rut text, business_name text, business_activity text, created_at timestamptz not null default timezone('utc', now()));
create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict, variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check(quantity > 0), status public.reservation_status not null default 'active', expires_at timestamptz not null, created_at timestamptz not null default timezone('utc', now()), resolved_at timestamptz,
  unique(order_id, variant_id)
);
create table public.order_status_history (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict, from_status public.order_status, to_status public.order_status not null, actor_id uuid references auth.users(id), note text, created_at timestamptz not null default timezone('utc', now()));
create table public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict, provider text not null, provider_payment_id text not null,
  amount_clp integer not null check(amount_clp >= 0), payment_status public.payment_status not null default 'pending', idempotency_key text unique, provider_response jsonb, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(provider, provider_payment_id)
);
create table public.payment_events (id uuid primary key default gen_random_uuid(), payment_id uuid references public.payments(id) on delete set null, provider text not null, provider_event_id text not null, payload jsonb, processed_at timestamptz, created_at timestamptz not null default timezone('utc', now()), unique(provider, provider_event_id));
create table public.refunds (id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id) on delete restrict, amount_clp integer not null check(amount_clp > 0), provider_refund_id text, status text not null default 'pending', reason text, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()));
create table public.coupon_redemptions (id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id) on delete restrict, order_id uuid not null unique references public.orders(id) on delete restrict, customer_id uuid references public.profiles(id) on delete set null, email text, created_at timestamptz not null default timezone('utc', now()));
create table public.notification_outbox (id uuid primary key default gen_random_uuid(), kind text not null, recipient text not null, payload jsonb not null, status text not null default 'pending' check(status in ('pending','sent','failed')), attempts integer not null default 0, next_attempt_at timestamptz not null default timezone('utc', now()), last_error text, created_at timestamptz not null default timezone('utc', now()), sent_at timestamptz);
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid, old_value jsonb, new_value jsonb, context jsonb, created_at timestamptz not null default timezone('utc', now()));

create or replace function public.set_order_public_code() returns trigger language plpgsql as $$ begin if new.public_code is null or new.public_code = '' then new.public_code := 'SE-' || to_char(timezone('America/Santiago', now()), 'YYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0'); end if; return new; end; $$;
create or replace function public.refresh_product_search() returns trigger language plpgsql as $$ begin new.search_text := lower(concat_ws(' ', new.name, new.brand, new.description)); return new; end; $$;

create trigger products_search before insert or update of name, brand, description on public.products for each row execute function public.refresh_product_search();
create trigger orders_code before insert on public.orders for each row execute function public.set_order_public_code();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger categories_updated before update on public.categories for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger variants_updated before update on public.product_variants for each row execute function public.set_updated_at();
create trigger delivery_updated before update on public.delivery_zones for each row execute function public.set_updated_at();
create trigger carts_updated before update on public.carts for each row execute function public.set_updated_at();
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_updated before update on public.payments for each row execute function public.set_updated_at();

create index products_status_idx on public.products(status); create index products_search_trgm_idx on public.products using gin(search_text gin_trgm_ops); create index variants_product_idx on public.product_variants(product_id); create index orders_status_created_idx on public.orders(order_status, created_at desc); create index orders_email_idx on public.orders(contact_email); create index reservations_expiry_idx on public.stock_reservations(status, expires_at); create index notifications_pending_idx on public.notification_outbox(status, next_attempt_at);

create or replace function public.search_products(search_query text) returns table(id uuid, slug text, name text, brand text, rank real) language sql stable as $$ select p.id,p.slug,p.name,p.brand,similarity(p.search_text,lower(search_query)) from public.products p where p.status='active' and (p.search_text % lower(search_query) or p.search_text like '%' || lower(search_query) || '%') order by similarity(p.search_text,lower(search_query)) desc, p.name limit 20; $$;

create or replace function public.quote_checkout(p_items jsonb, p_commune text default null, p_coupon_code text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare item record; variant record; subtotal integer := 0; discount integer := 0; shipping integer := 0; coupon record; zone record;
begin
  for item in select * from jsonb_to_recordset(p_items) as x("variantId" uuid, quantity integer) loop
    select pv.*, i.available_quantity, i.reserved_quantity into variant from product_variants pv join products p on p.id=pv.product_id join inventory i on i.variant_id=pv.id where pv.id=item."variantId" and p.status='active' and pv.active;
    if not found or item.quantity < 1 or item.quantity > (variant.available_quantity - variant.reserved_quantity) then raise exception 'Variant unavailable'; end if;
    subtotal := subtotal + variant.price_clp * item.quantity;
  end loop;
  if p_commune is not null then select * into zone from delivery_zones where commune = p_commune and active; if not found then raise exception 'Delivery zone unavailable'; end if; if subtotal < zone.minimum_order_clp then raise exception 'Minimum order not reached'; end if; shipping := case when zone.free_shipping_threshold_clp is not null and subtotal >= zone.free_shipping_threshold_clp then 0 else zone.fee_clp end; end if;
  if p_coupon_code is not null then select * into coupon from coupons where code=upper(p_coupon_code) and active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()); if found and subtotal >= coupon.minimum_subtotal_clp then discount := case coupon.type when 'fixed' then least(coupon.value,subtotal) when 'percentage' then floor(subtotal*coupon.value/100.0)::integer when 'free_shipping' then shipping else 0 end; end if; end if;
  return jsonb_build_object('subtotalClp',subtotal,'discountClp',discount,'shippingClp',shipping,'grandTotalClp',greatest(0,subtotal-discount+shipping));
end; $$;

create or replace function public.create_checkout_order(p_items jsonb, p_checkout jsonb, p_channel public.sales_channel default 'web', p_cart_token text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare quote jsonb; order_row public.orders; item record; variant record; expiry timestamptz; discount integer; shipping integer;
begin
  quote := public.quote_checkout(p_items, nullif(p_checkout->>'commune',''), nullif(p_checkout->>'couponCode',''));
  expiry := now() + case when p_channel='whatsapp' then interval '2 hours' else interval '15 minutes' end;
  insert into orders(public_code,customer_id,channel,order_status,payment_status,fulfillment_status,fulfillment_method,coupon_code,contact_email,contact_phone,contact_first_name,contact_last_name,subtotal_clp,discount_clp,shipping_clp,grand_total_clp,notes)
  values('',auth.uid(),p_channel,case when p_channel='whatsapp' then 'pending_manual' else 'pending_payment' end,'unpaid','unfulfilled',(p_checkout->>'fulfillment')::fulfillment_method,nullif(p_checkout->>'couponCode',''),p_checkout->>'email',p_checkout->>'phone',p_checkout->>'firstName',p_checkout->>'lastName',(quote->>'subtotalClp')::integer,(quote->>'discountClp')::integer,(quote->>'shippingClp')::integer,(quote->>'grandTotalClp')::integer,nullif(p_checkout->>'notes','')) returning * into order_row;
  for item in select * from jsonb_to_recordset(p_items) as x("variantId" uuid, quantity integer) loop
    select pv.*,p.name,i.available_quantity,i.reserved_quantity into variant from product_variants pv join products p on p.id=pv.product_id join inventory i on i.variant_id=pv.id where pv.id=item."variantId" for update of i;
    if not found or item.quantity > variant.available_quantity-variant.reserved_quantity then raise exception 'Variant unavailable'; end if;
    insert into order_items(order_id,product_id,variant_id,sku_snapshot,product_name_snapshot,variant_label_snapshot,unit_price_clp,quantity,line_total_clp) values(order_row.id,variant.product_id,variant.id,variant.sku,variant.name,variant.label,variant.price_clp,item.quantity,variant.price_clp*item.quantity);
    update inventory set reserved_quantity=reserved_quantity+item.quantity where variant_id=variant.id;
    insert into stock_reservations(order_id,variant_id,quantity,expires_at) values(order_row.id,variant.id,item.quantity,expiry);
    insert into inventory_movements(variant_id,delta_reserved,reason,reference_type,reference_id) values(variant.id,item.quantity,'reservation','order',order_row.id);
  end loop;
  if p_checkout->>'fulfillment'='delivery' then insert into order_addresses(order_id,address_kind,region,commune,street,address_detail,reference) values(order_row.id,'shipping','Metropolitana de Santiago',p_checkout->>'commune',p_checkout->>'address',p_checkout->>'addressDetail',p_checkout->>'reference'); end if;
  insert into order_tax_details(order_id,document_type,rut,business_name,business_activity) values(order_row.id,coalesce((p_checkout->>'documentType')::document_type,'receipt'),nullif(p_checkout->>'taxId',''),nullif(p_checkout->>'businessName',''),nullif(p_checkout->>'businessActivity',''));
  if order_row.coupon_code is not null then select (quote->>'discountClp')::integer into discount; if discount > 0 then insert into coupon_redemptions(coupon_id,order_id,customer_id,email) select id,order_row.id,auth.uid(),order_row.contact_email from coupons where code=order_row.coupon_code; end if; end if;
  insert into order_status_history(order_id,to_status,note) values(order_row.id,order_row.order_status,'Order created');
  insert into notification_outbox(kind,recipient,payload) values('order_received',order_row.contact_email,jsonb_build_object('orderCode',order_row.public_code));
  return jsonb_build_object('id',order_row.id,'publicCode',order_row.public_code,'expiresAt',expiry,'grandTotalClp',order_row.grand_total_clp);
end; $$;

create or replace function public.record_flow_callback(p_token text,p_provider_status integer,p_provider_order text,p_paid boolean,p_amount integer) returns void language plpgsql security definer set search_path=public as $$
declare payment_row public.payments; reservation record;
begin
  select * into payment_row from payments where provider='flow' and provider_payment_id=p_token for update; if not found then raise exception 'Payment not found'; end if;
  insert into payment_events(payment_id,provider,provider_event_id,payload,processed_at) values(payment_row.id,'flow',p_token || ':' || p_provider_status,jsonb_build_object('status',p_provider_status,'order',p_provider_order,'amount',p_amount),now()) on conflict(provider,provider_event_id) do nothing;
  if p_paid and payment_row.payment_status <> 'paid' then
    update payments set payment_status='paid' where id=payment_row.id; update orders set payment_status='paid',order_status='confirmed' where id=payment_row.order_id;
    for reservation in select * from stock_reservations where order_id=payment_row.order_id and status='active' for update loop update inventory set available_quantity=available_quantity-reservation.quantity,reserved_quantity=reserved_quantity-reservation.quantity where variant_id=reservation.variant_id; update stock_reservations set status='committed',resolved_at=now() where id=reservation.id; insert into inventory_movements(variant_id,delta_available,delta_reserved,reason,reference_type,reference_id) values(reservation.variant_id,-reservation.quantity,-reservation.quantity,'sale','order',payment_row.order_id); end loop;
    insert into order_status_history(order_id,from_status,to_status,note) values(payment_row.order_id,'pending_payment','confirmed','Flow payment confirmed');
  elsif not p_paid then update payments set payment_status='failed' where id=payment_row.id and payment_status <> 'paid'; end if;
end; $$;

create or replace function public.expire_stock_reservations() returns integer language plpgsql security definer set search_path=public as $$
declare reservation record; total integer := 0;
begin
  for reservation in select * from stock_reservations where status='active' and expires_at < now() for update skip locked loop update inventory set reserved_quantity=greatest(0,reserved_quantity-reservation.quantity) where variant_id=reservation.variant_id; update stock_reservations set status='expired',resolved_at=now() where id=reservation.id; insert into inventory_movements(variant_id,delta_reserved,reason,reference_type,reference_id) values(reservation.variant_id,-reservation.quantity,'reservation_expired','order',reservation.order_id); total:=total+1; end loop;
  update orders set order_status='expired' where order_status in ('pending_payment','pending_manual') and not exists(select 1 from stock_reservations sr where sr.order_id=orders.id and sr.status='active'); return total;
end; $$;
create or replace function public.dispatch_notification_outbox() returns integer language sql security definer set search_path=public as $$ select count(*)::integer from notification_outbox where status='pending' and next_attempt_at <= now(); $$;

alter table public.profiles enable row level security; alter table public.customer_addresses enable row level security; alter table public.admin_members enable row level security; alter table public.categories enable row level security; alter table public.products enable row level security; alter table public.product_categories enable row level security; alter table public.product_variants enable row level security; alter table public.inventory enable row level security; alter table public.product_images enable row level security; alter table public.carts enable row level security; alter table public.cart_items enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.order_addresses enable row level security; alter table public.order_tax_details enable row level security; alter table public.stock_reservations enable row level security; alter table public.payments enable row level security; alter table public.coupons enable row level security; alter table public.campaigns enable row level security; alter table public.delivery_zones enable row level security; alter table public.pickup_points enable row level security; alter table public.audit_logs enable row level security;
create policy "public catalog categories" on public.categories for select using(active); create policy "public catalog products" on public.products for select using(status='active'); create policy "public catalog variants" on public.product_variants for select using(active); create policy "public catalog images" on public.product_images for select using(true); create policy "public catalog inventory" on public.inventory for select using(true); create policy "public campaigns" on public.campaigns for select using(active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())); create policy "public zones" on public.delivery_zones for select using(active); create policy "public pickup" on public.pickup_points for select using(active);
create policy "profiles own" on public.profiles for all using(id=auth.uid()) with check(id=auth.uid()); create policy "addresses own" on public.customer_addresses for all using(customer_id=auth.uid()) with check(customer_id=auth.uid()); create policy "orders own" on public.orders for select using(customer_id=auth.uid()); create policy "order items own" on public.order_items for select using(exists(select 1 from orders o where o.id=order_id and o.customer_id=auth.uid())); create policy "order details own" on public.order_addresses for select using(exists(select 1 from orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy "admin products" on public.products for all using(public.is_admin()) with check(public.is_admin()); create policy "admin categories" on public.categories for all using(public.is_admin()) with check(public.is_admin()); create policy "admin variants" on public.product_variants for all using(public.is_admin()) with check(public.is_admin()); create policy "admin inventory" on public.inventory for all using(public.is_admin()) with check(public.is_admin()); create policy "admin orders" on public.orders for all using(public.is_admin()) with check(public.is_admin()); create policy "admin payments" on public.payments for all using(public.is_admin()) with check(public.is_admin()); create policy "admin coupons" on public.coupons for all using(public.is_admin()) with check(public.is_admin()); create policy "admin campaigns" on public.campaigns for all using(public.is_admin()) with check(public.is_admin()); create policy "admin audit" on public.audit_logs for select using(public.is_admin());

revoke all on function public.quote_checkout(jsonb,text,text) from public;
revoke all on function public.create_checkout_order(jsonb,jsonb,public.sales_channel,text) from public;
revoke all on function public.record_flow_callback(text,integer,text,boolean,integer) from public;
grant execute on function public.quote_checkout(jsonb,text,text) to service_role;
grant execute on function public.create_checkout_order(jsonb,jsonb,public.sales_channel,text) to service_role;
grant execute on function public.record_flow_callback(text,integer,text,boolean,integer) to service_role;
