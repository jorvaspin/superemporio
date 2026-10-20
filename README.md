# Superemporio

Ecommerce chileno para productos esenciales del hogar, construido como monorepo Astro + Cloudflare Workers + Supabase.

## Inicio local

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

- Storefront: `http://localhost:4321`
- Admin: `http://localhost:4322`
- API: `http://localhost:8787/v1/health`

## Base de datos

Instala Supabase CLI y ejecuta:

```bash
supabase start
supabase db reset
```

La migración está en `supabase/migrations` y los datos demostrativos en `supabase/seed`.

## Seguridad

No subas `.env`. Las claves `SUPABASE_SERVICE_ROLE_KEY`, `FLOW_SECRET_KEY` y `RESEND_API_KEY` solo viven en secretos del Worker.
