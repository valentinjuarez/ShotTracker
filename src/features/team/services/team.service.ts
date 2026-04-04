import { deleteAvatarAtPath, uploadAvatarAtPath } from "@/src/features/media/services/avatar.service";
import { supabase } from "@/src/lib/supabase";

export type Team = {
  id: string;
  name: string;
  invite_code: string;
  avatar_url?: string | null;
};

export type MemberRow = {
  id: string;
  user_id: string;
  role: "player" | "coach";
  joined_at: string;
  display_name: string | null;
  avatar_url?: string | null;
};

export type PlayerStat = {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
  sessions: number;
  attempts: number;
  makes: number;
  pct: number | null;
  lastActive: string | null;
};

export type TeamStats = {
  players: number;
  totalSessions: number;
  totalAttempts: number;
  teamPct: number | null;
};

export type TeamWorkoutShare = {
  id: string;
  title: string;
  status: string;
};

export type CoachSharedWorkoutEntry = {
  shareId: string;
  workoutId: string;
  title: string;
  status: string;
  shotType: string;
  sessionsGoal: number;
  sharedAt: string | null;
  playerId: string;
  playerName: string;
  playerAvatarUrl?: string | null;
};

export type SpotBreakdown = {
  spot_key: string;
  shot_type: string;
  attempts: number;
  makes: number;
  pct: number;
};

export type CoachPlayerDetail = {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
  sessions: number;
  attempts: number;
  makes: number;
  pct: number | null;
  lastActive: string | null;
  spotBreakdown: SpotBreakdown[];
};

export async function getUserTeam(userId: string): Promise<{ team: Team; memberRole: "player" | "coach" } | null> {
  const { data: membership, error } = await supabase
    .from("team_members")
    .select("id, team_id, user_id, role, joined_at, teams(id, name, invite_code, avatar_url)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return null;
    }
    throw error;
  }

  if (!membership) return null;

  const t = (membership as any).teams as Team;
  return {
    team: t,
    memberRole: (membership as any).role ?? "player",
  };
}

