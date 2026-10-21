import { useState, type SyntheticEvent } from 'react';

export function AdminLogin({ nextPath = '/' }: { nextPath?: string }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
  const login = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage('Validando acceso…');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ email, password }) });
      const payload = await response.json() as { accessToken?: string; error?: string };
      if (!response.ok || !payload.accessToken) throw new Error(payload.error === 'ADMIN_ACCESS_REQUIRED' ? 'Tu cuenta no tiene acceso al administrador.' : 'Correo o contraseña incorrectos.');
      window.sessionStorage.setItem('superemporio-admin-token', payload.accessToken);
      window.location.replace(safeNext);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible iniciar sesión.'); } finally { setBusy(false); }
  };
  return <main className="login-page"><section className="login-card"><a className="login-brand" href="https://www.superemporio.cl"><span>🛒</span><strong>superemporio<span>.cl</span></strong></a><div className="login-intro"><p>ADMINISTRACIÓN</p><h1>Bienvenido de vuelta</h1><span>Ingresa con una cuenta autorizada para administrar Superemporio.</span></div><form className="login-form" onSubmit={login}><label>Correo electrónico<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar al administrador →'}</button></form>{message && <p className="login-message" role="status">{message}</p>}<p className="login-foot">Acceso exclusivo para el equipo de Superemporio.</p></section></main>;
}
