import type { APIRoute } from 'astro';
import { getAdminIdentity, sessionCookie } from '../../../lib/adminAuth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string };
    if (!email || !password) return new Response(JSON.stringify({ error: 'INVALID_CREDENTIALS' }), { status: 422, headers: { 'Content-Type': 'application/json' } });
    const url = import.meta.env.SUPABASE_URL;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) return new Response(JSON.stringify({ error: 'AUTH_NOT_CONFIGURED' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    const signIn = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const session = await signIn.json() as { access_token?: string; expires_in?: number };
    if (!signIn.ok || !session.access_token) return new Response(JSON.stringify({ error: 'INVALID_CREDENTIALS' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const identity = await getAdminIdentity(session.access_token, import.meta.env);
    if (!identity) return new Response(JSON.stringify({ error: 'ADMIN_ACCESS_REQUIRED' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    cookies.set(sessionCookie, session.access_token, { httpOnly: true, sameSite: 'lax', secure: import.meta.env.PROD, path: '/', maxAge: session.expires_in ?? 3600 });
    return new Response(JSON.stringify({ accessToken: session.access_token, role: identity.role }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch { return new Response(JSON.stringify({ error: 'LOGIN_UNAVAILABLE' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
};
