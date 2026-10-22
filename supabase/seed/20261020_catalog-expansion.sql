-- Catálogo demostrativo ampliado para revisar el storefront y el administrador.
-- Estos artículos deben reemplazarse por el catálogo real antes del lanzamiento.
insert into public.products (id,slug,name,brand,description,status) values
('c1100001-a60f-4d44-acb0-e4c7b85cc001','papel-higienico-nova-max','Papel Higiénico Nova Max','Nova','Doble hoja y más metros para abastecer a toda la familia.','active'),
('c1100002-a60f-4d44-acb0-e4c7b85cc002','servilletas-nova-premium','Servilletas Nova Premium','Nova','Servilletas resistentes para tus comidas y reuniones.','active'),
('c1100003-a60f-4d44-acb0-e4c7b85cc003','bolsas-basura-resistentes-50l','Bolsas de Basura Resistentes 50 L','SuperHogar','Bolsas reforzadas con cierre práctico para el uso diario.','active'),
('c1200001-a60f-4d44-acb0-e4c7b85cc001','detergente-omo-liquido','Detergente OMO Líquido','OMO','Limpieza profunda para tu ropa, con aroma fresco.','active'),
('c1200002-a60f-4d44-acb0-e4c7b85cc002','limpiador-virginia-lavanda','Limpiador Virginia Lavanda','Virginia','Aroma lavanda y limpieza para pisos y superficies lavables.','active'),
('c1200003-a60f-4d44-acb0-e4c7b85cc003','esponjas-scotch-brite-clasicas','Esponjas Clásicas Scotch-Brite','Scotch-Brite','Esponjas de doble acción para platos y superficies resistentes.','active'),
('c1300001-a60f-4d44-acb0-e4c7b85cc001','shampoo-dove-hidratacion','Shampoo Dove Hidratación','Dove','Hidratación y suavidad para el cuidado cotidiano del cabello.','active'),
('c1300002-a60f-4d44-acb0-e4c7b85cc002','pasta-dental-colgate-triple-accion','Pasta Dental Colgate Triple Acción','Colgate','Protección y frescura para la rutina de toda la familia.','active'),
('c1300003-a60f-4d44-acb0-e4c7b85cc003','toallas-humedas-babysec-suaves','Toallas Húmedas Babysec Suaves','Babysec','Toallitas suaves y prácticas para el cuidado de los más pequeños.','active')
on conflict (slug) do update set name=excluded.name, brand=excluded.brand, description=excluded.description, status=excluded.status;

insert into public.product_categories(product_id,category_id)
select p.id, c.id from public.products p join public.categories c on
  (p.slug in ('papel-higienico-nova-max','servilletas-nova-premium','bolsas-basura-resistentes-50l') and c.slug='papel-y-cocina') or
  (p.slug in ('detergente-omo-liquido','limpiador-virginia-lavanda','esponjas-scotch-brite-clasicas') and c.slug='limpieza') or
  (p.slug in ('shampoo-dove-hidratacion','pasta-dental-colgate-triple-accion','toallas-humedas-babysec-suaves') and c.slug='aseo-personal')
on conflict do nothing;

