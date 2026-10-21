-- Verifies server-side coupon calculation, order snapshots and redemption traceability.
-- The transaction is always rolled back, so it leaves no orders, reservations or coupons behind.
begin;

insert into public.coupons(code, type, value, minimum_subtotal_clp, active)
values ('TEST-CHECKOUT-10', 'percentage', 10, 0, true);

with chosen_variant as (
  select variant.id
  from public.product_variants variant
  join public.inventory inventory on inventory.variant_id = variant.id
  where variant.active and inventory.available_quantity - inventory.reserved_quantity > 0
  limit 1
)
select
  quote->>'couponStatus' as coupon_status,
  quote->>'couponCode' as coupon_code,
  (quote->>'discountClp')::integer > 0 as has_discount
from chosen_variant,
lateral public.quote_checkout(
  jsonb_build_array(jsonb_build_object('variantId', chosen_variant.id, 'quantity', 1)),
  null,
  'TEST-CHECKOUT-10',
  'checkout-test@superemporio.cl'
) quote;

with chosen_variant as (
  select variant.id
  from public.product_variants variant
  join public.inventory inventory on inventory.variant_id = variant.id
  where variant.active and inventory.available_quantity - inventory.reserved_quantity > 0
  limit 1
)
select public.create_checkout_order(
  jsonb_build_array(jsonb_build_object('variantId', chosen_variant.id, 'quantity', 1)),
  jsonb_build_object(
    'email', 'checkout-test@superemporio.cl',
    'firstName', 'Prueba',
    'lastName', 'Cupon',
    'phone', '+56912345678',
    'fulfillment', 'pickup',
    'couponCode', 'TEST-CHECKOUT-10',
    'documentType', 'receipt'
  ),
  'whatsapp',
  null
) as created_order
from chosen_variant;

select
  orders.coupon_code,
  orders.discount_clp,
  redemption.coupon_code_snapshot,
  redemption.coupon_type_snapshot,
  redemption.coupon_value_snapshot,
  redemption.discount_clp as redemption_discount_clp
from public.orders orders
join public.coupon_redemptions redemption on redemption.order_id = orders.id
where orders.contact_email = 'checkout-test@superemporio.cl';

rollback;
