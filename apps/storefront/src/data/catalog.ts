import type { CatalogProduct } from '@superemporio/domain';

export const categories = [
  { slug: 'papel-y-cocina', name: 'Papel y cocina', icon: '🧻', description: 'Papel, servilletas y básicos que nunca pueden faltar.' },
  { slug: 'limpieza', name: 'Limpieza', icon: '✨', description: 'Soluciones para cada rincón de tu hogar.' },
  { slug: 'aseo-personal', name: 'Aseo personal', icon: '🫧', description: 'Cuidado diario para toda la familia.' },
  { slug: 'ofertas', name: 'Ofertas', icon: '🏷️', description: 'Precios que sí se sienten.' },
] as const;

export const products: CatalogProduct[] = [
  {
    id: '3275d0e8-8cf2-4f06-84af-7205f32ac001', slug: 'papel-higienico-nova-clasico', name: 'Papel Higiénico Nova Clásico', brand: 'Nova', category: 'papel-y-cocina', emoji: '🧻', image: '/products/papel-higienico-nova-clasico.webp', badge: 'Más vendido', description: 'Suavidad y rendimiento para resolver el día a día de tu hogar.', variants: [
      { id: '3275d0e8-8cf2-4f06-84af-7205f32ac101', sku: 'NOVA-CLAS-4', label: 'Pack 4 rollos', unitCount: 4, price: 2390, compareAtPrice: 2790, stock: 38, image: 'paper' },
      { id: '3275d0e8-8cf2-4f06-84af-7205f32ac102', sku: 'NOVA-CLAS-12', label: 'Pack 12 rollos', unitCount: 12, price: 6290, compareAtPrice: 7490, stock: 21, image: 'paper' },
    ],
  },
  {
    id: '900c7a12-a60f-4d44-acb0-e4c7b85cc003', slug: 'toalla-de-papel-nova', name: 'Toalla de Papel Nova', brand: 'Nova', category: 'papel-y-cocina', emoji: '🌿', image: '/products/toalla-de-papel-nova.webp', badge: 'Pack ahorro', description: 'Alta absorción para la cocina y toda la casa.', variants: [
      { id: '900c7a12-a60f-4d44-acb0-e4c7b85cc301', sku: 'NOVA-TOP-2', label: 'Pack 2 rollos', unitCount: 2, price: 2290, stock: 30, image: 'towel' },
      { id: '900c7a12-a60f-4d44-acb0-e4c7b85cc302', sku: 'NOVA-TOP-6', label: 'Pack 6 rollos', unitCount: 6, price: 5590, compareAtPrice: 6290, stock: 15, image: 'towel' },
    ],
  },
  {
    id: 'c1100001-a60f-4d44-acb0-e4c7b85cc001', slug: 'papel-higienico-nova-max', name: 'Papel Higiénico Nova Max', brand: 'Nova', category: 'papel-y-cocina', emoji: '🧻', image: '/products/papel-higienico-nova-max.webp', badge: 'Ahorra 18%', description: 'Doble hoja y más metros para abastecer a toda la familia.', variants: [
      { id: 'c1100001-a60f-4d44-acb0-e4c7b85cc101', sku: 'NOVA-MAX-8', label: 'Pack 8 rollos', unitCount: 8, price: 4790, compareAtPrice: 5590, stock: 22, image: 'paper' },
      { id: 'c1100001-a60f-4d44-acb0-e4c7b85cc102', sku: 'NOVA-MAX-16', label: 'Pack 16 rollos', unitCount: 16, price: 8790, compareAtPrice: 10290, stock: 11, image: 'paper' },
    ],
  },
  {
    id: 'c1100002-a60f-4d44-acb0-e4c7b85cc002', slug: 'servilletas-nova-premium', name: 'Servilletas Nova Premium', brand: 'Nova', category: 'papel-y-cocina', emoji: '🍽️', image: '/products/servilletas-nova-premium.webp', description: 'Servilletas resistentes para tus comidas y reuniones.', variants: [
      { id: 'c1100002-a60f-4d44-acb0-e4c7b85cc201', sku: 'NOVA-SERV-50', label: 'Pack 50 unidades', unitCount: 50, price: 1490, stock: 45, image: 'towel' },
      { id: 'c1100002-a60f-4d44-acb0-e4c7b85cc202', sku: 'NOVA-SERV-200', label: 'Pack 200 unidades', unitCount: 200, price: 4590, compareAtPrice: 5290, stock: 26, image: 'towel' },
    ],
  },
  {
    id: 'c1100003-a60f-4d44-acb0-e4c7b85cc003', slug: 'bolsas-basura-resistentes-50l', name: 'Bolsas de Basura Resistentes 50 L', brand: 'SuperHogar', category: 'papel-y-cocina', emoji: '🗑️', image: '/products/bolsas-basura-resistentes-50l.webp', badge: 'Esencial', description: 'Bolsas reforzadas con cierre práctico para el uso diario.', variants: [
      { id: 'c1100003-a60f-4d44-acb0-e4c7b85cc301', sku: 'SH-BOL-50-10', label: 'Rollo 10 bolsas', unitCount: 10, price: 1890, stock: 34, image: 'paper' },
      { id: 'c1100003-a60f-4d44-acb0-e4c7b85cc302', sku: 'SH-BOL-50-30', label: 'Pack 30 bolsas', unitCount: 30, price: 4690, compareAtPrice: 5290, stock: 19, image: 'paper' },
    ],
  },
  {
    id: '8a7d7b12-a60f-4d44-acb0-e4c7b85cc002', slug: 'lavalozas-quix-limon', name: 'Lavalozas Quix Limón', brand: 'Quix', category: 'limpieza', emoji: '🍋', image: '/products/lavalozas-quix-limon.webp', badge: 'Precio especial', description: 'Fórmula concentrada para una limpieza efectiva y fresca.', variants: [
      { id: '8a7d7b12-a60f-4d44-acb0-e4c7b85cc201', sku: 'QUIX-LIM-750', label: 'Botella 750 ml', unitCount: 1, price: 2190, compareAtPrice: 2490, stock: 44, image: 'lemon' },
      { id: '8a7d7b12-a60f-4d44-acb0-e4c7b85cc202', sku: 'QUIX-LIM-1500', label: 'Botella 1,5 L', unitCount: 1, price: 3790, compareAtPrice: 4290, stock: 18, image: 'lemon' },
    ],
  },
  {
    id: 'c1200001-a60f-4d44-acb0-e4c7b85cc001', slug: 'detergente-omo-liquido', name: 'Detergente OMO Líquido', brand: 'OMO', category: 'limpieza', emoji: '👕', image: '/products/detergente-omo-liquido.webp', badge: 'Pack ahorro', description: 'Limpieza profunda para tu ropa, con aroma fresco.', variants: [
      { id: 'c1200001-a60f-4d44-acb0-e4c7b85cc101', sku: 'OMO-LIQ-1L', label: 'Botella 1 L', unitCount: 1, price: 4290, stock: 24, image: 'soap' },
      { id: 'c1200001-a60f-4d44-acb0-e4c7b85cc102', sku: 'OMO-LIQ-3L', label: 'Botella 3 L', unitCount: 1, price: 9990, compareAtPrice: 11490, stock: 12, image: 'soap' },
    ],
  },
  {
    id: 'c1200002-a60f-4d44-acb0-e4c7b85cc002', slug: 'limpiador-virginia-lavanda', name: 'Limpiador Virginia Lavanda', brand: 'Virginia', category: 'limpieza', emoji: '🪻', image: '/products/limpiador-virginia-lavanda.webp', description: 'Aroma lavanda y limpieza para pisos y superficies lavables.', variants: [
      { id: 'c1200002-a60f-4d44-acb0-e4c7b85cc201', sku: 'VIR-LAV-900', label: 'Botella 900 ml', unitCount: 1, price: 1990, stock: 36, image: 'cleaner' },
      { id: 'c1200002-a60f-4d44-acb0-e4c7b85cc202', sku: 'VIR-LAV-1800', label: 'Botella 1,8 L', unitCount: 1, price: 3490, compareAtPrice: 3990, stock: 20, image: 'cleaner' },
    ],
  },
  {
    id: 'c1200003-a60f-4d44-acb0-e4c7b85cc003', slug: 'esponjas-scotch-brite-clasicas', name: 'Esponjas Clásicas Scotch-Brite', brand: 'Scotch-Brite', category: 'limpieza', emoji: '🧽', image: '/products/esponjas-scotch-brite-clasicas.webp', badge: 'Lleva más', description: 'Esponjas de doble acción para platos y superficies resistentes.', variants: [
      { id: 'c1200003-a60f-4d44-acb0-e4c7b85cc301', sku: 'SB-ESP-3', label: 'Pack 3 unidades', unitCount: 3, price: 1590, stock: 39, image: 'cleaner' },
      { id: 'c1200003-a60f-4d44-acb0-e4c7b85cc302', sku: 'SB-ESP-6', label: 'Pack 6 unidades', unitCount: 6, price: 2790, compareAtPrice: 3190, stock: 22, image: 'cleaner' },
    ],
  },
  {
    id: 'aa0c7a12-a60f-4d44-acb0-e4c7b85cc004', slug: 'jabon-liquido-dove', name: 'Jabón Líquido Dove', brand: 'Dove', category: 'aseo-personal', emoji: '🫧', image: '/products/jabon-liquido-dove.webp', badge: 'Favorito', description: 'Cuidado suave y humectación para manos de toda la familia.', variants: [
      { id: 'aa0c7a12-a60f-4d44-acb0-e4c7b85cc401', sku: 'DOVE-JAB-250', label: 'Botella 250 ml', unitCount: 1, price: 2890, stock: 26, image: 'soap' },
    ],
  },
  {
    id: 'c1300001-a60f-4d44-acb0-e4c7b85cc001', slug: 'shampoo-dove-hidratacion', name: 'Shampoo Dove Hidratación', brand: 'Dove', category: 'aseo-personal', emoji: '🧴', image: '/products/shampoo-dove-hidratacion.webp', badge: 'Precio especial', description: 'Hidratación y suavidad para el cuidado cotidiano del cabello.', variants: [
      { id: 'c1300001-a60f-4d44-acb0-e4c7b85cc101', sku: 'DOVE-SHA-400', label: 'Botella 400 ml', unitCount: 1, price: 3490, compareAtPrice: 3990, stock: 29, image: 'soap' },
      { id: 'c1300001-a60f-4d44-acb0-e4c7b85cc102', sku: 'DOVE-SHA-700', label: 'Botella 700 ml', unitCount: 1, price: 5490, stock: 17, image: 'soap' },
    ],
  },
  {
    id: 'c1300002-a60f-4d44-acb0-e4c7b85cc002', slug: 'pasta-dental-colgate-triple-accion', name: 'Pasta Dental Colgate Triple Acción', brand: 'Colgate', category: 'aseo-personal', emoji: '😁', image: '/products/pasta-dental-colgate-triple-accion.webp', description: 'Protección y frescura para la rutina de toda la familia.', variants: [
      { id: 'c1300002-a60f-4d44-acb0-e4c7b85cc201', sku: 'COL-TRI-90', label: 'Tubo 90 g', unitCount: 1, price: 1790, stock: 47, image: 'soap' },
      { id: 'c1300002-a60f-4d44-acb0-e4c7b85cc202', sku: 'COL-TRI-3X90', label: 'Pack 3 x 90 g', unitCount: 3, price: 4690, compareAtPrice: 5290, stock: 18, image: 'soap' },
    ],
  },
  {
    id: 'c1300003-a60f-4d44-acb0-e4c7b85cc003', slug: 'toallas-humedas-babysec-suaves', name: 'Toallas Húmedas Babysec Suaves', brand: 'Babysec', category: 'aseo-personal', emoji: '💧', image: '/products/toallas-humedas-babysec-suaves.webp', badge: 'Nuevo', description: 'Toallitas suaves y prácticas para el cuidado de los más pequeños.', variants: [
      { id: 'c1300003-a60f-4d44-acb0-e4c7b85cc301', sku: 'BABYSEC-50', label: 'Pack 50 unidades', unitCount: 50, price: 1990, stock: 33, image: 'soap' },
      { id: 'c1300003-a60f-4d44-acb0-e4c7b85cc302', sku: 'BABYSEC-3X50', label: 'Pack 3 x 50 unidades', unitCount: 150, price: 5290, compareAtPrice: 5990, stock: 16, image: 'soap' },
    ],
  },
];

export const findProduct = (slug: string) => products.find((product) => product.slug === slug);
