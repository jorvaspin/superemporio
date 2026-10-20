import type { APIRoute } from 'astro';
export const prerender = true;
export const GET: APIRoute = () => new Response('User-agent: *\nAllow: /\nSitemap: https://www.superemporio.cl/sitemap-index.xml\n', { headers: { 'Content-Type': 'text/plain' } });
