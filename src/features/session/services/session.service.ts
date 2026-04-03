import { supabase } from "@/src/lib/supabase";

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

export type SessionSpotRow = {
  id: string;
  session_id: string;
  spot_key: string;
  shot_type: "2PT" | "3PT";
  target_attempts: number;
  attempts: number;
  makes: number;
  order_index: number;
};

export type SessionRow = {
  id: string;
  title: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  workout_id: string | null;
};

export async function createSessionWithSpots(params: {
  userId: string;
  title: string;
  defaultTarget: number;
  selectedSpots: { id: string; shotType: "2PT" | "3PT" }[];
}) {
  const { userId, title, defaultTarget, selectedSpots } = params;

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      kind: "FREE",
      title,
      default_target_attempts: defaultTarget,
      status: "IN_PROGRESS",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (sessionError) throw sessionError;

  const sessionId = sessionRow?.id as string | undefined;
  if (!sessionId) throw new Error("No se pudo crear la sesión (sin id).");

  const rows = selectedSpots.map((spot, idx) => ({
    session_id: sessionId,
    user_id: userId,
    spot_key: spot.id,
    shot_type: spot.shotType,
    target_attempts: defaultTarget,
    attempts: defaultTarget,
    makes: 0,
    order_index: idx,
  }));

  const { error: spotsError } = await supabase.from("session_spots").insert(rows);
  if (spotsError) {
    await supabase.from("sessions").delete().eq("id", sessionId);
    throw spotsError;
  }

  return { sessionId };
}

export async function loadSessionSpots(sessionId: string): Promise<SessionSpotRow[]> {
  const { data, error } = await supabase
    .from("session_spots")
    .select("id, session_id, spot_key, shot_type, target_attempts, attempts, makes, order_index")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SessionSpotRow[];
}

export async function markSessionInProgress(sessionId: string, userId?: string) {
  const payload: Record<string, unknown> = {
    status: "IN_PROGRESS",
    started_at: new Date().toISOString(),
  };

  if (userId) payload.user_id = userId;

  const { error } = await supabase.from("sessions").update(payload).eq("id", sessionId);
  if (error) throw error;
}

export async function updateSessionSpotMakes(sessionSpotId: string, makes: number) {
  const { error } = await supabase.from("session_spots").update({ makes }).eq("id", sessionSpotId);
  if (error) throw error;
}

export async function finishSession(sessionId: string, finishedAt: string) {
  const { error } = await supabase
    .from("sessions")
    .update({ status: "DONE", finished_at: finishedAt })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function finishWorkoutIfComplete(workoutId: string) {
  const { data: workout, error: workoutError } = await supabase
    .from("workouts")
    .select("sessions_goal")
    .eq("id", workoutId)
    .single();
  if (workoutError) throw workoutError;

  const { count: doneCount, error: countError } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("workout_id", workoutId)
    .eq("status", "DONE");
  if (countError) throw countError;

  if (workout && doneCount !== null && doneCount >= workout.sessions_goal) {
    const { error } = await supabase.from("workouts").update({ status: "DONE" }).eq("id", workoutId);
    if (error) throw error;
  }
}

export async function getSessionHistory(userId: string): Promise<SessionRow[]> {
  // Get all session IDs: free sessions (user_id) + workout sessions (via workout_id)
  const { data: userWorkouts } = await supabase
    .from("workouts").select("id").eq("user_id", userId);
  const workoutIds = (userWorkouts ?? []).map((w: any) => w.id as string);

  const [{ data: freeSess }, { data: wkSess }] = await Promise.all([
    supabase.from("sessions").select("id").eq("user_id", userId),
    workoutIds.length > 0
      ? supabase.from("sessions").select("id").in("workout_id", workoutIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const allIds = [
    ...new Set([
      ...(freeSess ?? []).map((s: any) => s.id as string),
      ...(wkSess ?? []).map((s: any) => s.id as string),
    ]),
  ];

  if (!allIds.length) return [];

  const { data } = await supabase
    .from("sessions")
    .select("id, title, status, started_at, finished_at, workout_id")
    .in("id", allIds)
    .not("started_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(50);

  return (data ?? []) as SessionRow[];
}

export type SessionWithPct = SessionRow & { pct: number | null };

export async function getSessionsWithPercentages(sessionIds: string[]): Promise<Record<string, number | null>> {
  if (!sessionIds.length) return {};

  const { data: spots } = await supabase
    .from("session_spots")
    .select("session_id, attempts, makes")
    .in("session_id", sessionIds);

  const map: Record<string, { att: number; mk: number }> = {};
  (spots ?? []).forEach((s: any) => {
    if (!map[s.session_id]) map[s.session_id] = { att: 0, mk: 0 };
    map[s.session_id].att += s.attempts ?? 0;
    map[s.session_id].mk += s.makes ?? 0;
  });

  const pctMap: Record<string, number | null> = {};
  sessionIds.forEach((id) => {
    const agg = map[id];
    pctMap[id] = agg && agg.att > 0 ? agg.mk / agg.att : null;
  });

  return pctMap;
}

export async function getSessionAttemptsBySession(
  sessionIds: string[]
): Promise<Record<string, { attempts: number; makes: number }>> {
  if (!sessionIds.length) return {};

  const { data: spots, error } = await supabase
    .from("session_spots")
    .select("session_id, attempts, makes")
    .in("session_id", sessionIds);

  if (error) throw error;

  const totals: Record<string, { attempts: number; makes: number }> = {};
  (spots ?? []).forEach((s: any) => {
    const key = s.session_id as string;
    if (!totals[key]) totals[key] = { attempts: 0, makes: 0 };
    totals[key].attempts += s.attempts ?? 0;
    totals[key].makes += s.makes ?? 0;
  });

  return totals;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await supabase.from("session_spots").delete().eq("session_id", sessionId);
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

export async function getSessionNumber(sessionId: string): Promise<number> {
  const { data, error } = await supabase
    .from("sessions")
    .select("session_number")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data?.session_number ?? 0;
}

export async function getWorkoutSessionsForPdf(workoutId: string): Promise<{ id: string; session_number: number }[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, session_number")
    .eq("workout_id", workoutId)
    .neq("status", "PENDING")
    .order("session_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as { id: string; session_number: number }[];
}

export async function getSessionSpotsForPdf(sessionIds: string[]): Promise<{
  session_id: string;
  spot_key: string;
  makes: number;
  attempts: number;
  target_attempts: number;
  order_index: number;
}[]> {
  if (!sessionIds.length) return [];

  const { data, error } = await supabase
    .from("session_spots")
    .select("session_id, spot_key, makes, attempts, target_attempts, order_index")
    .in("session_id", sessionIds);

  if (error) throw error;
  return (data ?? []) as {
    session_id: string;
    spot_key: string;
    makes: number;
    attempts: number;
    target_attempts: number;
    order_index: number;
  }[];
}