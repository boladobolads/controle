-- HostMaster Access: validação do link de convite pelo hóspede.
-- Não executa abertura física do equipamento.

create or replace function public.validate_access_invite(p_token text)
returns table(
 guest_name text,
 device_name text,
 manufacturer text,
 starts_at timestamptz,
 expires_at timestamptz,
 authorization_state text
)
language sql
security definer
set search_path = public, extensions
as $$
 select
  i.guest_name,
  d.device_name,
  d.manufacturer,
  i.starts_at,
  i.expires_at,
  case
   when i.status <> 'active' then 'revoked'
   when now() < i.starts_at then 'not_started'
   when now() > i.expires_at then 'expired'
   else 'valid'
  end
 from public.access_invites i
 join public.access_devices d on d.id = i.device_id
 where i.token_hash = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex')
 limit 1;
$$;

revoke all on function public.validate_access_invite(text) from public;
grant execute on function public.validate_access_invite(text) to anon, authenticated;
