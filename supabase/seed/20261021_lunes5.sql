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
