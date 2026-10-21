import type { APIRoute } from 'astro';
import { getAdminIdentity, sessionCookie } from '../../../lib/adminAuth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const accessToken = cookies.get(sessionCookie)?.value;
  const identity = accessToken ? await getAdminIdentity(accessToken, import.meta.env) : null;
  if (!identity) return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  return new Response(JSON.stringify({ accessToken: identity.accessToken, role: identity.role }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
