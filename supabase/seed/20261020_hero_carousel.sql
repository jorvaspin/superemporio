-- Cuatro campañas editoriales activas para el carrusel de la portada.
insert into public.campaigns (id,placement,title,body,image_path,link_url,priority,active) values
('d1400001-a60f-4d44-acb0-e4c7b85cc001','hero','Toalla de Papel Nova · Pack 2 rollos · $2.290','Precio especial en un esencial para tu hogar.','/campaigns/home-2026-editorial/hero-nova-precio.webp','/productos/toalla-de-papel-nova',100,true),
('d1400002-a60f-4d44-acb0-e4c7b85cc002','hero','Lavalozas Quix Limón · Botella 750 ml · $2.190','Brillo que se nota con una fórmula concentrada y fresca.','/campaigns/home-2026-editorial/hero-quix-limon.webp','/productos/lavalozas-quix-limon',99,true),
('d1400003-a60f-4d44-acb0-e4c7b85cc003','hero','Detergente OMO Líquido · Botella 1 L · $4.290','Limpieza que rinde para el cuidado cotidiano de tu ropa.','/campaigns/home-2026-editorial/hero-omo-liquido.webp','/productos/detergente-omo-liquido',98,true),
('d1400004-a60f-4d44-acb0-e4c7b85cc004','hero','Jabón Líquido Dove · Botella 250 ml · $2.890','Cuidado suave y humectación para todos los días.','/campaigns/home-2026-editorial/hero-dove-jabon.webp','/productos/jabon-liquido-dove',97,true)
on conflict (id) do update set title=excluded.title, body=excluded.body, image_path=excluded.image_path, link_url=excluded.link_url, priority=excluded.priority, active=excluded.active;
