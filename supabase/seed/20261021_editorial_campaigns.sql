update public.campaigns
set title = 'Toalla de Papel Nova · Pack 2 rollos · $2.290',
    body = 'Precio especial en un esencial para tu hogar.',
    image_path = '/campaigns/home-2026-editorial/hero-nova-precio.webp',
    link_url = '/productos/toalla-de-papel-nova',
    image_contains_copy = true,
    updated_at = timezone('utc', now())
where id = 'd1400001-a60f-4d44-acb0-e4c7b85cc001';

update public.campaigns
set title = 'Lunes de ahorro · 5% con LUNES5',
    body = 'Exclusivo para clientes registrados. Un uso por cuenta y válido solo los lunes.',
    image_path = '/campaigns/home-2026-editorial/banner-lunes5.webp',
    link_url = '/catalogo',
    image_contains_copy = true,
    updated_at = timezone('utc', now())
where id = 'd1500001-a60f-4d44-acb0-e4c7b85cc011';
