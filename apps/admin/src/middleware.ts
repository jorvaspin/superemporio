import { defineMiddleware } from 'astro:middleware';
import { getAdminIdentity, sessionCookie } from './lib/adminAuth';

const publicPaths = new Set(['/login', '/api/auth/login', '/api/auth/session', '/api/auth/logout']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  if (pathname.startsWith('/_astro/') || pathname.startsWith('/@') || pathname === '/favicon.svg') return next();
  const accessToken = context.cookies.get(sessionCookie)?.value;
  const identity = accessToken ? await getAdminIdentity(accessToken, import.meta.env) : null;

  if (pathname === '/login') {
    return identity ? context.redirect('/') : next();
  }
  if (publicPaths.has(pathname)) return next();
  if (!identity) {
    const nextPath = `${pathname}${search}`;
    return context.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  context.locals.admin = { userId: identity.userId, role: identity.role };
  return next();
});
