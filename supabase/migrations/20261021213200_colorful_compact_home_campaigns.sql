update campaigns
set image_path = case id
  when 'd1400001-a60f-4d44-acb0-e4c7b85cc001' then '/campaigns/home-2026-color/hero-ahorro-color.webp'
  when 'd1400002-a60f-4d44-acb0-e4c7b85cc002' then '/campaigns/home-2026-color/hero-papel-color.webp'
  when 'd1400003-a60f-4d44-acb0-e4c7b85cc003' then '/campaigns/home-2026-color/hero-cuidado-color.webp'
  when 'd1500001-a60f-4d44-acb0-e4c7b85cc011' then '/campaigns/home-2026-color/franja-esenciales-color.webp'
  when 'd1500002-a60f-4d44-acb0-e4c7b85cc012' then '/campaigns/home-2026-color/hero-papel-color.webp'
  when 'd1500003-a60f-4d44-acb0-e4c7b85cc013' then '/campaigns/home-2026-color/hero-cuidado-color.webp'
  else image_path
end,
updated_at = now()
where id in (
  'd1400001-a60f-4d44-acb0-e4c7b85cc001',
  'd1400002-a60f-4d44-acb0-e4c7b85cc002',
  'd1400003-a60f-4d44-acb0-e4c7b85cc003',
  'd1500001-a60f-4d44-acb0-e4c7b85cc011',
  'd1500002-a60f-4d44-acb0-e4c7b85cc012',
  'd1500003-a60f-4d44-acb0-e4c7b85cc013'
);
