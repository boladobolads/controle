-- HostMaster Access: convites por equipamento, com token armazenado somente como hash.
create extension if not exists pgcrypto;

create table if not exists public.access_invites (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.access_properties(id) on delete cascade,
 device_id uuid not null references public.access_devices(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 guest_name text not null check(length(guest_name) between 1 and 120),
 token_hash text not null unique,
 starts_at timestamptz not null,
 expires_at timestamptz not null,
 status text not null default 'active' check(status in ('active','revoked')),
 created_at timestamptz not null default now(),
 constraint valid_invite_period check(expires_at > starts_at)
);
create index if not exists access_invites_device_idx on public.access_invites(device_id);
create index if not exists access_invites_token_hash_idx on public.access_invites(token_hash);
alter table public.access_invites enable row level security;
drop policy if exists own_invites_read on public.access_invites;
create policy own_invites_read on public.access_invites for select to authenticated
 using(exists(select 1 from public.access_properties p where p.id=property_id and p.owner_id=auth.uid()));
revoke all on public.access_invites from anon, authenticated;
grant select on public.access_invites to authenticated;

create or replace function public.create_access_invite(
 p_device_id uuid, p_guest_name text, p_starts_at timestamptz, p_expires_at timestamptz
) returns table(invite_id uuid, invite_token text)
language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_property uuid; v_token text; v_id uuid;
begin
 if auth.uid() is null then raise exception 'É necessário entrar na conta.'; end if;
 if length(trim(coalesce(p_guest_name,''))) not between 1 and 120 then raise exception 'Nome do hóspede inválido.'; end if;
 if p_starts_at is null or p_expires_at is null or p_expires_at <= p_starts_at then raise exception 'Período do convite inválido.'; end if;
 select p.owner_id,d.property_id into v_owner,v_property
 from public.access_devices d join public.access_properties p on p.id=d.property_id
 where d.id=p_device_id;
 if v_property is null or v_owner <> auth.uid() then raise exception 'Equipamento não pertence à sua conta.'; end if;
 v_token := encode(gen_random_bytes(32),'hex');
 insert into public.access_invites(property_id,device_id,created_by,guest_name,token_hash,starts_at,expires_at)
 values(v_property,p_device_id,auth.uid(),trim(p_guest_name),encode(digest(v_token,'sha256'),'hex'),p_starts_at,p_expires_at)
 returning id into v_id;
 return query select v_id,v_token;
end; $$;

create or replace function public.revoke_access_invite(p_invite_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_owner uuid;
begin
 if auth.uid() is null then raise exception 'É necessário entrar na conta.'; end if;
 select p.owner_id into v_owner from public.access_invites i
 join public.access_properties p on p.id=i.property_id where i.id=p_invite_id;
 if v_owner is null or v_owner <> auth.uid() then raise exception 'Convite não encontrado ou sem autorização.'; end if;
 update public.access_invites set status='revoked' where id=p_invite_id and status='active';
 return found;
end; $$;
revoke all on function public.create_access_invite(uuid,text,timestamptz,timestamptz) from public, anon;
revoke all on function public.revoke_access_invite(uuid) from public, anon;
grant execute on function public.create_access_invite(uuid,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.revoke_access_invite(uuid) to authenticated;