export async function getTeamMembers(teamId: string): Promise<MemberRow[]> {
  const { data: allMembers, error } = await supabase
    .from("team_members")
    .select("id, user_id, role, joined_at")
    .eq("team_id", teamId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  const memberIds = (allMembers ?? []).map((m: any) => m.user_id);
  let profileMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {};

  if (memberIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", memberIds);

    (profileRows ?? []).forEach((p: any) => {
      profileMap[p.id] = {
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
      };
    });
  }

  return (allMembers ?? []).map((m: any) => ({
    ...m,
    display_name: profileMap[m.user_id]?.display_name ?? null,
    avatar_url: profileMap[m.user_id]?.avatar_url ?? null,
  })) as MemberRow[];
}

export async function joinTeamByCode(userId: string, inviteCode: string): Promise<void> {
  const normalizedCode = inviteCode.trim().toUpperCase();

  if (!normalizedCode) {
    throw new Error("Código de invitación inválido");
  }

  // Prefer RPC if available; it can bypass restrictive RLS safely.
  const { error: rpcJoinError } = await supabase.rpc("join_team_by_code", {
    p_invite_code: normalizedCode,
  });

  if (!rpcJoinError) {
    return;
  }

  // Function missing in DB: fallback to table-based flow.
  if (rpcJoinError.code !== "42883") {
    throw new Error(rpcJoinError.message ?? "No se pudo validar el código de invitación.");
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("invite_code", normalizedCode)
    .maybeSingle();

  if (teamError) {
    throw new Error(teamError.message ?? "No se pudo validar el código de invitación.");
  }
  if (!team) throw new Error("Código de invitación inválido");

  const { data: existingMembership, error: existingError } = await supabase
    .from("team_members")
    .select("id, team_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message ?? "No se pudo verificar tu equipo actual.");
  }

  if (existingMembership) {
    const currentTeamId = (existingMembership as any).team_id as string;
    const currentRole = (existingMembership as any).role as "player" | "coach";

    if (currentTeamId === team.id) {
      return;
    }

    if (currentRole === "coach") {
      throw new Error("No podés unirte como jugador/a porque ya sos entrenador/a de un equipo.");
    }

    const { error: updateError } = await supabase
      .from("team_members")
      .update({ team_id: team.id, role: "player" })
      .eq("id", (existingMembership as any).id);

    if (updateError) {
      if (updateError.code === "42501") {
        throw new Error("No tenés permisos para cambiar de equipo. Revisá las políticas RLS de team_members.");
      }
      throw new Error(updateError.message ?? "No se pudo actualizar tu equipo.");
    }

    return;
  }

  const { error } = await supabase.from("team_members").insert({
    user_id: userId,
    team_id: team.id,
    role: "player",
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya formás parte de un equipo.");
    }
    if (error.code === "42501") {
      throw new Error("No tenés permisos para unirte al equipo. Revisá las políticas RLS de team_members.");
    }
    throw new Error(error.message ?? "No se pudo unir al equipo.");
  }
}

export async function leaveTeam(userId: string): Promise<void> {
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}

export async function createTeam(userId: string, teamName: string, inviteCode: string): Promise<Team> {
  // Check if coach already has a team
  const { data: existing } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();

  if (existing) {
    throw new Error("Ya sos entrenador/a de un equipo.");
  }

  // Create team via security definer function (bypasses RLS safely)
  const { data: team, error: teamErr } = await supabase.rpc("create_team", {
    team_name: teamName,
    invite_code: inviteCode,
  });

  if (teamErr) throw teamErr;

  return {
    id: (team as any).id ?? "",
    name: (team as any).name ?? teamName,
    invite_code: (team as any).invite_code ?? inviteCode,
    avatar_url: (team as any).avatar_url ?? null,
  };
}

export async function deleteTeam(teamId: string): Promise<void> {
  await deleteAvatarAtPath(`teams/${teamId}`).catch(() => {});

  // Prefer RPC first to keep authorization + cascading deletes consistent under RLS.
  const { error: rpcDeleteError } = await supabase.rpc("delete_team_for_coach", {
    p_team_id: teamId,
  });

  if (!rpcDeleteError) {
    return;
  }

  // Function missing in DB: fallback to table-based flow.
  if (rpcDeleteError.code !== "42883") {
    throw rpcDeleteError;
  }

  const { error: teamWorkoutsError } = await supabase
    .from("team_workouts")
    .delete()
    .eq("team_id", teamId);
  if (teamWorkoutsError) throw teamWorkoutsError;

  const { error: membersError } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId);
  if (membersError) throw membersError;

  const { data: deletedTeam, error } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId)
    .select("id")
    .maybeSingle();

  if (!error && deletedTeam) {
    return;
  }

  if (error && error.code !== "42501") {
    throw error;
  }

  throw new Error("No se pudo borrar el equipo. Ejecutá la migración SQL que crea la función delete_team_for_coach.");
}

export async function updateTeamAvatar(teamId: string, coachUserId: string, fileUri: string): Promise<string> {
  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", coachUserId)
    .eq("role", "coach")
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) throw new Error("No autorizado para editar el avatar del equipo.");

  const path = `teams/${teamId}`;
  const publicUrl = await uploadAvatarAtPath(path, fileUri);

  const { data: updatedTeam, error } = await supabase
    .from("teams")
    .update({ avatar_url: publicUrl })
    .eq("id", teamId)
    .select("id")
    .maybeSingle();

  if (!error && updatedTeam) {
    return publicUrl;
  }

  if (error && error.code !== "42501") {
    throw error;
  }

  const { error: rpcError } = await supabase.rpc("set_team_avatar_url", {
    p_team_id: teamId,
    p_avatar_url: publicUrl,
  });

  if (!rpcError) {
    return publicUrl;
  }

  if (rpcError.code === "42883") {
    throw new Error("No hay permisos para guardar avatar_url del equipo. Ejecutá la migración SQL de funciones RPC.");
  }

  throw rpcError;
}

