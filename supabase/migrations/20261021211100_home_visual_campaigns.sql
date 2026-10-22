update public.campaigns set image_path = case id
  when 'd1400001-a60f-4d44-acb0-e4c7b85cc001' then '/campaigns/home-2026/hero-esenciales-verde.webp'
  when 'd1400002-a60f-4d44-acb0-e4c7b85cc002' then '/campaigns/home-2026/banner-ofertas-verde.webp'
  when 'd1400003-a60f-4d44-acb0-e4c7b85cc003' then '/campaigns/home-2026/banner-cuidado-hogar.webp'
end
where id in (
  'd1400001-a60f-4d44-acb0-e4c7b85cc001',
  'd1400002-a60f-4d44-acb0-e4c7b85cc002',
  'd1400003-a60f-4d44-acb0-e4c7b85cc003'
);

insert into public.campaigns (id, placement, title, body, image_path, link_url, priority, active) values
  ('d1500001-a60f-4d44-acb0-e4c7b85cc011', 'home_intro', 'Ahorra en lo que usas todos los días', 'Formatos convenientes, despacho local y precios claros para abastecer tu hogar.', '/campaigns/home-2026/banner-ahorro-mensual.webp', '/catalogo', 100, true),
  ('d1500002-a60f-4d44-acb0-e4c7b85cc012', 'home_offers', 'Ofertas que hacen rendir tu compra', 'Encuentra oportunidades reales en papel, limpieza y cuidado diario.', '/campaigns/home-2026/banner-ofertas-verde.webp', '/catalogo?categoria=ofertas', 100, true),
  ('d1500003-a60f-4d44-acb0-e4c7b85cc013', 'home_favorites', 'Todo para una casa limpia y lista', 'Reúne tus favoritos del hogar en una compra simple y cercana.', '/campaigns/home-2026/banner-cuidado-hogar.webp', '/catalogo', 100, true)
on conflict (id) do update set placement=excluded.placement, title=excluded.title, body=excluded.body, image_path=excluded.image_path, link_url=excluded.link_url, priority=excluded.priority, active=excluded.active;
