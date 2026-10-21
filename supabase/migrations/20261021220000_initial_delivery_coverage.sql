-- Initial delivery coverage: a flat CLP 2,990 fee in three communes only.
delete from public.delivery_zones
where commune not in ('La Cisterna', 'San Miguel', 'La Granja');

insert into public.delivery_zones (
  region, commune, fee_clp, minimum_order_clp, free_shipping_threshold_clp, active
) values
  ('Metropolitana de Santiago', 'La Cisterna', 2990, 0, null, true),
  ('Metropolitana de Santiago', 'San Miguel', 2990, 0, null, true),
  ('Metropolitana de Santiago', 'La Granja', 2990, 0, null, true)
on conflict (commune) do update set
  region = excluded.region,
  fee_clp = excluded.fee_clp,
  minimum_order_clp = excluded.minimum_order_clp,
  free_shipping_threshold_clp = excluded.free_shipping_threshold_clp,
  active = excluded.active;
