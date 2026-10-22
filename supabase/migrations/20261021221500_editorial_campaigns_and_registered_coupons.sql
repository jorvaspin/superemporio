alter table public.campaigns
  add column if not exists image_contains_copy boolean not null default false;

alter table public.coupons
  add column if not exists requires_account boolean not null default false,
  add column if not exists allowed_weekdays smallint[];

alter table public.coupons
  drop constraint if exists coupons_allowed_weekdays_valid,
  add constraint coupons_allowed_weekdays_valid check (
    allowed_weekdays is null
    or allowed_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
  );

insert into public.coupons (
  id, code, type, value, minimum_subtotal_clp, usage_limit,
  per_customer_limit, requires_account, allowed_weekdays, active
) values (
  'd1600001-a60f-4d44-acb0-e4c7b85cc021', 'LUNES5', 'percentage', 5, 0, null,
  1, true, array[1]::smallint[], true
)
on conflict (code) do update set
  type = excluded.type,
  value = excluded.value,
  minimum_subtotal_clp = excluded.minimum_subtotal_clp,
  usage_limit = excluded.usage_limit,
  per_customer_limit = excluded.per_customer_limit,
  requires_account = excluded.requires_account,
  allowed_weekdays = excluded.allowed_weekdays,
  active = excluded.active,
  updated_at = timezone('utc', now());

update public.campaigns
set title = 'Toalla de Papel Nova · Pack 2 rollos · $2.290',
    body = 'Precio especial en un esencial para tu hogar.',
    image_path = '/campaigns/home-2026-editorial/hero-nova-precio.webp',
    link_url = '/productos/toalla-de-papel-nova',
    image_contains_copy = true,
    updated_at = timezone('utc', now())
where id = 'd1400001-a60f-4d44-acb0-e4c7b85cc001';

update public.campaigns
set title = 'Lunes de ahorro · 5% con LUNES5',
    body = 'Exclusivo para clientes registrados. Un uso por cuenta y válido solo los lunes.',
    image_path = '/campaigns/home-2026-editorial/banner-lunes5.webp',
    link_url = '/catalogo',
    image_contains_copy = true,
    updated_at = timezone('utc', now())
where id = 'd1500001-a60f-4d44-acb0-e4c7b85cc011';

