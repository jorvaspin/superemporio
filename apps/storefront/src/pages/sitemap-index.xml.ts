import type { APIRoute } from 'astro';
import { products } from '../data/catalog';
export const prerender = true;
export const GET: APIRoute = () => {
  const urls = ['/', '/catalogo', '/despacho', '/contacto', ...products.map((product) => `/productos/${product.slug}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>https://www.superemporio.cl${path}</loc></url>`).join('')}</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
