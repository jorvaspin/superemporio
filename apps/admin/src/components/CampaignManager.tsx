import { useEffect, useState, type SyntheticEvent } from 'react';
import { closeAdminSession, restoreAdminToken } from './adminSession';

type Campaign = {
  id: string;
  placement: 'announcement' | 'hero' | 'banner' | 'modal' | 'home_intro' | 'home_offers' | 'home_favorites';
  title: string;
  body: string | null;
  image_path: string | null;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  active: boolean;
};

type FormState = {
  placement: Campaign['placement']; title: string; body: string; imagePath: string; linkUrl: string;
  startsAt: string; endsAt: string; priority: number; active: boolean;
};

const toForm = (campaign: Campaign): FormState => ({
  placement: campaign.placement, title: campaign.title, body: campaign.body ?? '', imagePath: campaign.image_path ?? '', linkUrl: campaign.link_url ?? '',
  startsAt: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '', endsAt: campaign.ends_at ? campaign.ends_at.slice(0, 16) : '',
  priority: campaign.priority, active: campaign.active,
});

export function CampaignManager({ apiUrl, supabaseUrl, anonKey }: { apiUrl: string; supabaseUrl: string; anonKey: string }) {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [message, setMessage] = useState('Inicia sesión para editar las campañas.');
  const [busy, setBusy] = useState(false);

  const selectCampaign = (campaign: Campaign) => { setSelectedId(campaign.id); setForm(toForm(campaign)); };
  const loadCampaigns = async (accessToken: string) => {
    const response = await fetch(`${apiUrl}/admin/campaigns`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json() as { data?: Campaign[]; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error ?? 'No fue posible cargar las campañas.');
    setCampaigns(payload.data);
    const selected = payload.data.find((campaign) => campaign.id === selectedId) ?? payload.data[0];
    if (selected) selectCampaign(selected);
  };

  useEffect(() => {
    restoreAdminToken().then(async (savedToken) => { setToken(savedToken); try { await loadCampaigns(savedToken); setMessage('Sesión activa. Puedes editar y publicar la campaña.'); } catch { setMessage('No fue posible conectar con la API. Verifica que esté levantada en el puerto 8787.'); } }).catch(() => { window.location.assign('/login'); });
  }, []);

  const login = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage('Validando acceso…');
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const payload = await response.json() as { access_token?: string; error_description?: string };
      if (!response.ok || !payload.access_token) throw new Error(payload.error_description ?? 'No se pudo iniciar sesión.');
      window.sessionStorage.setItem('superemporio-admin-token', payload.access_token); setToken(payload.access_token); await loadCampaigns(payload.access_token); setPassword(''); setMessage('Sesión activa. Puedes editar y publicar la campaña.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.'); }
    finally { setBusy(false); }
  };

  const uploadImage = async (file?: File) => {
    if (!file || !token) return;
    setBusy(true); setMessage('Subiendo imagen…');
    try {
      const data = new FormData(); data.append('file', file);
      const response = await fetch(`${apiUrl}/admin/campaign-assets`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data });
      const payload = await response.json() as { data?: { publicUrl: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'No se pudo subir la imagen.');
      setForm((current) => current ? { ...current, imagePath: payload.data!.publicUrl } : current); setMessage('Imagen cargada. Guarda la campaña para publicarla.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo subir la imagen.'); }
    finally { setBusy(false); }
  };

  const saveCampaign = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!token || !form) return;
    setBusy(true); setMessage('Guardando campaña…');
    const body = { ...form, body: form.body || null, imagePath: form.imagePath || null, linkUrl: form.linkUrl || null, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null };
    try {
      const response = await fetch(`${apiUrl}/admin/campaigns${selectedId ? `/${selectedId}` : ''}`, { method: selectedId ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json() as { data?: Campaign; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'No se pudo guardar la campaña.');
      await loadCampaigns(token); setMessage('Campaña guardada. La portada se actualizará en su próxima carga.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar la campaña.'); }
    finally { setBusy(false); }
  };

  if (!token) return <section className="panel"><h2>Verificando acceso…</h2><p className="campaign-help">Estamos validando tu sesión protegida.</p></section>;

  const placementNames: Record<Campaign['placement'], string> = {
    hero: 'Carrusel principal', home_intro: 'Banner bajo carrusel', home_offers: 'Banner después de ofertas',
    home_favorites: 'Banner después de favoritos', banner: 'Banner general', modal: 'Modal', announcement: 'Aviso superior',
  };

  return <><section className="panel campaign-current"><div><span className="status">Sesión protegida</span><h2>Imágenes y campañas del sitio</h2><p>Cada ubicación corresponde a una sección visible de la tienda. Edita su texto, imagen, enlace, vigencia y prioridad.</p></div>{form?.imagePath && <img src={form.imagePath} alt="Vista previa de campaña" />}</section><section className="panel"><div className="panel-head"><div><h2>Editor por sección</h2><p className="campaign-help">Las imágenes principales del home se administran desde aquí y cada cambio queda en auditoría.</p></div><select aria-label="Seleccionar campaña" value={selectedId} onChange={(event) => { if (!event.target.value) { setSelectedId(''); setForm({ placement: 'hero', title: '', body: '', imagePath: '', linkUrl: '', startsAt: '', endsAt: '', priority: 0, active: true }); return; } const campaign = campaigns.find((item) => item.id === event.target.value); if (campaign) selectCampaign(campaign); }}><option value="">Nueva campaña</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{placementNames[campaign.placement]} · {campaign.title}</option>)}</select></div>{form && <form className="campaign-form" onSubmit={saveCampaign}><label>Sección del sitio<select value={form.placement} onChange={(event) => setForm({ ...form, placement: event.target.value as FormState['placement'] })}><option value="hero">Carrusel principal</option><option value="home_intro">Banner bajo carrusel</option><option value="home_offers">Banner después de ofertas</option><option value="home_favorites">Banner después de favoritos</option><option value="banner">Banner general</option><option value="modal">Modal</option><option value="announcement">Aviso superior</option></select></label><label>Prioridad<input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /></label><label className="campaign-form__full">Título<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label className="campaign-form__full">Mensaje<textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label><label className="campaign-form__full">Enlace de destino<input value={form.linkUrl} placeholder="/catalogo?categoria=ofertas" onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} /></label><label className="campaign-form__full">Imagen<input type="text" value={form.imagePath} placeholder="https://… o /campaigns/…" onChange={(event) => setForm({ ...form, imagePath: event.target.value })} /><small>Recomendado: formato horizontal 3:1, JPG, PNG o WebP de hasta 5 MB.</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadImage(event.target.files?.[0])} /></label><label>Inicio<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label>Fin<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label><label className="campaign-form__full"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Campaña activa</label><button className="admin-button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar campaña'}</button></form>}<p className="campaign-message">{message}</p></section><button className="admin-button admin-button--soft" onClick={() => { void closeAdminSession(); }}>Cerrar sesión</button></>;
}
