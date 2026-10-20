-- Run with Supabase local test tooling. It verifies that anonymous users cannot write catalog data.
begin;
set local role anon;
select count(*) from public.products;
rollback;
