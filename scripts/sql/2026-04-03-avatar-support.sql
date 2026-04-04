-- Avatar support for profiles and teams.

alter table if exists public.profiles
  add column if not exists avatar_url text;

alter table if exists public.teams
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Read avatars publicly.
drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

-- Authenticated users can manage only their own profile avatar file.
drop policy if exists "User manages own profile avatar" on storage.objects;
create policy "User manages own profile avatar"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'avatars'
  and name = ('profiles/' || auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and name = ('profiles/' || auth.uid()::text)
);

-- Coaches can manage avatar for teams where they are coach.
drop policy if exists "Coach manages own team avatar" on storage.objects;
create policy "Coach manages own team avatar"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'teams'
  and exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.role = 'coach'
      and tm.team_id::text = split_part(name, '/', 2)
  )
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'teams'
  and exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.role = 'coach'
      and tm.team_id::text = split_part(name, '/', 2)
  )
);
