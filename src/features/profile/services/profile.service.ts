import { supabase } from "@/src/lib/supabase";

function throwIfError(error: { message?: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message ?? "unknown error"}`);
  }
}

export type UserRole = "player" | "coach";

export type Profile = {
  id: string;
  display_name: string | null;
  role: UserRole;
};

function resolveMetaRole(userMetadata: Record<string, unknown> | undefined): UserRole {
  return userMetadata?.role === "coach" ? "coach" : "player";
}

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaRole = resolveMetaRole(meta);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    const { data: created, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name:
          (meta.display_name as string | undefined) ?? (meta.full_name as string | undefined) ?? null,
        role: metaRole,
      })
      .select("id, display_name, role")
      .single();

    if (insertError) {
      console.warn("[profile.service] insert failed:", insertError.message);
      return {
        id: user.id,
        display_name:
          (meta.display_name as string | undefined) ?? (meta.full_name as string | undefined) ?? null,
        role: metaRole,
      };
    }

    return created
      ? {
          id: created.id,
          display_name:
            created.display_name ??
            (meta.display_name as string | undefined) ??
            (meta.full_name as string | undefined) ??
            null,
          role: (created.role as UserRole) ?? metaRole,
        }
      : null;
  }

  return {
    id: data.id,
    display_name:
      data.display_name ?? (meta.display_name as string | undefined) ?? (meta.full_name as string | undefined) ?? null,
    role: (data.role as UserRole) ?? metaRole,
  };
}

export type UserStats = {
  totalSessions: number;
  totalAttempts: number;
  totalMakes: number;
  bestPct: number | null;
};

export async function getUserStats(userId: string): Promise<UserStats> {
  // Collect ALL session IDs: free sessions (user_id) + workout sessions (workout_id in user's workouts)
  const { data: userWorkouts } = await supabase
    .from("workouts").select("id").eq("user_id", userId);
  const workoutIds = (userWorkouts ?? []).map((w: any) => w.id as string);

  const [{ data: freeSess }, { data: wkSess }] = await Promise.all([
    supabase.from("sessions").select("id").eq("user_id", userId),
    workoutIds.length > 0
      ? supabase.from("sessions").select("id").in("workout_id", workoutIds)
      : Promise.resolve({ data: [] }),
  ]);

  const ids = [
    ...new Set([
      ...(freeSess ?? []).map((s: any) => s.id as string),
      ...(wkSess ?? []).map((s: any) => s.id as string),
    ]),
  ];

  if (ids.length === 0) {
    return { totalSessions: 0, totalAttempts: 0, totalMakes: 0, bestPct: null };
  }

  const { data: spots } = await supabase
    .from("session_spots")
    .select("session_id, attempts, makes")
    .in("session_id", ids);

  const sp = (spots ?? []) as { session_id: string; attempts: number; makes: number }[];
  const att = sp.reduce((a, s) => a + (s.attempts ?? 0), 0);
  const mk = sp.reduce((a, s) => a + (s.makes ?? 0), 0);

  // best session pct
  const bySession: Record<string, { att: number; mk: number }> = {};
  sp.forEach((s) => {
    if (!bySession[s.session_id]) bySession[s.session_id] = { att: 0, mk: 0 };
    bySession[s.session_id].att += s.attempts ?? 0;
    bySession[s.session_id].mk += s.makes ?? 0;
  });

  const pcts = Object.values(bySession)
    .filter((v) => v.att > 0)
    .map((v) => v.mk / v.att);
  const bestPct = pcts.length > 0 ? Math.max(...pcts) : null;

  return { totalSessions: ids.length, totalAttempts: att, totalMakes: mk, bestPct };
}

export async function deleteUserAccount(userId: string): Promise<void> {
  // Delete spots for ALL sessions (free + workout)
  const { data: userWorkouts } = await supabase
    .from("workouts").select("id").eq("user_id", userId);
  const workoutIds = (userWorkouts ?? []).map((w: any) => w.id as string);

  const [{ data: freeSess }, { data: wkSess }] = await Promise.all([
    supabase.from("sessions").select("id").eq("user_id", userId),
    workoutIds.length > 0
      ? supabase.from("sessions").select("id").in("workout_id", workoutIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const allSessionIds = [
    ...new Set([
      ...(freeSess ?? []).map((s: any) => s.id as string),
      ...(wkSess ?? []).map((s: any) => s.id as string),
    ]),
  ];

  // Delete spots
  if (allSessionIds.length > 0) {
    const { error } = await supabase
      .from("session_spots")
      .delete()
      .in("session_id", allSessionIds);
    throwIfError(error, "No se pudieron borrar session_spots");
  }

  // Delete sessions
  if (allSessionIds.length > 0) {
    const { error } = await supabase
      .from("sessions")
      .delete()
      .in("id", allSessionIds);
    throwIfError(error, "No se pudieron borrar sessions");
  }

  // Delete workouts
  if (workoutIds.length > 0) {
    const { error } = await supabase
      .from("workouts")
      .delete()
      .in("id", workoutIds);
    throwIfError(error, "No se pudieron borrar workouts");
  }

  // Delete references to the user in team-related tables before profile removal
  {
    const { error } = await supabase
      .from("team_workouts")
      .delete()
      .eq("user_id", userId);
    throwIfError(error, "No se pudieron borrar team_workouts del usuario");
  }

  {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", userId);
    throwIfError(error, "No se pudo borrar team_members del usuario");
  }

  // Delete profile
  {
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    throwIfError(error, "No se pudo borrar profile del usuario");
  }
}