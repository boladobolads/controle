-- HostMaster Access: vincular cada convite ao e-mail autenticado do hóspede.
-- Execute uma única vez no SQL Editor do Supabase do HostMaster Access.

alter table public.access_invites
  add column if not exists guest_email text;

create index if not exists access_invites_guest_email_idx
  on public.access_invites (lower(guest_email));

-- Nova assinatura: mantém a função antiga para compatibilidade, mas a interface passa a usar esta.
create or replace function public.create_access_invite_multi(
  p_device_ids uuid[],
  p_guest_name text,
  p_guest_email text,
  p_starts_at timestamptz,
  p_expires_at timestamptz
)
returns table(invite_id uuid, invite_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_property uuid;
  v_first_device uuid;
  v_token text;
  v_id uuid;
  v_count integer;
  v_distinct_count integer;
  v_email text := lower(trim(coalesce(p_guest_email, '')));
begin
  if v_owner is null then
    raise exception 'É necessário entrar na conta do proprietário.';
  end if;
  if length(trim(coalesce(p_guest_name, ''))) not between 1 and 120 then
    raise exception 'Nome do hóspede inválido.';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+ then
    raise exception 'Informe um e-mail válido do hóspede.';
  end if;
  if p_starts_at is null or p_expires_at is null or p_expires_at <= p_starts_at then
    raise exception 'Período do convite inválido.';
  end if;
  if p_device_ids is null or cardinality(p_device_ids) < 1 or cardinality(p_device_ids) > 20 then
    raise exception 'Selecione de 1 a 20 equipamentos.';
  end if;

  select count(distinct x), min(x::text)::uuid
    into v_distinct_count, v_first_device
  from unnest(p_device_ids) as x;
  if v_distinct_count <> cardinality(p_device_ids) then
    raise exception 'Há equipamentos repetidos na seleção.';
  end if;

  select d.property_id into v_property
  from public.access_devices d
  join public.access_properties p on p.id = d.property_id
  where d.id = v_first_device and p.owner_id = v_owner;
  if v_property is null then
    raise exception 'Equipamento não pertence à sua conta.';
  end if;

  select count(*) into v_count
  from public.access_devices d
  join public.access_properties p on p.id = d.property_id
  where d.id = any(p_device_ids)
    and d.property_id = v_property
    and p.owner_id = v_owner;
  if v_count <> cardinality(p_device_ids) then
    raise exception 'Todos os equipamentos devem pertencer ao mesmo imóvel.';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.access_invites(
    property_id, device_id, created_by, guest_name, guest_email,
    token_hash, starts_at, expires_at
  )
  values(
    v_property, v_first_device, v_owner, trim(p_guest_name), v_email,
    encode(extensions.digest(v_token, 'sha256'), 'hex'), p_starts_at, p_expires_at
  )
  returning id into v_id;

  insert into public.access_invite_devices(invite_id, device_id)
  select v_id, unnest(p_device_ids);

  return query select v_id, v_token;
end;
$$;

-- A validação só retorna dados se houver sessão autenticada com o e-mail cadastrado pelo proprietário.
create or replace function public.validate_access_invite_devices(p_token text)
returns table(
  guest_name text,
  property_id uuid,
  property_title text,
  device_id uuid,
  device_name text,
  manufacturer text,
  is_authorized boolean,
  starts_at timestamptz,
  expires_at timestamptz,
  authorization_state text
)
language sql
security definer
set search_path = public, extensions
as $$
  with matched as (
    select i.*
    from public.access_invites i
    where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and auth.uid() is not null
      and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(coalesce(i.guest_email, ''))
    limit 1
  )
  select
    i.guest_name,
    p.id,
    p.title,
    d.id,
    d.device_name,
    d.manufacturer,
    exists (
      select 1 from public.access_invite_devices aid
      where aid.invite_id = i.id and aid.device_id = d.id
    ) or d.id = i.device_id,
    i.starts_at,
    i.expires_at,
    case
      when i.status <> 'active' then 'revoked'
      when now() < i.starts_at then 'not_started'
      when now() >= i.expires_at then 'expired'
      else 'valid'
    end
  from matched i
  join public.access_properties p on p.id = i.property_id
  join public.access_devices d on d.property_id = p.id
  order by d.created_at, d.device_name;
$$;

revoke all on function public.create_access_invite_multi(uuid[], text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.create_access_invite_multi(uuid[], text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_access_invite_multi(uuid[], text, text, timestamptz, timestamptz) to authenticated;
revoke all on function public.validate_access_invite_devices(text) from public, anon;
grant execute on function public.validate_access_invite_devices(text) to authenticated;
 then
    raise exception 'Informe um e-mail válido do hóspede.';
  end if;
  if p_starts_at is null or p_expires_at is null or p_expires_at <= p_starts_at then
    raise exception 'Período do convite inválido.';
  end if;
  if p_device_ids is null or cardinality(p_device_ids) < 1 or cardinality(p_device_ids) > 20 then
    raise exception 'Selecione de 1 a 20 equipamentos.';
  end if;

  select count(distinct x), min(x::text)::uuid
    into v_distinct_count, v_first_device
  from unnest(p_device_ids) as x;
  if v_distinct_count <> cardinality(p_device_ids) then
    raise exception 'Há equipamentos repetidos na seleção.';
  end if;

  select d.property_id into v_property
  from public.access_devices d
  join public.access_properties p on p.id = d.property_id
  where d.id = v_first_device and p.owner_id = v_owner;
  if v_property is null then
    raise exception 'Equipamento não pertence à sua conta.';
  end if;

  select count(*) into v_count
  from public.access_devices d
  join public.access_properties p on p.id = d.property_id
  where d.id = any(p_device_ids)
    and d.property_id = v_property
    and p.owner_id = v_owner;
  if v_count <> cardinality(p_device_ids) then
    raise exception 'Todos os equipamentos devem pertencer ao mesmo imóvel.';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.access_invites(
    property_id, device_id, created_by, guest_name, guest_email,
    token_hash, starts_at, expires_at
  )
  values(
    v_property, v_first_device, v_owner, trim(p_guest_name), v_email,
    encode(extensions.digest(v_token, 'sha256'), 'hex'), p_starts_at, p_expires_at
  )
  returning id into v_id;

  insert into public.access_invite_devices(invite_id, device_id)
  select v_id, unnest(p_device_ids);

  return query select v_id, v_token;
end;
$$;

-- A validação só retorna dados se houver sessão autenticada com o e-mail cadastrado pelo proprietário.
create or replace function public.validate_access_invite_devices(p_token text)
returns table(
  guest_name text,
  property_id uuid,
  property_title text,
  device_id uuid,
  device_name text,
  manufacturer text,
  is_authorized boolean,
  starts_at timestamptz,
  expires_at timestamptz,
  authorization_state text
)
language sql
security definer
set search_path = public, extensions
as $$
  with matched as (
    select i.*
    from public.access_invites i
    where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and auth.uid() is not null
      and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(coalesce(i.guest_email, ''))
    limit 1
  )
  select
    i.guest_name,
    p.id,
    p.title,
    d.id,
    d.device_name,
    d.manufacturer,
    exists (
      select 1 from public.access_invite_devices aid
      where aid.invite_id = i.id and aid.device_id = d.id
    ) or d.id = i.device_id,
    i.starts_at,
    i.expires_at,
    case
      when i.status <> 'active' then 'revoked'
      when now() < i.starts_at then 'not_started'
      when now() >= i.expires_at then 'expired'
      else 'valid'
    end
  from matched i
  join public.access_properties p on p.id = i.property_id
  join public.access_devices d on d.property_id = p.id
  order by d.created_at, d.device_name;
$$;

revoke all on function public.create_access_invite_multi(uuid[], text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.create_access_invite_multi(uuid[], text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_access_invite_multi(uuid[], text, text, timestamptz, timestamptz) to authenticated;
revoke all on function public.validate_access_invite_devices(text) from public, anon;
grant execute on function public.validate_access_invite_devices(text) to authenticated;