export async function getCoachDashboard(userId: string): Promise<{ team: Team; players: PlayerStat[] } | null> {
  // 1. Find coach's team
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, teams(id, name, invite_code, avatar_url)")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();

  if (!membership) return null;

  const t = (membership as any).teams as Team;

  // 2. Get all player members
  const { data: members } = await supabase
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", t.id)
    .eq("role", "player");

  const playerIds: string[] = (members ?? []).map((m: any) => m.user_id);

  if (!playerIds.length) {
    return { team: t, players: [] };
  }

  // 3. Get profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", playerIds);

  const profileMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
  (profiles ?? []).forEach((p: any) => {
    profileMap[p.id] = {
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
    };
  });

  // 4. Get sessions per player
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, user_id, started_at")
    .in("user_id", playerIds)
    .order("started_at", { ascending: false });

  const sessionsByPlayer: Record<string, string[]> = {};
  const lastActiveMap: Record<string, string> = {};
  (sessions ?? []).forEach((s: any) => {
    if (!sessionsByPlayer[s.user_id]) sessionsByPlayer[s.user_id] = [];
    sessionsByPlayer[s.user_id].push(s.id);
    if (!lastActiveMap[s.user_id]) lastActiveMap[s.user_id] = s.started_at;
  });

  const allSessionIds = (sessions ?? []).map((s: any) => s.id);

  // 5. Get spots aggregated
  let spotsData: any[] = [];
  if (allSessionIds.length > 0) {
    const { data: spots } = await supabase
      .from("session_spots")
      .select("session_id, attempts, makes")
      .in("session_id", allSessionIds);

    spotsData = spots ?? [];
  }

  // Build session→player map
  const sessionPlayerMap: Record<string, string> = {};
  (sessions ?? []).forEach((s: any) => {
    sessionPlayerMap[s.id] = s.user_id;
  });

  const aggByPlayer: Record<string, { att: number; mk: number }> = {};
  spotsData.forEach((sp: any) => {
    const pId = sessionPlayerMap[sp.session_id];
    if (!pId) return;
    if (!aggByPlayer[pId]) aggByPlayer[pId] = { att: 0, mk: 0 };
    aggByPlayer[pId].att += sp.attempts ?? 0;
    aggByPlayer[pId].mk += sp.makes ?? 0;
  });

  // Build results
  const players: PlayerStat[] = playerIds
    .map((pId) => ({
      user_id: pId,
      display_name: profileMap[pId]?.display_name ?? null,
      avatar_url: profileMap[pId]?.avatar_url ?? null,
      sessions: sessionsByPlayer[pId]?.length ?? 0,
      attempts: aggByPlayer[pId]?.att ?? 0,
      makes: aggByPlayer[pId]?.mk ?? 0,
      pct:
        aggByPlayer[pId] && aggByPlayer[pId].att > 0
          ? aggByPlayer[pId].mk / aggByPlayer[pId].att
          : null,
      lastActive: lastActiveMap[pId] ?? null,
    }))
    .sort((a, b) => (b.lastActive || "").localeCompare(a.lastActive || ""));

  return { team: t, players };
}

export async function getTeamStats(coachUserId: string): Promise<TeamStats | null> {
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", coachUserId)
    .eq("role", "coach")
    .maybeSingle();

  if (!membership) return null;

  const teamId = (membership as any).team_id as string;

  const { data: members } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("role", "player");

  const playerIds: string[] = (members ?? []).map((m: any) => m.user_id);

  let totalSessions = 0;
  let totalAttempts = 0;
  let totalMakes = 0;

  if (playerIds.length > 0) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id")
      .in("user_id", playerIds);

    const sessionIds = (sessions ?? []).map((s: any) => s.id);
    totalSessions = sessionIds.length;

    if (sessionIds.length > 0) {
      const { data: spots } = await supabase
        .from("session_spots")
        .select("attempts, makes")
        .in("session_id", sessionIds);

      totalAttempts = (spots ?? []).reduce((a: number, s: any) => a + (s.attempts ?? 0), 0);
      totalMakes = (spots ?? []).reduce((a: number, s: any) => a + (s.makes ?? 0), 0);
    }
  }

  return {
    players: playerIds.length,
    totalSessions,
    totalAttempts,
    teamPct: totalAttempts > 0 ? totalMakes / totalAttempts : null,
  };
}

