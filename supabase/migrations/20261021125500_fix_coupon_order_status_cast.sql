create or replace function public.create_checkout_order(
  p_items jsonb,
  p_checkout jsonb,
  p_channel public.sales_channel default 'web',
  p_cart_token text default null
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

  quote := public.quote_checkout(
    p_items,
    nullif(p_checkout->>'commune', ''),
    requested_code,
    nullif(p_checkout->>'email', '')
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
    '', auth.uid(), p_channel,
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
      coupon_row.id, order_row.id, auth.uid(), order_row.contact_email, coupon_row.code,
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

revoke all on function public.create_checkout_order(jsonb,jsonb,public.sales_channel,text) from public, anon, authenticated;
grant execute on function public.create_checkout_order(jsonb,jsonb,public.sales_channel,text) to service_role;
