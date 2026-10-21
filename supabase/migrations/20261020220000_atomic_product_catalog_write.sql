-- Keep catalog writes atomic: a product, its categories, variants and initial
-- inventory must either all be saved or none of them be persisted.
create or replace function public.admin_upsert_product(p_product_id uuid, p_payload jsonb)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_product public.products;
  variant_payload jsonb;
  input_variant_id uuid;
  created_variant public.product_variants;
  submitted_variant_ids uuid[] := array[]::uuid[];
begin
  if p_product_id is null then
    insert into public.products(slug, name, brand, description, status, seo_title, seo_description)
    values (
      p_payload->>'slug', p_payload->>'name', nullif(p_payload->>'brand',''), p_payload->>'description',
      (p_payload->>'status')::public.product_status, nullif(p_payload->>'seoTitle',''), nullif(p_payload->>'seoDescription','')
    )
    returning * into saved_product;
  else
    update public.products
    set slug = p_payload->>'slug', name = p_payload->>'name', brand = nullif(p_payload->>'brand',''),
      description = p_payload->>'description', status = (p_payload->>'status')::public.product_status,
      seo_title = nullif(p_payload->>'seoTitle',''), seo_description = nullif(p_payload->>'seoDescription','')
    where id = p_product_id
    returning * into saved_product;
    if not found then raise exception 'Product not found'; end if;
  end if;

  delete from public.product_categories where product_id = saved_product.id;
  insert into public.product_categories(product_id, category_id)
  select saved_product.id, category_id
  from jsonb_array_elements_text(coalesce(p_payload->'categoryIds', '[]'::jsonb)) as selected(category_id_text)
  cross join lateral (select selected.category_id_text::uuid as category_id) ids;

  for variant_payload in select value from jsonb_array_elements(p_payload->'variants') loop
    input_variant_id := nullif(variant_payload->>'id','')::uuid;
    if input_variant_id is null then
      insert into public.product_variants(product_id, sku, barcode, label, unit_count, price_clp, compare_at_price_clp, active)
      values (
        saved_product.id, variant_payload->>'sku', nullif(variant_payload->>'barcode',''), variant_payload->>'label',
        coalesce((variant_payload->>'unitCount')::integer, 1), (variant_payload->>'priceClp')::integer,
        nullif(variant_payload->>'compareAtPriceClp','')::integer, coalesce((variant_payload->>'active')::boolean, true)
      ) returning * into created_variant;
      insert into public.inventory(variant_id, available_quantity, low_stock_threshold)
      values (created_variant.id, coalesce((variant_payload->>'availableQuantity')::integer, 0), coalesce((variant_payload->>'lowStockThreshold')::integer, 5));
      submitted_variant_ids := array_append(submitted_variant_ids, created_variant.id);
    else
      update public.product_variants
      set sku = variant_payload->>'sku', barcode = nullif(variant_payload->>'barcode',''), label = variant_payload->>'label',
        unit_count = coalesce((variant_payload->>'unitCount')::integer, 1), price_clp = (variant_payload->>'priceClp')::integer,
        compare_at_price_clp = nullif(variant_payload->>'compareAtPriceClp','')::integer,
        active = coalesce((variant_payload->>'active')::boolean, true)
      where id = input_variant_id and product_id = saved_product.id;
      if not found then raise exception 'Variant does not belong to this product'; end if;
      submitted_variant_ids := array_append(submitted_variant_ids, input_variant_id);
    end if;
  end loop;

  -- Historical order lines keep their snapshots. Removed variants are archived,
  -- never physically deleted.
  update public.product_variants
  set active = false
  where product_id = saved_product.id
    and not (id = any(submitted_variant_ids));

  return saved_product;
end;
$$;

revoke all on function public.admin_upsert_product(uuid,jsonb) from public;
grant execute on function public.admin_upsert_product(uuid,jsonb) to service_role;
