import { useEffect, useState, type SyntheticEvent } from 'react';
import { closeAdminSession, restoreAdminToken } from './adminSession';

type Placement = 'announcement' | 'hero' | 'banner' | 'modal' | 'home_intro' | 'home_offers' | 'home_favorites';
type Campaign = {
  id: string;
  placement: Placement;
  title: string;
  body: string | null;
  image_path: string | null;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  image_contains_copy: boolean;
  active: boolean;
};
type FormState = {
  placement: Placement;
  title: string;
  body: string;
  imagePath: string;
  linkUrl: string;
  startsAt: string;
  endsAt: string;
  priority: number;
  imageContainsCopy: boolean;
  active: boolean;
};

const placementNames: Record<Placement, string> = {
  hero: 'Carrusel principal',
  home_intro: 'Banner bajo el carrusel',
  home_offers: 'Banner después de ofertas',
  home_favorites: 'Banner después de favoritos',
  banner: 'Banner general',
  modal: 'Ventana emergente',
  announcement: 'Aviso superior',
};
const placementHelp: Record<Placement, string> = {
  hero: 'Imagen principal rotativa de la portada. Formato recomendado 5:1.',
  home_intro: 'Franja promocional ubicada justo debajo del carrusel.',
  home_offers: 'Franja que acompaña la sección de productos en oferta.',
  home_favorites: 'Franja que aparece después de los productos favoritos.',
  banner: 'Banner reutilizable para otras páginas o secciones.',
  modal: 'Contenido destacado que se abre sobre la tienda.',
  announcement: 'Mensaje breve para la franja superior del sitio.',
};
const blankCampaign = (): FormState => ({
  placement: 'hero', title: '', body: '', imagePath: '', linkUrl: '', startsAt: '', endsAt: '', priority: 50, imageContainsCopy: true, active: true,
});
const toForm = (campaign: Campaign): FormState => ({
  placement: campaign.placement,
  title: campaign.title,
  body: campaign.body ?? '',
  imagePath: campaign.image_path ?? '',
  linkUrl: campaign.link_url ?? '',
  startsAt: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '',
  endsAt: campaign.ends_at ? campaign.ends_at.slice(0, 16) : '',
  priority: campaign.priority,
  imageContainsCopy: campaign.image_contains_copy,
  active: campaign.active,
});

