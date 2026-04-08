-- Persist per-spot target attempts on workouts for CUSTOM plans.
-- This keeps target_per_spot as global default and adds targets_by_spot for overrides.

alter table public.workouts
  add column if not exists targets_by_spot jsonb;

-- Optional sanity check: when present, must be JSON object.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workouts_targets_by_spot_is_object_check'
  ) then
    alter table public.workouts
      add constraint workouts_targets_by_spot_is_object_check
      check (
        targets_by_spot is null
        or jsonb_typeof(targets_by_spot) = 'object'
      );
  end if;
end $$;

drop function if exists public.create_workout_session(text, text, integer, integer, text[]);
drop function if exists public.create_workout_session(text, text, integer, integer, text[], jsonb);

create or replace function public.create_workout_session(
  p_title text,
  p_shot_type text,
  p_sessions_goal integer,
  p_target_per_spot integer,
  p_spot_keys text[],
  p_targets_by_spot jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_workout_id uuid;
  v_session_id uuid;
  v_spot_key text;
  v_order integer := 0;
  v_spot_type text;
  v_target integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_shot_type not in ('2PT', '3PT', 'CUSTOM') then
    raise exception 'Invalid shot type: %', p_shot_type;
  end if;

  if p_sessions_goal is null or p_sessions_goal < 1 then
    raise exception 'sessions_goal must be >= 1';
  end if;

  if p_target_per_spot is null or p_target_per_spot < 1 then
    raise exception 'target_per_spot must be >= 1';
  end if;

  if p_spot_keys is null or array_length(p_spot_keys, 1) is null then
    raise exception 'spot_keys cannot be empty';
  end if;

  insert into public.workouts (
    user_id,
    title,
    status,
    shot_type,
    sessions_goal,
    target_per_spot,
    targets_by_spot
  )
  values (
    v_user_id,
    coalesce(nullif(trim(p_title), ''), 'Planilla'),
    'IN_PROGRESS',
    p_shot_type,
    p_sessions_goal,
    p_target_per_spot,
    case
      when p_targets_by_spot is not null and jsonb_typeof(p_targets_by_spot) = 'object' then p_targets_by_spot
      else null
    end
  )
  returning id into v_workout_id;

  insert into public.sessions (
    user_id,
    workout_id,
    kind,
    title,
    default_target_attempts,
    status,
    started_at,
    session_number
  )
  values (
    v_user_id,
    v_workout_id,
    'WORKOUT',
    coalesce(nullif(trim(p_title), ''), 'Planilla'),
    p_target_per_spot,
    'IN_PROGRESS',
    now(),
    1
  )
  returning id into v_session_id;

  foreach v_spot_key in array p_spot_keys
  loop
    v_spot_type := case
      when lower(v_spot_key) like '3pt_%' then '3PT'
      else '2PT'
    end;

    v_target := greatest(
      1,
      coalesce((p_targets_by_spot ->> v_spot_key)::int, p_target_per_spot)
    );

    insert into public.session_spots (
      session_id,
      user_id,
      spot_key,
      shot_type,
      target_attempts,
      attempts,
      makes,
      order_index
    )
    values (
      v_session_id,
      v_user_id,
      v_spot_key,
      v_spot_type,
      v_target,
      v_target,
      0,
      v_order
    );

    v_order := v_order + 1;
  end loop;

  return jsonb_build_object(
    'workout_id', v_workout_id,
    'session_id', v_session_id
  );
end;
$$;
