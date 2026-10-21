import { useEffect, useState } from 'react';
import { customerSessionEvent, readCustomerSession, type CustomerSession } from '../lib/customerSession';

export default function CustomerAccountLink() {
  const [session, setSession] = useState<CustomerSession | null>(null);

  useEffect(() => {
    const sync = () => setSession(readCustomerSession());
    sync();
    window.addEventListener(customerSessionEvent, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(customerSessionEvent, sync); window.removeEventListener('storage', sync); };
  }, []);

  const label = session?.user.firstName?.trim() || (session ? 'Mi cuenta' : 'Ingresar');
  return <a className="account-link" href="/cuenta" aria-label={session ? `Ir a la cuenta de ${label}` : 'Ingresar a Superemporio'}>
    <span className="account-link__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.25"></circle><path d="M5.75 19c.55-3.15 2.63-5 6.25-5s5.7 1.85 6.25 5"></path></svg></span>
    <span>{label}</span>
    {session && <i className="account-link__status" aria-hidden="true"></i>}
  </a>;
}
