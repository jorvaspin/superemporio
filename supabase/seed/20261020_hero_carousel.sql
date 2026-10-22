-- Tres campañas activas para demostrar el carrusel de la portada.
insert into public.campaigns (id,placement,title,body,image_path,link_url,priority,active) values
('d1400001-a60f-4d44-acb0-e4c7b85cc001','hero','Más ahorro para tu casa.','Encuentra papel, limpieza y productos esenciales con precios claros, packs convenientes y despacho local.','/campaigns/home-2026-color/hero-ahorro-color.webp','#ofertas',100,true),
('d1400002-a60f-4d44-acb0-e4c7b85cc002','hero','Packs que rinden más.','Abastece tu hogar con papel, toallas y esenciales pensados para ahorrar todos los días.','/campaigns/home-2026-color/hero-papel-color.webp','/catalogo?categoria=papel-y-cocina',90,true),
('d1400003-a60f-4d44-acb0-e4c7b85cc003','hero','Una casa fresca, todos los días.','Soluciones de limpieza para cada rincón, con precios especiales esta semana.','/campaigns/home-2026-color/hero-cuidado-color.webp','/catalogo?categoria=limpieza',80,true)
on conflict (id) do update set title=excluded.title, body=excluded.body, image_path=excluded.image_path, link_url=excluded.link_url, priority=excluded.priority, active=excluded.active;