export function CampaignManager({ apiUrl, storeUrl }: { apiUrl: string; storeUrl: string }) {
  const [token, setToken] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [message, setMessage] = useState('Verificando campañas…');
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState(false);

  const selectCampaign = (campaign: Campaign) => {
    setSelectedId(campaign.id);
    setForm(toForm(campaign));
    setImageError(false);
  };
  const resolveImage = (path: string) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${storeUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  };
  const loadCampaigns = async (accessToken: string, preferredId?: string) => {
    const response = await fetch(`${apiUrl}/admin/campaigns`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json() as { data?: Campaign[]; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error ?? 'No fue posible cargar las campañas.');
    setCampaigns(payload.data);
    const selected = payload.data.find((campaign) => campaign.id === (preferredId ?? selectedId)) ?? payload.data[0];
    if (selected) selectCampaign(selected);
    else { setSelectedId(''); setForm(blankCampaign()); }
  };

  useEffect(() => {
    restoreAdminToken().then(async (savedToken) => {
      setToken(savedToken);
      try { await loadCampaigns(savedToken); setMessage('Campañas cargadas. Selecciona una para editarla.'); }
      catch { setMessage('No fue posible conectar con la API. Verifica que esté levantada en el puerto 8787.'); }
    }).catch(() => { window.location.assign('/login'); });
  }, []);

  const startNewCampaign = () => {
    setSelectedId('');
    setForm(blankCampaign());
    setImageError(false);
    setMessage('Nueva campaña. Completa los datos y guarda para publicarla.');
  };
  const uploadImage = async (file?: File) => {
    if (!file || !token) return;
    setBusy(true); setMessage('Subiendo imagen…');
    try {
      const data = new FormData(); data.append('file', file);
      const response = await fetch(`${apiUrl}/admin/campaign-assets`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data });
      const payload = await response.json() as { data?: { publicUrl: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'No se pudo subir la imagen.');
      setForm((current) => current ? { ...current, imagePath: payload.data!.publicUrl } : current);
      setImageError(false);
      setMessage('Imagen cargada. Revisa la vista previa y guarda la campaña.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo subir la imagen.'); }
    finally { setBusy(false); }
  };
  const saveCampaign = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!token || !form) return;
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) { setMessage('La fecha de término debe ser posterior al inicio.'); return; }
    setBusy(true); setMessage('Guardando campaña…');
    const body = {
      ...form,
      body: form.body || null,
      imagePath: form.imagePath || null,
      linkUrl: form.linkUrl || null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    try {
      const response = await fetch(`${apiUrl}/admin/campaigns${selectedId ? `/${selectedId}` : ''}`, {
        method: selectedId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { data?: Campaign; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'No se pudo guardar la campaña.');
      await loadCampaigns(token, payload.data.id);
      setMessage('Campaña guardada correctamente. La tienda mostrará el cambio en su próxima carga.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar la campaña.'); }
    finally { setBusy(false); }
  };

  if (!token) return <section className="panel"><h2>Verificando acceso…</h2><p className="campaign-help">Estamos validando tu sesión protegida.</p></section>;
  const previewUrl = form ? resolveImage(form.imagePath) : '';

  return <div className="campaign-admin">
    <section className="campaign-admin__intro">
      <div><span>CONTENIDO DE LA TIENDA</span><h2>Campañas e imágenes</h2><p>Selecciona una pieza, comprueba cómo se verá y publica solo cuando esté lista.</p></div>
      <div><button className="admin-button admin-button--soft" type="button" onClick={() => { void closeAdminSession(); }}>Cerrar sesión</button><button className="admin-button" type="button" onClick={startNewCampaign}>+ Nueva campaña</button></div>
    </section>

    <div className="campaign-workspace">
      <aside className="campaign-list" aria-label="Campañas existentes">
        <header><strong>Campañas</strong><span>{campaigns.length} en total</span></header>
        <div>{campaigns.map((campaign) => <button type="button" key={campaign.id} data-selected={campaign.id === selectedId} onClick={() => selectCampaign(campaign)}>
          <span>{placementNames[campaign.placement]}</span><strong>{campaign.title}</strong><small data-active={campaign.active}>{campaign.active ? 'Publicada' : 'Inactiva'} · prioridad {campaign.priority}</small>
        </button>)}</div>
      </aside>

      {form && <form className="campaign-editor" onSubmit={saveCampaign}>
        <section className="campaign-preview" data-placement={form.placement}>
          <header><div><span>VISTA PREVIA</span><strong>{placementNames[form.placement]}</strong></div><a href={form.linkUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!form.linkUrl}>Probar enlace ↗</a></header>
          <div className="campaign-preview__media">
            {previewUrl && !imageError ? <img src={previewUrl} alt={form.title || 'Vista previa de campaña'} onError={() => setImageError(true)} /> : <div className="campaign-preview__empty"><span>▧</span><strong>{imageError ? 'No pudimos abrir esta imagen' : 'Aún no has seleccionado una imagen'}</strong><p>{imageError ? 'Revisa la ruta o sube nuevamente el archivo.' : 'Sube un JPG, PNG o WebP para verla aquí.'}</p></div>}
          </div>
        </section>

        <section className="campaign-editor__section">
          <header><span>1</span><div><h3>Ubicación y orden</h3><p>Define dónde aparecerá esta pieza dentro de la tienda.</p></div></header>
          <div className="campaign-editor__grid">
            <label>Sección del sitio<select value={form.placement} onChange={(event) => setForm({ ...form, placement: event.target.value as Placement })}>{Object.entries(placementNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select><small>{placementHelp[form.placement]}</small></label>
            <label>Prioridad de aparición<input type="number" min="-100" max="100" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /><small>Las campañas con un número mayor se muestran primero.</small></label>
          </div>
        </section>

        <section className="campaign-editor__section">
          <header><span>2</span><div><h3>Contenido y destino</h3><p>Estos datos ayudan a identificar la campaña y dirigir al cliente.</p></div></header>
          <div className="campaign-editor__grid">
            <label className="campaign-editor__full">Nombre interno de la campaña<input value={form.title} placeholder="Ej: Lunes de ahorro · 5%" onChange={(event) => setForm({ ...form, title: event.target.value })} required /><small>Se usa también como descripción accesible de la imagen.</small></label>
            <label className="campaign-editor__full">Descripción interna<textarea value={form.body} placeholder="Resume la oferta y sus condiciones." onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
            <label className="campaign-editor__full">Enlace al hacer clic<input value={form.linkUrl} placeholder="/catalogo o /productos/nombre-del-producto" onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} /><small>Puedes usar una ruta de la tienda o una URL completa.</small></label>
          </div>
        </section>

        <section className="campaign-editor__section">
          <header><span>3</span><div><h3>Imagen promocional</h3><p>Sube una pieza lista para publicar y comprueba su vista previa.</p></div></header>
          <label className="campaign-upload"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void uploadImage(event.target.files?.[0]); }} /><span>↑</span><strong>{busy ? 'Procesando imagen…' : 'Seleccionar imagen'}</strong><small>JPG, PNG o WebP · máximo 5 MB · carrusel 5:1 o franja 8:1</small></label>
          <label className="campaign-path">Ruta o URL actual<input type="text" value={form.imagePath} placeholder="https://… o /campaigns/…" onChange={(event) => { setForm({ ...form, imagePath: event.target.value }); setImageError(false); }} /></label>
          <label className="campaign-switch"><input type="checkbox" checked={form.imageContainsCopy} onChange={(event) => setForm({ ...form, imageContainsCopy: event.target.checked })} /><span aria-hidden="true"></span><div><strong>La imagen ya incluye sus textos</strong><small>Actívalo cuando títulos, precios y llamados estén incorporados dentro del diseño.</small></div></label>
        </section>

        <section className="campaign-editor__section">
          <header><span>4</span><div><h3>Publicación</h3><p>Controla la vigencia y decide si la campaña está visible.</p></div></header>
          <div className="campaign-editor__grid"><label>Fecha de inicio <em>opcional</em><input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /><small>Sin fecha, puede mostrarse inmediatamente.</small></label><label>Fecha de término <em>opcional</em><input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /><small>Sin fecha, seguirá vigente hasta que la desactives.</small></label></div>
          <label className="campaign-switch campaign-switch--publish"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span aria-hidden="true"></span><div><strong>Campaña visible en la tienda</strong><small>{form.active ? 'Está habilitada; se mostrará si está dentro de sus fechas.' : 'Está guardada, pero los clientes no la verán.'}</small></div></label>
        </section>

        <footer className="campaign-editor__actions"><p className="campaign-message" role="status">{message}</p><button className="admin-button" disabled={busy}>{busy ? 'Guardando cambios…' : selectedId ? 'Guardar cambios' : 'Crear campaña'}</button></footer>
      </form>}
    </div>
  </div>;
}
