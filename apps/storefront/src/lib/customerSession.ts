export type CustomerUser = { id: string; email?: string; firstName?: string | null };
export type CustomerSession = { accessToken: string; refreshToken: string; expiresAt?: number; user: CustomerUser };

export const customerSessionKey = 'superemporio-customer-session';
export const customerSessionEvent = 'superemporio:customer-session';

export function readCustomerSession(): CustomerSession | null {
  try {
    const saved = window.sessionStorage.getItem(customerSessionKey);
    if (!saved) return null;
    const session = JSON.parse(saved) as CustomerSession;
    if (!session.accessToken || (session.expiresAt && session.expiresAt * 1000 <= Date.now())) {
      window.sessionStorage.removeItem(customerSessionKey);
      return null;
    }
    return session;
  } catch {
    window.sessionStorage.removeItem(customerSessionKey);
    return null;
  }
}

export function saveCustomerSession(session: CustomerSession) {
  window.sessionStorage.setItem(customerSessionKey, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent(customerSessionEvent, { detail: session }));
}

export function clearCustomerSession() {
  window.sessionStorage.removeItem(customerSessionKey);
  window.dispatchEvent(new CustomEvent(customerSessionEvent, { detail: null }));
}
