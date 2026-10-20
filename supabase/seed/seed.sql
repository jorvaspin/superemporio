insert into public.categories (id,slug,name,description,sort_order) values
('1d4b4f9b-5dc2-4f8b-9e1c-2ec001000001','papel-y-cocina','Papel y cocina','Lo esencial para cada día.',1),
('1d4b4f9b-5dc2-4f8b-9e1c-2ec001000002','limpieza','Limpieza','Hogar limpio, compra inteligente.',2),
('1d4b4f9b-5dc2-4f8b-9e1c-2ec001000003','aseo-personal','Aseo personal','Cuidado diario para tu familia.',3)
on conflict (slug) do nothing;
insert into public.delivery_zones (commune,fee_clp,minimum_order_clp,free_shipping_threshold_clp) values ('Ñuñoa',2990,5000,30000),('Macul',2990,5000,30000),('La Florida',3490,5000,35000),('Providencia',2990,5000,30000) on conflict(commune) do nothing;
insert into public.pickup_points (name,region,commune,street,instructions,opening_hours) values ('Retiro Superemporio','Metropolitana de Santiago','Ñuñoa','Dirección por confirmar','Coordinaremos tu horario por WhatsApp.','Lunes a sábado, con coordinación previa');
insert into public.site_settings (key,value) values ('store',jsonb_build_object('name','Superemporio','currency','CLP','whatsapp','56900000000')) on conflict(key) do nothing;

insert into public.products (id,slug,name,brand,description,status) values
('3275d0e8-8cf2-4f06-84af-7205f32ac001','papel-higienico-nova-clasico','Papel Higiénico Nova Clásico','Nova','Suavidad y rendimiento para resolver el día a día de tu hogar.','active'),
('8a7d7b12-a60f-4d44-acb0-e4c7b85cc002','lavalozas-quix-limon','Lavalozas Quix Limón','Quix','Fórmula concentrada para una limpieza efectiva y fresca.','active'),
('900c7a12-a60f-4d44-acb0-e4c7b85cc003','toalla-de-papel-nova','Toalla de Papel Nova','Nova','Alta absorción para la cocina y toda la casa.','active'),
('aa0c7a12-a60f-4d44-acb0-e4c7b85cc004','jabon-liquido-dove','Jabón Líquido Dove','Dove','Cuidado suave y humectación para manos de toda la familia.','active')
on conflict(slug) do nothing;
insert into public.product_categories(product_id,category_id) select p.id,c.id from public.products p join public.categories c on (p.slug='papel-higienico-nova-clasico' and c.slug='papel-y-cocina') or (p.slug='lavalozas-quix-limon' and c.slug='limpieza') or (p.slug='toalla-de-papel-nova' and c.slug='papel-y-cocina') or (p.slug='jabon-liquido-dove' and c.slug='aseo-personal') on conflict do nothing;
insert into public.product_variants(id,product_id,sku,label,unit_count,price_clp,compare_at_price_clp) values
('3275d0e8-8cf2-4f06-84af-7205f32ac101','3275d0e8-8cf2-4f06-84af-7205f32ac001','NOVA-CLAS-4','Pack 4 rollos',4,2390,2790),
('3275d0e8-8cf2-4f06-84af-7205f32ac102','3275d0e8-8cf2-4f06-84af-7205f32ac001','NOVA-CLAS-12','Pack 12 rollos',12,6290,7490),
('8a7d7b12-a60f-4d44-acb0-e4c7b85cc201','8a7d7b12-a60f-4d44-acb0-e4c7b85cc002','QUIX-LIM-750','Botella 750 ml',1,2190,2490),
('8a7d7b12-a60f-4d44-acb0-e4c7b85cc202','8a7d7b12-a60f-4d44-acb0-e4c7b85cc002','QUIX-LIM-1500','Botella 1,5 L',1,3790,4290),
('900c7a12-a60f-4d44-acb0-e4c7b85cc301','900c7a12-a60f-4d44-acb0-e4c7b85cc003','NOVA-TOP-2','Pack 2 rollos',2,2290,null),
('900c7a12-a60f-4d44-acb0-e4c7b85cc302','900c7a12-a60f-4d44-acb0-e4c7b85cc003','NOVA-TOP-6','Pack 6 rollos',6,5590,6290),
('aa0c7a12-a60f-4d44-acb0-e4c7b85cc401','aa0c7a12-a60f-4d44-acb0-e4c7b85cc004','DOVE-JAB-250','Botella 250 ml',1,2890,null)
on conflict(sku) do nothing;
insert into public.inventory(variant_id,available_quantity,low_stock_threshold) values
('3275d0e8-8cf2-4f06-84af-7205f32ac101',38,5),('3275d0e8-8cf2-4f06-84af-7205f32ac102',21,5),('8a7d7b12-a60f-4d44-acb0-e4c7b85cc201',44,5),('8a7d7b12-a60f-4d44-acb0-e4c7b85cc202',18,5),('900c7a12-a60f-4d44-acb0-e4c7b85cc301',30,5),('900c7a12-a60f-4d44-acb0-e4c7b85cc302',15,5),('aa0c7a12-a60f-4d44-acb0-e4c7b85cc401',26,5) on conflict(variant_id) do nothing;
