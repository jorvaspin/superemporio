import type { CatalogProduct } from '@superemporio/domain';

export const categories = [
  { slug: 'papel-y-cocina', name: 'Papel y cocina', icon: '🧻', description: 'Lo esencial para cada día.' },
  { slug: 'limpieza', name: 'Limpieza', icon: '✨', description: 'Hogar limpio, compra inteligente.' },
  { slug: 'aseo-personal', name: 'Aseo personal', icon: '🫧', description: 'Cuidado diario para tu familia.' },
  { slug: 'ofertas', name: 'Ofertas', icon: '🏷️', description: 'Precios que sí se sienten.' },
] as const;

export const products: CatalogProduct[] = [
  { id: '3275d0e8-8cf2-4f06-84af-7205f32ac001', slug: 'papel-higienico-nova-clasico', name: 'Papel Higiénico Nova Clásico', brand: 'Nova', category: 'papel-y-cocina', emoji: '🧻', badge: 'Más vendido', description: 'Suavidad y rendimiento para resolver el día a día de tu hogar.', variants: [
    { id: '3275d0e8-8cf2-4f06-84af-7205f32ac101', sku: 'NOVA-CLAS-4', label: 'Pack 4 rollos', unitCount: 4, price: 2390, compareAtPrice: 2790, stock: 38, image: 'paper' },
    { id: '3275d0e8-8cf2-4f06-84af-7205f32ac102', sku: 'NOVA-CLAS-12', label: 'Pack 12 rollos', unitCount: 12, price: 6290, compareAtPrice: 7490, stock: 21, image: 'paper' },
  ] },
  { id: '8a7d7b12-a60f-4d44-acb0-e4c7b85cc002', slug: 'lavalozas-quix-limon', name: 'Lavalozas Quix Limón', brand: 'Quix', category: 'limpieza', emoji: '🍋', badge: 'Precio especial', description: 'Fórmula concentrada para una limpieza efectiva y fresca.', variants: [
    { id: '8a7d7b12-a60f-4d44-acb0-e4c7b85cc201', sku: 'QUIX-LIM-750', label: 'Botella 750 ml', unitCount: 1, price: 2190, compareAtPrice: 2490, stock: 44, image: 'lemon' },
    { id: '8a7d7b12-a60f-4d44-acb0-e4c7b85cc202', sku: 'QUIX-LIM-1500', label: 'Botella 1,5 L', unitCount: 1, price: 3790, compareAtPrice: 4290, stock: 18, image: 'lemon' },
  ] },
  { id: '900c7a12-a60f-4d44-acb0-e4c7b85cc003', slug: 'toalla-de-papel-nova', name: 'Toalla de Papel Nova', brand: 'Nova', category: 'papel-y-cocina', emoji: '🌿', description: 'Alta absorción para la cocina y toda la casa.', variants: [
    { id: '900c7a12-a60f-4d44-acb0-e4c7b85cc301', sku: 'NOVA-TOP-2', label: 'Pack 2 rollos', unitCount: 2, price: 2290, stock: 30, image: 'towel' },
    { id: '900c7a12-a60f-4d44-acb0-e4c7b85cc302', sku: 'NOVA-TOP-6', label: 'Pack 6 rollos', unitCount: 6, price: 5590, compareAtPrice: 6290, stock: 15, image: 'towel' },
  ] },
  { id: 'aa0c7a12-a60f-4d44-acb0-e4c7b85cc004', slug: 'jabon-liquido-dove', name: 'Jabón Líquido Dove', brand: 'Dove', category: 'aseo-personal', emoji: '🫧', description: 'Cuidado suave y humectación para manos de toda la familia.', variants: [
    { id: 'aa0c7a12-a60f-4d44-acb0-e4c7b85cc401', sku: 'DOVE-JAB-250', label: 'Botella 250 ml', unitCount: 1, price: 2890, stock: 26, image: 'soap' },
  ] },
];

export const findProduct = (slug: string) => products.find((product) => product.slug === slug);