export async function getCoachTeamId(coachUserId: string): Promise<string | null> {
  const { data: membership, error } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", coachUserId)
    .eq("role", "coach")
    .maybeSingle();

  if (error) throw error;
  return ((membership as any)?.team_id as string | undefined) ?? null;
}

export async function getCoachSharedWorkouts(coachUserId: string): Promise<CoachSharedWorkoutEntry[]> {
  const teamId = await getCoachTeamId(coachUserId);
  if (!teamId) return [];

  const { data: shared, error } = await supabase
    .from("team_workouts")
    .select("id, workout_id, user_id, shared_at, workout_title, workout_status, shot_type, sessions_goal")
    .eq("team_id", teamId)
    .order("shared_at", { ascending: false });

  if (error) throw error;

  const sharedRows = shared ?? [];
  const playerIds: string[] = [...new Set(sharedRows.map((s: any) => s.user_id as string))];
  const profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};

  if (playerIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", playerIds);
    if (profilesError) throw profilesError;
    (profiles ?? []).forEach((p: any) => {
      profileMap[p.id] = {
        name: p.display_name ?? `#${p.id.slice(0, 6)}`,
        avatarUrl: p.avatar_url ?? null,
      };
    });
  }

  return sharedRows.map((s: any) => ({
    shareId: s.id,
    workoutId: s.workout_id,
    title: s.workout_title ?? "Sin título",
    status: s.workout_status ?? "",
    shotType: s.shot_type ?? "",
    sessionsGoal: s.sessions_goal ?? 0,
    sharedAt: s.shared_at,
    playerId: s.user_id,
    playerName: profileMap[s.user_id]?.name ?? `#${s.user_id.slice(0, 6)}`,
    playerAvatarUrl: profileMap[s.user_id]?.avatarUrl ?? null,
  }));
}

export async function deleteCoachAccount(userId: string, teamId: string | null): Promise<void> {
  if (teamId) {
    await deleteTeam(teamId);
  }

  {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
  }

  {
    const { data: deletedProfile, error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!deletedProfile) {
      throw new Error("No se pudo borrar el perfil del entrenador/a.");
    }
  }
}

export async function getSharedTeamWorkouts(teamId: string, userId: string): Promise<TeamWorkoutShare[]> {
  const { data, error } = await supabase
    .from("team_workouts")
    .select("workout_id, workouts(id, title, status)")
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) throw error;

  const rows = (data ?? [])
    .map((r: any) => r.workouts)
    .filter(Boolean) as TeamWorkoutShare[];

  return rows;
}

export async function shareWorkoutWithTeam(params: {
  teamId: string;
  userId: string;
  workout: { id: string; title: string; status: string; shot_type: string; sessions_goal: number };
}): Promise<void> {
  const { teamId, userId, workout } = params;
  const { error } = await supabase.from("team_workouts").upsert({
    team_id: teamId,
    workout_id: workout.id,
    user_id: userId,
    workout_title: workout.title,
    workout_status: workout.status,
    shot_type: workout.shot_type,
    sessions_goal: workout.sessions_goal,
  });

  if (error) throw error;
}