insert into public.product_variants(id,product_id,sku,label,unit_count,price_clp,compare_at_price_clp) values
('c1100001-a60f-4d44-acb0-e4c7b85cc101','c1100001-a60f-4d44-acb0-e4c7b85cc001','NOVA-MAX-8','Pack 8 rollos',8,4790,5590),
('c1100001-a60f-4d44-acb0-e4c7b85cc102','c1100001-a60f-4d44-acb0-e4c7b85cc001','NOVA-MAX-16','Pack 16 rollos',16,8790,10290),
('c1100002-a60f-4d44-acb0-e4c7b85cc201','c1100002-a60f-4d44-acb0-e4c7b85cc002','NOVA-SERV-50','Pack 50 unidades',50,1490,null),
('c1100002-a60f-4d44-acb0-e4c7b85cc202','c1100002-a60f-4d44-acb0-e4c7b85cc002','NOVA-SERV-200','Pack 200 unidades',200,4590,5290),
('c1100003-a60f-4d44-acb0-e4c7b85cc301','c1100003-a60f-4d44-acb0-e4c7b85cc003','SH-BOL-50-10','Rollo 10 bolsas',10,1890,null),
('c1100003-a60f-4d44-acb0-e4c7b85cc302','c1100003-a60f-4d44-acb0-e4c7b85cc003','SH-BOL-50-30','Pack 30 bolsas',30,4690,5290),
('c1200001-a60f-4d44-acb0-e4c7b85cc101','c1200001-a60f-4d44-acb0-e4c7b85cc001','OMO-LIQ-1L','Botella 1 L',1,4290,null),
('c1200001-a60f-4d44-acb0-e4c7b85cc102','c1200001-a60f-4d44-acb0-e4c7b85cc001','OMO-LIQ-3L','Botella 3 L',1,9990,11490),
('c1200002-a60f-4d44-acb0-e4c7b85cc201','c1200002-a60f-4d44-acb0-e4c7b85cc002','VIR-LAV-900','Botella 900 ml',1,1990,null),
('c1200002-a60f-4d44-acb0-e4c7b85cc202','c1200002-a60f-4d44-acb0-e4c7b85cc002','VIR-LAV-1800','Botella 1,8 L',1,3490,3990),
('c1200003-a60f-4d44-acb0-e4c7b85cc301','c1200003-a60f-4d44-acb0-e4c7b85cc003','SB-ESP-3','Pack 3 unidades',3,1590,null),
('c1200003-a60f-4d44-acb0-e4c7b85cc302','c1200003-a60f-4d44-acb0-e4c7b85cc003','SB-ESP-6','Pack 6 unidades',6,2790,3190),
('c1300001-a60f-4d44-acb0-e4c7b85cc101','c1300001-a60f-4d44-acb0-e4c7b85cc001','DOVE-SHA-400','Botella 400 ml',1,3490,3990),
('c1300001-a60f-4d44-acb0-e4c7b85cc102','c1300001-a60f-4d44-acb0-e4c7b85cc001','DOVE-SHA-700','Botella 700 ml',1,5490,null),
('c1300002-a60f-4d44-acb0-e4c7b85cc201','c1300002-a60f-4d44-acb0-e4c7b85cc002','COL-TRI-90','Tubo 90 g',1,1790,null),
('c1300002-a60f-4d44-acb0-e4c7b85cc202','c1300002-a60f-4d44-acb0-e4c7b85cc002','COL-TRI-3X90','Pack 3 x 90 g',3,4690,5290),
('c1300003-a60f-4d44-acb0-e4c7b85cc301','c1300003-a60f-4d44-acb0-e4c7b85cc003','BABYSEC-50','Pack 50 unidades',50,1990,null),
('c1300003-a60f-4d44-acb0-e4c7b85cc302','c1300003-a60f-4d44-acb0-e4c7b85cc003','BABYSEC-3X50','Pack 3 x 50 unidades',150,5290,5990)
on conflict (sku) do update set label=excluded.label, unit_count=excluded.unit_count, price_clp=excluded.price_clp, compare_at_price_clp=excluded.compare_at_price_clp, active=true;

insert into public.inventory(variant_id,available_quantity,low_stock_threshold) values
('c1100001-a60f-4d44-acb0-e4c7b85cc101',22,5),('c1100001-a60f-4d44-acb0-e4c7b85cc102',11,5),
('c1100002-a60f-4d44-acb0-e4c7b85cc201',45,5),('c1100002-a60f-4d44-acb0-e4c7b85cc202',26,5),
('c1100003-a60f-4d44-acb0-e4c7b85cc301',34,5),('c1100003-a60f-4d44-acb0-e4c7b85cc302',19,5),
('c1200001-a60f-4d44-acb0-e4c7b85cc101',24,5),('c1200001-a60f-4d44-acb0-e4c7b85cc102',12,5),
('c1200002-a60f-4d44-acb0-e4c7b85cc201',36,5),('c1200002-a60f-4d44-acb0-e4c7b85cc202',20,5),
('c1200003-a60f-4d44-acb0-e4c7b85cc301',39,5),('c1200003-a60f-4d44-acb0-e4c7b85cc302',22,5),
('c1300001-a60f-4d44-acb0-e4c7b85cc101',29,5),('c1300001-a60f-4d44-acb0-e4c7b85cc102',17,5),
('c1300002-a60f-4d44-acb0-e4c7b85cc201',47,5),('c1300002-a60f-4d44-acb0-e4c7b85cc202',18,5),
('c1300003-a60f-4d44-acb0-e4c7b85cc301',33,5),('c1300003-a60f-4d44-acb0-e4c7b85cc302',16,5)
on conflict (variant_id) do update set available_quantity=excluded.available_quantity, low_stock_threshold=excluded.low_stock_threshold;

insert into public.campaigns (id,placement,title,body,image_path,link_url,priority,active) values
('d1400001-a60f-4d44-acb0-e4c7b85cc001','hero','Toalla de Papel Nova · Pack 2 rollos · $2.290','Precio especial en un esencial para tu hogar.','/campaigns/home-2026-editorial/hero-nova-precio.webp','/productos/toalla-de-papel-nova',100,true)
on conflict (id) do update set placement=excluded.placement, title=excluded.title, body=excluded.body, image_path=excluded.image_path, link_url=excluded.link_url, priority=excluded.priority, active=excluded.active;
