-- Fix team join by invite code and team avatar_url update under restrictive RLS.

drop function if exists public.join_team_by_code(text);
drop function if exists public.set_team_avatar_url(uuid, text);
drop function if exists public.delete_team_for_coach(uuid);

create or replace function public.join_team_by_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select t.id
  into v_team_id
  from public.teams t
  where upper(trim(t.invite_code)) = upper(trim(p_invite_code))
  limit 1;

  if v_team_id is null then
    raise exception 'Código de invitación inválido';
  end if;

  -- If user is already in the same team, succeed.
  if exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.team_id = v_team_id
  ) then
    return v_team_id;
  end if;

  -- Coaches cannot switch to player membership via invite code.
  if exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.role = 'coach'
  ) then
    raise exception 'No podés unirte como jugador/a porque ya sos entrenador/a de un equipo.';
  end if;

  -- If user already has player membership, move to target team.
  update public.team_members tm
  set team_id = v_team_id,
      role = 'player'
  where tm.user_id = auth.uid();

  if found then
    return v_team_id;
  end if;

  insert into public.team_members (user_id, team_id, role)
  values (auth.uid(), v_team_id, 'player');

  return v_team_id;
end;
$$;

revoke all on function public.join_team_by_code(text) from public;
grant execute on function public.join_team_by_code(text) to authenticated;

create or replace function public.set_team_avatar_url(p_team_id uuid, p_avatar_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.team_id = p_team_id
      and tm.role = 'coach'
  ) then
    raise exception 'No autorizado para editar el avatar del equipo.';
  end if;

  update public.teams t
  set avatar_url = p_avatar_url
  where t.id = p_team_id;

  if not found then
    raise exception 'Equipo no encontrado.';
  end if;
end;
$$;

revoke all on function public.set_team_avatar_url(uuid, text) from public;
grant execute on function public.set_team_avatar_url(uuid, text) to authenticated;

create or replace function public.delete_team_for_coach(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.team_id = p_team_id
      and tm.role = 'coach'
  ) then
    raise exception 'No autorizado para borrar este equipo.';
  end if;

  delete from public.team_workouts tw
  where tw.team_id = p_team_id;

  delete from public.team_members tm
  where tm.team_id = p_team_id;

  delete from public.teams t
  where t.id = p_team_id;

  if not found then
    raise exception 'Equipo no encontrado o no se pudo borrar.';
  end if;
end;
$$;

revoke all on function public.delete_team_for_coach(uuid) from public;
grant execute on function public.delete_team_for_coach(uuid) to authenticated;