export async function unshareWorkoutWithTeam(params: {
  teamId: string;
  workoutId: string;
  userId: string;
}): Promise<void> {
  const { teamId, workoutId, userId } = params;
  const { error } = await supabase
    .from("team_workouts")
    .delete()
    .eq("team_id", teamId)
    .eq("workout_id", workoutId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function isWorkoutSharedWithTeam(teamId: string, workoutId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("team_workouts")
    .select("id")
    .eq("team_id", teamId)
    .eq("workout_id", workoutId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function getCoachPlayersDetailed(coachUserId: string): Promise<CoachPlayerDetail[]> {
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", coachUserId)
    .eq("role", "coach")
    .maybeSingle();

  if (!membership) return [];
  const teamId = (membership as any).team_id as string;

  const { data: members } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("role", "player");

  const playerIds: string[] = (members ?? []).map((m: any) => m.user_id);
  if (!playerIds.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", playerIds);
  const profileMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
  (profiles ?? []).forEach((p: any) => {
    profileMap[p.id] = {
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
    };
  });

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, user_id, started_at")
    .in("user_id", playerIds)
    .order("started_at", { ascending: false });

  const { data: playerWorkouts } = await supabase
    .from("workouts")
    .select("id, user_id")
    .in("user_id", playerIds);

  const wkIds = (playerWorkouts ?? []).map((w: any) => w.id as string);
  const workoutOwnerMap: Record<string, string> = {};
  (playerWorkouts ?? []).forEach((w: any) => {
    workoutOwnerMap[w.id] = w.user_id;
  });

  let workoutSessions: any[] = [];
  if (wkIds.length > 0) {
    const { data: ws } = await supabase
      .from("sessions")
      .select("id, workout_id, started_at")
      .in("workout_id", wkIds)
      .order("started_at", { ascending: false });
    workoutSessions = ws ?? [];
  }

  const freeRows = (sessions ?? []).map((s: any) => ({ id: s.id, user_id: s.user_id, started_at: s.started_at }));
  const wkRows = workoutSessions.map((s: any) => ({
    id: s.id,
    user_id: workoutOwnerMap[s.workout_id] ?? null,
    started_at: s.started_at,
  }));

  const allRows = [...freeRows];
  const seenIds = new Set(freeRows.map((r) => r.id));
  wkRows.forEach((r) => {
    if (r.user_id && !seenIds.has(r.id)) {
      allRows.push(r);
      seenIds.add(r.id);
    }
  });

  const sessionsByPlayer: Record<string, string[]> = {};
  const lastActiveMap: Record<string, string> = {};
  allRows.forEach((s) => {
    if (!s.user_id) return;
    if (!sessionsByPlayer[s.user_id]) sessionsByPlayer[s.user_id] = [];
    sessionsByPlayer[s.user_id].push(s.id);
    if (!lastActiveMap[s.user_id]) lastActiveMap[s.user_id] = s.started_at;
  });

  const allSessionIds = allRows.map((s) => s.id);
  let spotsData: any[] = [];
  if (allSessionIds.length > 0) {
    const { data: spots } = await supabase
      .from("session_spots")
      .select("session_id, spot_key, shot_type, attempts, makes")
      .in("session_id", allSessionIds);
    spotsData = spots ?? [];
  }

  const sessionPlayerMap: Record<string, string> = {};
  allRows.forEach((s) => {
    if (s.user_id) sessionPlayerMap[s.id] = s.user_id;
  });

  const spotsByPlayer: Record<string, Record<string, { shot_type: string; att: number; mk: number }>> = {};
  spotsData.forEach((sp: any) => {
    const uid = sessionPlayerMap[sp.session_id];
    if (!uid) return;
    if (!spotsByPlayer[uid]) spotsByPlayer[uid] = {};
    if (!spotsByPlayer[uid][sp.spot_key]) {
      spotsByPlayer[uid][sp.spot_key] = { shot_type: sp.shot_type, att: 0, mk: 0 };
    }
    spotsByPlayer[uid][sp.spot_key].att += sp.attempts ?? 0;
    spotsByPlayer[uid][sp.spot_key].mk += sp.makes ?? 0;
  });

  const result: CoachPlayerDetail[] = playerIds.map((uid) => {
    const spots = spotsByPlayer[uid] ?? {};
    const breakdown: SpotBreakdown[] = Object.entries(spots)
      .map(([key, v]) => ({
        spot_key: key,
        shot_type: v.shot_type,
        attempts: v.att,
        makes: v.mk,
        pct: v.att > 0 ? v.mk / v.att : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    const att = breakdown.reduce((a, s) => a + s.attempts, 0);
    const mk = breakdown.reduce((a, s) => a + s.makes, 0);

    return {
      user_id: uid,
      display_name: profileMap[uid]?.display_name ?? null,
      avatar_url: profileMap[uid]?.avatar_url ?? null,
      sessions: (sessionsByPlayer[uid] ?? []).length,
      attempts: att,
      makes: mk,
      pct: att > 0 ? mk / att : null,
      lastActive: lastActiveMap[uid] ?? null,
      spotBreakdown: breakdown,
    };
  });

  result.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  return result;
}
