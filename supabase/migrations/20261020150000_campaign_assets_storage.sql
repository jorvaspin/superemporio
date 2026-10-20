-- Public delivery is intentional: hero images are rendered on the public storefront.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('campaign-assets','campaign-assets',true,5242880,array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public=true, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy "public campaign asset read"
on storage.objects for select
using (bucket_id = 'campaign-assets');

create policy "admins manage campaign assets"
on storage.objects for all to authenticated
using (bucket_id = 'campaign-assets' and public.is_admin())
with check (bucket_id = 'campaign-assets' and public.is_admin());
