# Arquitectura de Superemporio

## Servicios

- **Storefront:** Astro híbrido en Cloudflare Pages/Workers. Las páginas de catálogo pueden usar caché; carrito, cuenta y checkout no se cachean.
- **Admin:** aplicación Astro independiente en `admin.superemporio.cl`, protegida por Supabase Auth y roles de `admin_members`.
- **API:** Hono en Cloudflare Worker. Es la única capa que usa claves administrativas, crea pedidos y habla con Flow.
- **Datos:** Supabase PostgreSQL, Storage y Auth. La migración inicial define el modelo y políticas RLS.

## Despliegue seguro

1. Crear un proyecto Supabase y ejecutar migración y seed localmente antes de producción.
2. Crear buckets privados para originales y públicos solo para derivados de catálogo.
3. Configurar secretos de Supabase, Flow y Resend mediante `wrangler secret put`; nunca en archivos `.env` publicados.
4. Desplegar API, storefront y admin como servicios independientes en Cloudflare.
5. Configurar el callback Flow contra `https://api.superemporio.cl/v1/payments/flow/callback` y validar en sandbox.
6. Activar backups y pasar Supabase a Pro antes de pagos de producción.

## Flujo de inventario

`quote → order → reservation → payment confirmation → inventory commit`

La reserva impide vender dos veces la última unidad. Flow reserva quince minutos; WhatsApp reserva dos horas. La tarea programada libera automáticamente las reservas vencidas.