create or replace function public.quote_checkout_for_customer(
  p_items jsonb,
  p_commune text default null,
  p_coupon_code text default null,
  p_email text default null,
  p_customer_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  variant record;
  coupon public.coupons;
  zone public.delivery_zones;
  subtotal integer := 0;
  discount integer := 0;
  shipping integer := 0;
  redemption_count integer := 0;
  requested_code text := nullif(upper(trim(p_coupon_code)), '');
  coupon_status text := 'none';
  coupon_message text := null;
  current_weekday smallint := extract(isodow from timezone('America/Santiago', now()))::smallint;
begin
  for item in
    select * from jsonb_to_recordset(p_items) as x("variantId" uuid, quantity integer)
  loop
    select pv.*, inventory.available_quantity, inventory.reserved_quantity
      into variant
    from public.product_variants pv
    join public.products product on product.id = pv.product_id
    join public.inventory inventory on inventory.variant_id = pv.id
    where pv.id = item."variantId"
      and product.status = 'active'
      and pv.active;

    if not found or item.quantity < 1 or item.quantity > (variant.available_quantity - variant.reserved_quantity) then
      raise exception 'VARIANT_UNAVAILABLE';
    end if;
    subtotal := subtotal + variant.price_clp * item.quantity;
  end loop;

  if nullif(trim(p_commune), '') is not null then
    select * into zone
    from public.delivery_zones
    where commune = trim(p_commune) and active;
    if not found then raise exception 'DELIVERY_ZONE_UNAVAILABLE'; end if;
    if subtotal < zone.minimum_order_clp then raise exception 'MINIMUM_ORDER_NOT_REACHED'; end if;
    shipping := case
      when zone.free_shipping_threshold_clp is not null and subtotal >= zone.free_shipping_threshold_clp then 0
      else zone.fee_clp
    end;
  end if;

  if requested_code is not null then
    select * into coupon from public.coupons where code = requested_code;
    if not found or not coupon.active or (coupon.starts_at is not null and coupon.starts_at > now()) or (coupon.ends_at is not null and coupon.ends_at <= now()) then
      coupon_status := 'invalid';
      coupon_message := 'El cupón no existe o no está vigente.';
    elsif coupon.requires_account and p_customer_id is null then
      coupon_status := 'account_required';
      coupon_message := 'Inicia sesión para usar este cupón.';
    elsif coupon.allowed_weekdays is not null and array_length(coupon.allowed_weekdays, 1) > 0 and not (current_weekday = any(coupon.allowed_weekdays)) then
      coupon_status := 'weekday_restricted';
      coupon_message := 'El cupón ' || coupon.code || ' solo se puede usar los lunes.';
    elsif subtotal < coupon.minimum_subtotal_clp then
      coupon_status := 'minimum_not_reached';
      coupon_message := 'Este cupón requiere una compra mínima de ' || coupon.minimum_subtotal_clp::text || ' CLP.';
    else
      select count(*)::integer into redemption_count
      from public.coupon_redemptions redemption
      join public.orders orders on orders.id = redemption.order_id
      where redemption.coupon_id = coupon.id
        and orders.order_status not in ('cancelled', 'expired');

      if coupon.usage_limit is not null and redemption_count >= coupon.usage_limit then
        coupon_status := 'usage_limit_reached';
        coupon_message := 'Este cupón ya alcanzó su límite de usos.';
      else
        redemption_count := 0;
        if coupon.per_customer_limit is not null and p_customer_id is not null then
          select count(*)::integer into redemption_count
          from public.coupon_redemptions redemption
          join public.orders orders on orders.id = redemption.order_id
          where redemption.coupon_id = coupon.id
            and redemption.customer_id = p_customer_id
            and orders.order_status not in ('cancelled', 'expired');
        elsif coupon.per_customer_limit is not null and nullif(lower(trim(p_email)), '') is not null then
          select count(*)::integer into redemption_count
          from public.coupon_redemptions redemption
          join public.orders orders on orders.id = redemption.order_id
          where redemption.coupon_id = coupon.id
            and lower(redemption.email) = lower(trim(p_email))
            and orders.order_status not in ('cancelled', 'expired');
        end if;

        if coupon.per_customer_limit is not null and redemption_count >= coupon.per_customer_limit then
          coupon_status := 'customer_limit_reached';
          coupon_message := 'Ya utilizaste este cupón el máximo de veces permitido.';
        elsif coupon.type = 'free_shipping' and shipping = 0 then
          coupon_status := 'no_shipping_cost';
          coupon_message := 'Tu compra ya tiene despacho gratis o corresponde a retiro.';
        else
          discount := case coupon.type
            when 'fixed' then least(coupon.value, subtotal)
            when 'percentage' then least(subtotal, floor(subtotal * coupon.value / 100.0)::integer)
            when 'free_shipping' then shipping
            else 0
          end;
          coupon_status := 'applied';
          coupon_message := 'Cupón ' || coupon.code || ' aplicado correctamente.';
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'subtotalClp', subtotal,
    'discountClp', discount,
    'shippingClp', shipping,
    'grandTotalClp', greatest(0, subtotal - discount + shipping),
    'couponCode', case when coupon_status = 'applied' then coupon.code else null end,
    'couponApplied', coupon_status = 'applied',
    'couponStatus', coupon_status,
    'couponMessage', coupon_message
  );
end;
$$;

