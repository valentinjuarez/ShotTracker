import { supabase } from "@/src/lib/supabase";

export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

export async function getCurrentUserMetadata(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return (data.user?.user_metadata ?? {}) as Record<string, unknown>;
}

export async function getCurrentUserIdentity(): Promise<{
  id: string | null;
  displayName: string;
  email: string;
}> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const user = data.user;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (meta.display_name as string | undefined) ??
    (meta.username as string | undefined) ??
    (meta.full_name as string | undefined) ??
    "";

  return {
    id: user?.id ?? null,
    displayName,
    email: user?.email ?? "",
  };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function deleteOwnAuthUser(): Promise<void> {
  const { error } = await supabase.rpc("delete_own_auth_user");
  if (error) throw error;
}
