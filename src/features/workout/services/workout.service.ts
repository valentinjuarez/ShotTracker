import { supabase } from "@/src/lib/supabase";

export type WorkoutRow = {
  id: string;
  title: string;
  status: string;
  shot_type: string;
  sessions_goal: number;
  created_at: string;
};

export type SessionRow = {
  id: string;
  workout_id: string;
  session_number: number;
  status: string;
  finished_at: string | null;
  pct: number | null;
};

export type WorkoutData = {
  id: string;
  title: string;
  shot_type: string;
  sessions_goal: number;
  target_per_spot: number;
  spot_keys?: string[] | null;
  targets_by_spot?: Record<string, number> | null;
};

export type WorkoutTemplateData = WorkoutData & {
  spot_keys: string[];
};

export type WorkoutSessionDetail = {
  id: string;
  sessionNumber: number;
  status: string;
  finishedAt: string | null;
  attempts: number;
  makes: number;
  pct: number | null;
  spots: { spotKey: string; attempts: number; makes: number; pct: number }[];
};

export type WorkoutSessionCounts = {
  total: number;
  done: number;
};

export async function createWorkoutSession(params: {
  title: string;
  shotType: "3PT" | "2PT" | "CUSTOM";
  sessionsGoal: number;
  targetPerSpot: number;
  spotKeys: string[];
  targetsBySpotKey?: Record<string, number>;
}) {
  const { title, shotType, sessionsGoal, targetPerSpot, spotKeys, targetsBySpotKey } = params;

  let data: unknown = null;
  let error: any = null;
  let usedLegacyFallback = false;

  // New RPC signature supports p_targets_by_spot, but keep backward compatibility.
  ({ data, error } = await supabase.rpc("create_workout_session", {
    p_title: title,
    p_shot_type: shotType,
    p_sessions_goal: sessionsGoal,
    p_target_per_spot: targetPerSpot,
    p_spot_keys: spotKeys,
    p_targets_by_spot: targetsBySpotKey ?? null,
  }));

  if (error && targetsBySpotKey) {
    usedLegacyFallback = true;
    ({ data, error } = await supabase.rpc("create_workout_session", {
      p_title: title,
      p_shot_type: shotType,
      p_sessions_goal: sessionsGoal,
      p_target_per_spot: targetPerSpot,
      p_spot_keys: spotKeys,
    }));
  }

  if (error) throw error;

  const sessionId = (data as { session_id?: string } | null)?.session_id ?? null;
  if (usedLegacyFallback && sessionId && targetsBySpotKey && Object.keys(targetsBySpotKey).length > 0) {
    await updateSessionSpotTargets(sessionId, targetsBySpotKey);
  }

  return {
    workoutId: (data as { workout_id?: string } | null)?.workout_id ?? null,
    sessionId,
  };
}

export async function updateWorkoutTemplate(params: {
  workoutId: string;
  title: string;
  shotType: "3PT" | "2PT" | "CUSTOM";
  sessionsGoal: number;
  targetPerSpot: number;
  spotKeys: string[];
  targetsBySpotKey?: Record<string, number>;
}): Promise<void> {
  const {
    workoutId,
    title,
    shotType,
    sessionsGoal,
    targetPerSpot,
    spotKeys,
    targetsBySpotKey,
  } = params;

  const normalizedTargets =
    shotType === "CUSTOM" && targetsBySpotKey
      ? Object.fromEntries(
          spotKeys
            .filter((spotKey) => Number.isFinite(targetsBySpotKey[spotKey]))
            .map((spotKey) => [spotKey, Math.max(1, Math.round(targetsBySpotKey[spotKey]))]),
        )
      : null;

  const { error } = await supabase
    .from("workouts")
    .update({
      title,
      shot_type: shotType,
      sessions_goal: sessionsGoal,
      target_per_spot: targetPerSpot,
      spot_keys: spotKeys,
      targets_by_spot: normalizedTargets,
    })
    .eq("id", workoutId);

  if (error) throw error;
}

