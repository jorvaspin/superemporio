import type { APIRoute } from 'astro';
import { sessionCookie } from '../../../lib/adminAuth';

export const prerender = false;
export const POST: APIRoute = async ({ cookies }) => { cookies.delete(sessionCookie, { path: '/' }); return new Response(null, { status: 204 }); };
