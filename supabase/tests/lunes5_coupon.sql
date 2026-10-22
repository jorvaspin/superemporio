-- Verifies the account and weekday rules of the recurring LUNES5 campaign.
-- All temporary changes are rolled back.
begin;

do $$
declare
  variant_id uuid;
  quote jsonb;
  customer_id uuid := gen_random_uuid();
  today smallint := extract(isodow from timezone('America/Santiago', now()))::smallint;
  another_day smallint := (today % 7) + 1;
begin
  if not exists (
    select 1 from public.coupons
    where code = 'LUNES5'
      and type = 'percentage'
      and value = 5
      and requires_account
      and per_customer_limit = 1
  ) then
    raise exception 'LUNES5_CONFIGURATION_INVALID';
  end if;

  select variant.id into variant_id
  from public.product_variants variant
  join public.inventory inventory on inventory.variant_id = variant.id
  where variant.active and inventory.available_quantity - inventory.reserved_quantity > 0
  limit 1;

  update public.coupons set allowed_weekdays = array[today] where code = 'LUNES5';
  quote := public.quote_checkout_for_customer(
    jsonb_build_array(jsonb_build_object('variantId', variant_id, 'quantity', 1)),
    null, 'LUNES5', 'guest@superemporio.cl', null
  );
  if quote->>'couponStatus' <> 'account_required' then
    raise exception 'LUNES5_GUEST_RULE_FAILED:%', quote;
  end if;

  quote := public.quote_checkout_for_customer(
    jsonb_build_array(jsonb_build_object('variantId', variant_id, 'quantity', 1)),
    null, 'LUNES5', 'customer@superemporio.cl', customer_id
  );
  if quote->>'couponStatus' <> 'applied' or (quote->>'discountClp')::integer <= 0 then
    raise exception 'LUNES5_REGISTERED_RULE_FAILED:%', quote;
  end if;

  update public.coupons set allowed_weekdays = array[another_day] where code = 'LUNES5';
  quote := public.quote_checkout_for_customer(
    jsonb_build_array(jsonb_build_object('variantId', variant_id, 'quantity', 1)),
    null, 'LUNES5', 'customer@superemporio.cl', customer_id
  );
  if quote->>'couponStatus' <> 'weekday_restricted' then
    raise exception 'LUNES5_WEEKDAY_RULE_FAILED:%', quote;
  end if;
end;
$$;

rollback;