export async function getWorkoutTemplateForEdit(workoutId: string): Promise<WorkoutTemplateData | null> {
  const workout = await getWorkoutMetadata(workoutId);
  if (!workout) return null;

  let spotKeys = Array.isArray(workout.spot_keys) ? workout.spot_keys : [];

  if (spotKeys.length === 0) {
    const { data: templateSession, error: templateSessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("workout_id", workoutId)
      .order("session_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (templateSessionError) throw templateSessionError;

    if (templateSession?.id) {
      const { data: spots, error: spotsError } = await supabase
        .from("session_spots")
        .select("spot_key")
        .eq("session_id", templateSession.id)
        .order("order_index", { ascending: true });

      if (spotsError) throw spotsError;

      spotKeys = (spots ?? []).map((row: any) => row.spot_key as string);
    }
  }

  if (spotKeys.length === 0) return null;

  return {
    ...workout,
    spot_keys: spotKeys,
  };
}

export async function updateSessionSpotTargets(
  sessionId: string,
  targetsBySpotKey: Record<string, number>,
): Promise<void> {
  const entries = Object.entries(targetsBySpotKey);
  for (const [spotKey, target] of entries) {
    const safeTarget = Math.max(1, Math.round(target));
    const { error } = await supabase
      .from("session_spots")
      .update({ target_attempts: safeTarget, attempts: safeTarget })
      .eq("session_id", sessionId)
      .eq("spot_key", spotKey);
    if (error) throw error;
  }
}

export async function getUserWorkouts(userId: string): Promise<WorkoutRow[]> {
  const { data, error } = await supabase
    .from("workouts")
    .select("id, title, status, shot_type, sessions_goal, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkoutRow[];
}

export async function getWorkoutSessions(workoutId: string): Promise<SessionRow[]> {
  const { data: sessList, error } = await supabase
    .from("sessions")
    .select("id, workout_id, session_number, status, finished_at")
    .eq("workout_id", workoutId)
    .order("session_number", { ascending: true });

  if (error) throw error;

  const rows = (sessList ?? []) as Omit<SessionRow, "pct">[];

  // Fetch pct for DONE sessions
  const doneIds = rows.filter((s) => s.status === "DONE").map((s) => s.id);
  let pctMap: Record<string, number | null> = {};

  if (doneIds.length > 0) {
    const { data: spots } = await supabase
      .from("session_spots")
      .select("session_id, attempts, makes")
      .in("session_id", doneIds);

    const agg: Record<string, { att: number; mk: number }> = {};
    (spots ?? []).forEach((s: any) => {
      if (!agg[s.session_id]) agg[s.session_id] = { att: 0, mk: 0 };
      agg[s.session_id].att += s.attempts ?? 0;
      agg[s.session_id].mk += s.makes ?? 0;
    });

    doneIds.forEach((id) => {
      const a = agg[id];
      pctMap[id] = a && a.att > 0 ? a.mk / a.att : null;
    });
  }

  return rows.map((r) => ({
    ...r,
    pct: pctMap[r.id] ?? null,
  }));
}

export async function getWorkoutMetadata(workoutId: string): Promise<WorkoutData | null> {
  const { data, error } = await supabase
    .from("workouts")
    .select("id, title, shot_type, sessions_goal, target_per_spot, spot_keys, targets_by_spot")
    .eq("id", workoutId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as WorkoutData | null;
}

export async function getWorkoutSessionCountsByWorkoutIds(
  workoutIds: string[],
): Promise<Record<string, WorkoutSessionCounts>> {
  if (!workoutIds.length) return {};

  const uniqueWorkoutIds = [...new Set(workoutIds)];
  const { data, error } = await supabase
    .from("sessions")
    .select("workout_id, status")
    .in("workout_id", uniqueWorkoutIds);

  if (error) throw error;

  const counts: Record<string, WorkoutSessionCounts> = {};
  uniqueWorkoutIds.forEach((id) => {
    counts[id] = { total: 0, done: 0 };
  });

  (data ?? []).forEach((row: any) => {
    const workoutId = row.workout_id as string | null;
    if (!workoutId) return;
    if (!counts[workoutId]) counts[workoutId] = { total: 0, done: 0 };
    counts[workoutId].total += 1;
    if (row.status === "DONE") counts[workoutId].done += 1;
  });

  return counts;
}

export async function applyWorkoutTargetsToSession(sessionId: string, workoutId: string): Promise<void> {
  const workout = await getWorkoutMetadata(workoutId);
  const map = (workout?.targets_by_spot ?? null) as Record<string, number> | null;
  if (!map || typeof map !== "object" || Object.keys(map).length === 0) return;
  await updateSessionSpotTargets(sessionId, map);
}

export async function createNextWorkoutSession(workoutId: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_next_workout_session", {
    p_workout_id: workoutId,
  });

  if (error) throw error;

  const sessionId = (data as { session_id?: string } | null)?.session_id;
  if (!sessionId) throw new Error("No se pudo crear la sesión siguiente.");
  return sessionId;
}

export async function getLatestWorkoutProgress(userId: string): Promise<{
  id: string;
  title: string;
  status: string;
  sessionsGoal: number;
  completedSessions: number;
  currentSessionId: string | null;
} | null> {
  const { data: wk, error: wkError } = await supabase
    .from("workouts")
    .select("id, title, sessions_goal, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (wkError) throw wkError;

  const w = (wk ?? [])[0] as {
    id: string;
    title: string;
    sessions_goal: number | null;
    status: string;
  } | undefined;

  if (!w) return null;

  const { count: doneCount, error: doneError } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("workout_id", w.id)
    .eq("status", "DONE");
  if (doneError) throw doneError;

  const { data: activeSess, error: activeError } = await supabase
    .from("sessions")
    .select("id")
    .eq("workout_id", w.id)
    .eq("status", "IN_PROGRESS")
    .order("session_number", { ascending: false })
    .limit(1);
  if (activeError) throw activeError;

  return {
    id: w.id,
    title: w.title,
    status: w.status,
    sessionsGoal: w.sessions_goal ?? 0,
    completedSessions: doneCount ?? 0,
    currentSessionId: (activeSess ?? [])[0]?.id ?? null,
  };
}

export async function deleteWorkoutWithSessions(workoutId: string): Promise<void> {
  const { data: sids, error: sidsError } = await supabase
    .from("sessions")
    .select("id")
    .eq("workout_id", workoutId);
  if (sidsError) throw sidsError;

  const ids = (sids ?? []).map((s: any) => s.id as string);
  if (ids.length > 0) {
    const { error: spotsError } = await supabase.from("session_spots").delete().in("session_id", ids);
    if (spotsError) throw spotsError;

    const { error: sessionsError } = await supabase.from("sessions").delete().in("id", ids);
    if (sessionsError) throw sessionsError;
  }

  const { data: deletedWorkout, error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!deletedWorkout) {
    throw new Error("No se pudo borrar la planilla indicada.");
  }
}

export async function getWorkoutSessionsDetailed(workoutId: string): Promise<WorkoutSessionDetail[]> {
  const { data: sessList, error: sessError } = await supabase
    .from("sessions")
    .select("id, session_number, status, finished_at")
    .eq("workout_id", workoutId)
    .order("session_number", { ascending: true });
  if (sessError) throw sessError;

  const rows = (sessList ?? []) as { id: string; session_number: number; status: string; finished_at: string | null }[];
  const sessionIds = rows.map((r) => r.id);

  let spotsRaw: any[] = [];
  if (sessionIds.length > 0) {
    const { data: sp, error: spotsError } = await supabase
      .from("session_spots")
      .select("session_id, spot_key, attempts, makes")
      .in("session_id", sessionIds);
    if (spotsError) throw spotsError;
    spotsRaw = sp ?? [];
  }

  const sessAgg: Record<string, { att: number; mk: number }> = {};
  spotsRaw.forEach((s) => {
    if (!sessAgg[s.session_id]) sessAgg[s.session_id] = { att: 0, mk: 0 };
    sessAgg[s.session_id].att += s.attempts ?? 0;
    sessAgg[s.session_id].mk += s.makes ?? 0;
  });

  const spotsBySession: Record<string, Record<string, { att: number; mk: number }>> = {};
  spotsRaw.forEach((s) => {
    if (!spotsBySession[s.session_id]) spotsBySession[s.session_id] = {};
    if (!spotsBySession[s.session_id][s.spot_key]) spotsBySession[s.session_id][s.spot_key] = { att: 0, mk: 0 };
    spotsBySession[s.session_id][s.spot_key].att += s.attempts ?? 0;
    spotsBySession[s.session_id][s.spot_key].mk += s.makes ?? 0;
  });

  return rows.map((r) => {
    const a = sessAgg[r.id] ?? { att: 0, mk: 0 };
    const sessSpots = Object.entries(spotsBySession[r.id] ?? {}).map(([key, v]) => ({
      spotKey: key,
      attempts: v.att,
      makes: v.mk,
      pct: v.att > 0 ? v.mk / v.att : 0,
    }));

    return {
      id: r.id,
      sessionNumber: r.session_number,
      status: r.status,
      finishedAt: r.finished_at ?? null,
      attempts: a.att,
      makes: a.mk,
      pct: a.att > 0 ? a.mk / a.att : null,
      spots: sessSpots,
    };
  });
}