import { useEffect, useState, type SyntheticEvent } from 'react';

type Mode = 'login' | 'register' | 'recover';
type User = { id: string; email?: string; firstName?: string | null };
type Session = { accessToken: string; refreshToken: string; expiresAt?: number; user: User };
type Props = { apiUrl: string };

const sessionKey = 'superemporio-customer-session';

function messageFor(error?: string) {
  if (error === 'INVALID_CREDENTIALS') return 'El correo o la contraseña no son correctos.';
  if (error === 'EMAIL_ALREADY_REGISTERED') return 'Este correo ya tiene una cuenta. Prueba iniciando sesión.';
  if (error === 'REGISTRATION_FAILED') return 'No pudimos crear tu cuenta. Revisa los datos e intenta nuevamente.';
  return 'No pudimos completar la solicitud. Intenta nuevamente.';
}

export default function AccountAuth({ apiUrl }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [session, setSession] = useState<Session | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(sessionKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Session;
      if (parsed.expiresAt && parsed.expiresAt * 1000 <= Date.now()) window.sessionStorage.removeItem(sessionKey);
      else setSession(parsed);
    } catch { window.sessionStorage.removeItem(sessionKey); }
  }, []);

  async function request<T>(path: string, body: Record<string, string>) {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const payload = await response.json() as { data?: T; error?: string };
    if (!response.ok || !payload.data) throw new Error(messageFor(payload.error));
    return payload.data;
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    try {
      if (mode === 'recover') {
        await request('/auth/recover', { email });
        setNoticeTone('success'); setNotice('Si el correo está registrado, recibirás las instrucciones para crear una nueva contraseña.');
        return;
      }
      const password = String(form.get('password') ?? '');
      if (mode === 'register') {
        const result = await request<Session & { requiresEmailConfirmation?: boolean }>('/auth/register', {
          email, password, firstName: String(form.get('firstName') ?? ''), lastName: String(form.get('lastName') ?? ''),
        });
        if (result.requiresEmailConfirmation || !result.accessToken) {
          setNoticeTone('success'); setNotice('Cuenta creada. Revisa tu correo para confirmar el acceso.'); setMode('login');
          return;
        }
        window.sessionStorage.setItem(sessionKey, JSON.stringify(result)); setSession(result);
      } else {
        const result = await request<Session>('/auth/login', { email, password });
        window.sessionStorage.setItem(sessionKey, JSON.stringify(result)); setSession(result);
      }
      setNoticeTone('success'); setNotice('');
    } catch (error) { setNoticeTone('error'); setNotice(error instanceof Error ? error.message : 'No pudimos completar la solicitud.'); }
    finally { setBusy(false); }
  }

  function changeMode(nextMode: Mode) { setMode(nextMode); setNotice(''); setShowPassword(false); }
  function signOut() { window.sessionStorage.removeItem(sessionKey); setSession(null); changeMode('login'); }

  if (session) return <section className="account-card account-card--session" aria-live="polite">
    <div className="account-avatar" aria-hidden="true">{(session.user.firstName || session.user.email || 'S').slice(0, 1).toUpperCase()}</div>
    <span className="account-card__eyebrow">SESIÓN INICIADA</span>
    <h2>Hola{session.user.firstName ? `, ${session.user.firstName}` : ''}</h2>
    <p className="account-card__lead">Tu cuenta está lista. Desde aquí podrás revisar tus compras y administrar tus direcciones.</p>
    <div className="account-session-email">{session.user.email}</div>
    <a className="button button--full" href="/catalogo">Ir a comprar</a>
    <button className="account-text-button" type="button" onClick={signOut}>Cerrar sesión</button>
  </section>;

  const title = mode === 'login' ? 'Ingresa a tu cuenta' : mode === 'register' ? 'Crea tu cuenta' : 'Recupera tu acceso';
  const lead = mode === 'login' ? 'Usa tu correo y contraseña para continuar.' : mode === 'register' ? 'Completa tus datos. Te tomará menos de un minuto.' : 'Te enviaremos un enlace para crear una nueva contraseña.';

  return <section className="account-card">
    <span className="account-card__eyebrow">{mode === 'register' ? 'NUEVA CUENTA' : 'BIENVENIDO'}</span>
    <h2>{title}</h2><p className="account-card__lead">{lead}</p>
    <form className="account-form" onSubmit={submit}>
      {mode === 'register' && <div className="account-form__names">
        <label>Nombre<input name="firstName" autoComplete="given-name" minLength={2} required /></label>
        <label>Apellido<input name="lastName" autoComplete="family-name" minLength={2} required /></label>
      </div>}
      <label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="nombre@correo.cl" required /></label>
      {mode !== 'recover' && <label>Contraseña<div className="account-password"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} placeholder="Mínimo 8 caracteres" required /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}><svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.25-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.25 5.5-9.5 5.5S2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="2.5"></circle>{showPassword && <path d="m4 4 16 16"></path>}</svg></button></div></label>}
      {mode === 'login' && <button className="account-forgot" type="button" onClick={() => changeMode('recover')}>¿Olvidaste tu contraseña?</button>}
      {notice && <p className={`account-notice account-notice--${noticeTone}`} role="status">{notice}</p>}
      <button className="button button--full account-submit" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear mi cuenta' : 'Enviar instrucciones'}</button>
    </form>
    <div className="account-card__footer">
      {mode === 'login' ? <><span>¿Primera vez en Superemporio?</span><button type="button" onClick={() => changeMode('register')}>Crea tu cuenta</button></> : <><span>{mode === 'register' ? '¿Ya tienes una cuenta?' : '¿Recordaste tu contraseña?'}</span><button type="button" onClick={() => changeMode('login')}>Volver a ingresar</button></>}
    </div>
  </section>;
}
