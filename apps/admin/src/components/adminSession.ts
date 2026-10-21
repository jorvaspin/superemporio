const tokenKey = 'superemporio-admin-token';

export async function restoreAdminToken() {
  const saved = window.sessionStorage.getItem(tokenKey);
  if (saved) return saved;
  const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
  const payload = await response.json() as { accessToken?: string };
  if (!response.ok || !payload.accessToken) throw new Error('SESSION_EXPIRED');
  window.sessionStorage.setItem(tokenKey, payload.accessToken);
  return payload.accessToken;
}

export async function closeAdminSession() {
  window.sessionStorage.removeItem(tokenKey);
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.assign('/login');
}
