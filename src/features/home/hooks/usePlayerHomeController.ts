import { useCallback, useMemo, useState } from "react";

import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import {
  getCurrentUserId,
  getCurrentUserMetadata,
  signOut,
} from "@/src/features/auth/services/auth.service";
import { getCurrentUserProfile } from "@/src/features/profile/services/profile.service";
import {
  getSessionAttemptsBySession,
  getSessionHistory,
  type SessionRow,
} from "@/src/features/session/services/session.service";
import {
  createNextWorkoutSession,
  getLatestWorkoutProgress,
} from "@/src/features/workout/services/workout.service";
import { useAutoRefreshOnFocus } from "@/src/hooks/useAutoRefreshOnFocus";

export type SpotAgg = { attempts: number; makes: number };

export type WorkoutProgress = {
  id: string;
  title: string;
  status: string;
  sessionsGoal: number;
  completedSessions: number;
  currentSessionId: string | null;
};

export function usePlayerHomeController() {
  const router = useRouter();

  const [name, setName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [weeklyAttempts, setWeeklyAttempts] = useState<number | null>(null);
  const [weeklyPct, setWeeklyPct] = useState<number | null>(null);
  const [lastSession, setLastSession] = useState<SessionRow | null>(null);
  const [lastSpots, setLastSpots] = useState<SpotAgg>({ attempts: 0, makes: 0 });
  const [inProgressWorkout, setInProgressWorkout] = useState<WorkoutProgress | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  const initials = useMemo(() => {
    const n = (name || "").trim();
    if (!n) return "";
    const parts = n.split(" ").filter(Boolean);
    const a = parts[0]?.[0]?.toUpperCase() ?? "";
    const b = parts[1]?.[0]?.toUpperCase() ?? "";
    return (a + b) || a || "";
  }, [name]);

  const loadData = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      const meta = await getCurrentUserMetadata();
      const displayName =
        (meta.display_name as string | undefined) ??
        (meta.username as string | undefined) ??
        "";
      setName(displayName);

      const profile = await getCurrentUserProfile();
      setAvatarUrl(profile?.avatar_url ?? null);

      if (!userId) {
        setLoadingStats(false);
        return;
      }

      setLoadingStats(true);

      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + diffToMonday);
      weekStart.setHours(0, 0, 0, 0);
      const since = weekStart.toISOString();

      const sessions = await getSessionHistory(userId);
      const sessionIds = sessions.map((s) => s.id);
      const bySession = await getSessionAttemptsBySession(sessionIds);

      const weekRows = sessions.filter((s) => !!s.started_at && s.started_at >= since);
      const weekTotals = weekRows.reduce(
        (acc, s) => {
          const curr = bySession[s.id] ?? { attempts: 0, makes: 0 };
          acc.attempts += curr.attempts;
          acc.makes += curr.makes;
          return acc;
        },
        { attempts: 0, makes: 0 }
      );

      setWeeklyAttempts(weekTotals.attempts);
      setWeeklyPct(weekTotals.attempts > 0 ? weekTotals.makes / weekTotals.attempts : null);

      const last = sessions[0] ?? null;
      setLastSession(last);
      if (last) {
        const totals = bySession[last.id] ?? { attempts: 0, makes: 0 };
        setLastSpots(totals);
      } else {
        setLastSpots({ attempts: 0, makes: 0 });
      }

      const workoutProgress = await getLatestWorkoutProgress(userId);
      setInProgressWorkout(workoutProgress);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useAutoRefreshOnFocus(loadData, { intervalMs: 30000 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const onContinueWorkout = useCallback(async () => {
    if (!inProgressWorkout || startingSession) return;

    if (
      !inProgressWorkout.currentSessionId &&
      inProgressWorkout.completedSessions >= inProgressWorkout.sessionsGoal
    ) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (inProgressWorkout.currentSessionId) {
      router.push({
        pathname: "/(tabs)/session/run",
        params: {
          sessionId: inProgressWorkout.currentSessionId,
          workoutId: inProgressWorkout.id,
        },
      });
      return;
    }

    try {
      setStartingSession(true);
      const newSessionId = await createNextWorkoutSession(inProgressWorkout.id);
      router.push({
        pathname: "/(tabs)/session/run",
        params: { sessionId: newSessionId, workoutId: inProgressWorkout.id },
      });
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(e?.message ?? "No se pudo iniciar la sesión.");
    } finally {
      setStartingSession(false);
    }
  }, [inProgressWorkout, router, startingSession]);

  const onLogout = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
  }, []);

  const lastPct = lastSpots.attempts > 0 ? lastSpots.makes / lastSpots.attempts : null;
  const lastPctStr = lastPct !== null ? `${Math.round(lastPct * 100)}%` : "";
  const lastLabel =
    lastSession?.title ??
    (lastSession?.started_at ? new Date(lastSession.started_at).toLocaleDateString() : "Última sesión");
  const lastDate = lastSession?.started_at
    ? new Date(lastSession.started_at).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return {
    initials,
    avatarUrl,
    inProgressWorkout,
    lastDate,
    lastLabel,
    lastPct,
    lastPctStr,
    lastSession,
    lastSpots,
    loadingStats,
    name,
    onContinueWorkout,
    onLogout,
    onRefresh,
    refreshing,
    startingSession,
    weeklyAttempts,
    weeklyPct,
  };
}
