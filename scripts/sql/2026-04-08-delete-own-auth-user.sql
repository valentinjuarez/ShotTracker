-- Allow authenticated users to delete their own auth.users row via SECURITY DEFINER RPC.

create or replace function public.delete_own_auth_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  delete from auth.users
  where id = auth.uid();

  if not found then
    raise exception 'No se encontró el usuario autenticado en auth.users.';
  end if;
end;
$$;

revoke all on function public.delete_own_auth_user() from public;
grant execute on function public.delete_own_auth_user() to authenticated;