create or replace function public.create_checkout_order_for_customer(
  p_items jsonb,
  p_checkout jsonb,
  p_channel public.sales_channel default 'web',
  p_cart_token text default null,
  p_customer_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quote jsonb;
  order_row public.orders;
  coupon_row public.coupons;
  item record;
  variant record;
  expiry timestamptz;
  requested_code text := nullif(upper(trim(p_checkout->>'couponCode')), '');
begin
  if requested_code is not null then
    select * into coupon_row from public.coupons where code = requested_code for update;
  end if;

  quote := public.quote_checkout_for_customer(
    p_items,
    nullif(p_checkout->>'commune', ''),
    requested_code,
    nullif(p_checkout->>'email', ''),
    p_customer_id
  );

  if requested_code is not null and not coalesce((quote->>'couponApplied')::boolean, false) then
    raise exception 'COUPON_REJECTED:%', coalesce(quote->>'couponStatus', 'invalid');
  end if;

  expiry := now() + case when p_channel = 'whatsapp' then interval '2 hours' else interval '15 minutes' end;
  insert into public.orders(
    public_code, customer_id, channel, order_status, payment_status, fulfillment_status,
    fulfillment_method, coupon_code, contact_email, contact_phone, contact_first_name,
    contact_last_name, subtotal_clp, discount_clp, shipping_clp, grand_total_clp, notes
  ) values (
    '', p_customer_id, p_channel,
    (case when p_channel = 'whatsapp' then 'pending_manual' else 'pending_payment' end)::public.order_status,
    'unpaid', 'unfulfilled', (p_checkout->>'fulfillment')::public.fulfillment_method,
    quote->>'couponCode', p_checkout->>'email', p_checkout->>'phone',
    p_checkout->>'firstName', p_checkout->>'lastName',
    (quote->>'subtotalClp')::integer, (quote->>'discountClp')::integer,
    (quote->>'shippingClp')::integer, (quote->>'grandTotalClp')::integer,
    nullif(p_checkout->>'notes', '')
  ) returning * into order_row;

  for item in
    select * from jsonb_to_recordset(p_items) as x("variantId" uuid, quantity integer)
  loop
    select pv.*, product.name, inventory.available_quantity, inventory.reserved_quantity
      into variant
    from public.product_variants pv
    join public.products product on product.id = pv.product_id
    join public.inventory inventory on inventory.variant_id = pv.id
    where pv.id = item."variantId"
    for update of inventory;
    if not found or item.quantity > variant.available_quantity - variant.reserved_quantity then
      raise exception 'VARIANT_UNAVAILABLE';
    end if;
    insert into public.order_items(
      order_id, product_id, variant_id, sku_snapshot, product_name_snapshot,
      variant_label_snapshot, unit_price_clp, quantity, line_total_clp
    ) values (
      order_row.id, variant.product_id, variant.id, variant.sku, variant.name,
      variant.label, variant.price_clp, item.quantity, variant.price_clp * item.quantity
    );
    update public.inventory set reserved_quantity = reserved_quantity + item.quantity where variant_id = variant.id;
    insert into public.stock_reservations(order_id, variant_id, quantity, expires_at)
      values(order_row.id, variant.id, item.quantity, expiry);
    insert into public.inventory_movements(variant_id, delta_reserved, reason, reference_type, reference_id)
      values(variant.id, item.quantity, 'reservation', 'order', order_row.id);
  end loop;

  if p_checkout->>'fulfillment' = 'delivery' then
    insert into public.order_addresses(order_id, address_kind, region, commune, street, address_detail, reference)
    values(order_row.id, 'shipping', 'Metropolitana de Santiago', p_checkout->>'commune',
      p_checkout->>'address', p_checkout->>'addressDetail', p_checkout->>'reference');
  end if;

  insert into public.order_tax_details(order_id, document_type, rut, business_name, business_activity)
  values(order_row.id, coalesce((p_checkout->>'documentType')::public.document_type, 'receipt'),
    nullif(p_checkout->>'taxId', ''), nullif(p_checkout->>'businessName', ''),
    nullif(p_checkout->>'businessActivity', ''));

  if order_row.coupon_code is not null then
    insert into public.coupon_redemptions(
      coupon_id, order_id, customer_id, email, coupon_code_snapshot,
      coupon_type_snapshot, coupon_value_snapshot, discount_clp
    ) values (
      coupon_row.id, order_row.id, p_customer_id, order_row.contact_email, coupon_row.code,
      coupon_row.type, coupon_row.value, order_row.discount_clp
    );
  end if;

  insert into public.order_status_history(order_id, to_status, note)
    values(order_row.id, order_row.order_status, 'Order created');
  insert into public.notification_outbox(kind, recipient, payload)
    values('order_received', order_row.contact_email, jsonb_build_object('orderCode', order_row.public_code));

  return jsonb_build_object(
    'id', order_row.id,
    'publicCode', order_row.public_code,
    'expiresAt', expiry,
    'subtotalClp', order_row.subtotal_clp,
    'discountClp', order_row.discount_clp,
    'shippingClp', order_row.shipping_clp,
    'grandTotalClp', order_row.grand_total_clp,
    'couponCode', order_row.coupon_code
  );
end;
$$;

revoke all on function public.quote_checkout_for_customer(jsonb,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.create_checkout_order_for_customer(jsonb,jsonb,public.sales_channel,text,uuid) from public, anon, authenticated;
grant execute on function public.quote_checkout_for_customer(jsonb,text,text,text,uuid) to service_role;
grant execute on function public.create_checkout_order_for_customer(jsonb,jsonb,public.sales_channel,text,uuid) to service_role;
