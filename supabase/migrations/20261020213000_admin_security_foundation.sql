-- Security and operational foundations for the authenticated administration API.
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_members where user_id = auth.uid() and active = true and role = 'owner');
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,first_name,last_name)
  values (new.id, nullif(new.raw_user_meta_data->>'first_name',''), nullif(new.raw_user_meta_data->>'last_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_profile on auth.users;
create trigger auth_user_profile after insert on auth.users for each row execute procedure public.handle_new_user();
insert into public.profiles(id)
select id from auth.users on conflict (id) do nothing;

drop trigger if exists campaigns_updated on public.campaigns;
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();
drop trigger if exists coupons_updated on public.coupons;
create trigger coupons_updated before update on public.coupons for each row execute function public.set_updated_at();
drop trigger if exists settings_updated on public.site_settings;
create trigger settings_updated before update on public.site_settings for each row execute function public.set_updated_at();

create or replace function public.adjust_inventory(
  p_variant_id uuid, p_delta_available integer, p_reason text, p_actor_id uuid, p_note text default null
) returns public.inventory language plpgsql security definer set search_path = public as $$
declare current_inventory public.inventory;
begin
  if p_delta_available = 0 then raise exception 'Inventory adjustment must not be zero'; end if;
  if length(trim(p_reason)) < 3 then raise exception 'Inventory adjustment reason is required'; end if;
  select * into current_inventory from public.inventory where variant_id = p_variant_id for update;
  if not found then raise exception 'Inventory not found'; end if;
  if current_inventory.available_quantity + p_delta_available < current_inventory.reserved_quantity then
    raise exception 'Adjustment would make available stock lower than reserved stock';
  end if;
  update public.inventory set available_quantity = available_quantity + p_delta_available where variant_id = p_variant_id returning * into current_inventory;
  insert into public.inventory_movements(variant_id,delta_available,reason,reference_type,actor_id)
  values(p_variant_id,p_delta_available,trim(p_reason),coalesce(nullif(trim(p_note),''),'admin_adjustment'),p_actor_id);
  return current_inventory;
end;
$$;

revoke all on function public.adjust_inventory(uuid,integer,text,uuid,text) from public;
grant execute on function public.adjust_inventory(uuid,integer,text,uuid,text) to service_role;

create policy "admin members own membership"
on public.admin_members for select to authenticated
using (user_id = auth.uid());
