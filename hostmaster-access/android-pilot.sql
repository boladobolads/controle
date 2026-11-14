-- HostMaster Access: cadastro seguro de uma central Android por imóvel.
-- Execute este arquivo isoladamente no SQL Editor do NOVO projeto Supabase do Access.
-- Não executa comandos físicos na fechadura.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.access_android_nodes (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.access_properties(id) on delete cascade,
 node_name text not null default 'HostMaster Android',
 status text not null default 'pending'
   check (status in ('pending','paired','online','offline','revoked')),
 pairing_code_hash text unique,
 pairing_expires_at timestamptz,
 node_secret_hash text,
 app_version text,
 last_seen_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 paired_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create unique index if not exists access_android_nodes_one_active_per_property
 on public.access_android_nodes(property_id)
 where status <> 'revoked';

alter table public.access_android_nodes enable row level security;
drop policy if exists own_android_nodes_read on public.access_android_nodes;
create policy own_android_nodes_read on public.access_android_nodes
 for select to authenticated
 using (exists (
   select 1 from public.access_properties p
   where p.id = property_id and p.owner_id = auth.uid()
 ));

revoke all on public.access_android_nodes from anon, authenticated;
grant select on public.access_android_nodes to authenticated;

create or replace function public.create_android_pairing(
 p_property_id uuid,
 p_node_name text default 'HostMaster Android'
)
returns table(node_id uuid, pairing_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
 v_owner uuid := auth.uid();
 v_node_id uuid;
 v_code text;
 v_expires_at timestamptz := now() + interval '10 minutes';
begin
 if v_owner is null then
   raise exception 'É necessário entrar como proprietário.';
 end if;

 if not exists (
   select 1 from public.access_properties p
   where p.id = p_property_id and p.owner_id = v_owner
 ) then
   raise exception 'Imóvel não encontrado ou sem permissão.';
 end if;

 update public.access_android_nodes
 set status = 'revoked', pairing_code_hash = null, pairing_expires_at = null, updated_at = now()
 where property_id = p_property_id
   and status = 'pending'
   and pairing_expires_at <= now();

 if exists (
   select 1 from public.access_android_nodes n
   where n.property_id = p_property_id and n.status <> 'revoked'
 ) then
   raise exception 'Esta casa já possui uma central ativa. Desvincule-a antes de parear outra.';
 end if;

 v_code := encode(extensions.gen_random_bytes(24), 'hex');

 insert into public.access_android_nodes(
   property_id, node_name, status, pairing_code_hash, pairing_expires_at, created_by
 )
 values (
   p_property_id,
   coalesce(nullif(trim(p_node_name), ''), 'HostMaster Android'),
   'pending',
   encode(extensions.digest(v_code, 'sha256'), 'hex'),
   v_expires_at,
   v_owner
 )
 returning id into v_node_id;

 return query select v_node_id, v_code, v_expires_at;
end;
$$;

create or replace function public.claim_android_pairing(
 p_pairing_code text,
 p_node_name text default 'HostMaster Android',
 p_app_version text default null
)
returns table(
 node_id uuid,
 node_secret text,
 property_id uuid,
 property_title text,
 node_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
 v_node_id uuid;
 v_property_id uuid;
 v_property_title text;
 v_node_name text;
 v_secret text;
begin
 if length(coalesce(trim(p_pairing_code), '')) <> 48 then
   raise exception 'Código de pareamento inválido ou expirado.';
 end if;

 select n.id, n.property_id, p.title, n.node_name
 into v_node_id, v_property_id, v_property_title, v_node_name
 from public.access_android_nodes n
 join public.access_properties p on p.id = n.property_id
 where n.pairing_code_hash = encode(extensions.digest(trim(p_pairing_code), 'sha256'), 'hex')
   and n.status = 'pending'
   and n.pairing_expires_at > now()
 for update of n;

 if v_node_id is null then
   raise exception 'Código de pareamento inválido, expirado ou já utilizado.';
 end if;

 v_secret := encode(extensions.gen_random_bytes(32), 'hex');

 update public.access_android_nodes
 set status = 'paired',
     pairing_code_hash = null,
     pairing_expires_at = null,
     node_secret_hash = encode(extensions.digest(v_secret, 'sha256'), 'hex'),
     node_name = coalesce(nullif(trim(p_node_name), ''), v_node_name),
     app_version = p_app_version,
     paired_at = now(),
     updated_at = now()
 where id = v_node_id;

 return query select v_node_id, v_secret, v_property_id, v_property_title,
   coalesce(nullif(trim(p_node_name), ''), v_node_name);
end;
$$;

create or replace function public.heartbeat_android_node(
 p_node_id uuid,
 p_node_secret text,
 p_app_version text default null
)
returns table(node_status text, property_title text, last_seen_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
 return query
 update public.access_android_nodes n
 set status = 'online',
     last_seen_at = now(),
     app_version = coalesce(nullif(p_app_version, ''), n.app_version),
     updated_at = now()
 from public.access_properties p
 where n.id = p_node_id
   and n.property_id = p.id
   and n.node_secret_hash = encode(extensions.digest(coalesce(p_node_secret, ''), 'sha256'), 'hex')
   and n.status in ('paired','online','offline')
 returning n.status, p.title, n.last_seen_at;
end;
$$;

create or replace function public.revoke_android_node(p_node_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
 if auth.uid() is null or not exists (
   select 1
   from public.access_android_nodes n
   join public.access_properties p on p.id = n.property_id
   where n.id = p_node_id and p.owner_id = auth.uid()
 ) then
   raise exception 'Central não encontrada ou sem permissão.';
 end if;

 update public.access_android_nodes
 set status = 'revoked',
     pairing_code_hash = null,
     pairing_expires_at = null,
     node_secret_hash = null,
     updated_at = now()
 where id = p_node_id;
end;
$$;

revoke all on function public.create_android_pairing(uuid, text) from public;
revoke all on function public.claim_android_pairing(text, text, text) from public;
revoke all on function public.heartbeat_android_node(uuid, text, text) from public;
revoke all on function public.revoke_android_node(uuid) from public;

grant execute on function public.create_android_pairing(uuid, text) to authenticated;
grant execute on function public.claim_android_pairing(text, text, text) to anon, authenticated;
grant execute on function public.heartbeat_android_node(uuid, text, text) to anon, authenticated;
grant execute on function public.revoke_android_node(uuid) to authenticated;
