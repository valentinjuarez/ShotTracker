import { useCallback, useEffect, useMemo, useState } from "react";

import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";

import { ALL_SPOTS } from "@/src/data/spots";
import { getCurrentUserId } from "@/src/features/auth/services/auth.service";
import {
    getSessionNumber,
    loadSessionSpots,
    type SessionSpotRow,
} from "@/src/features/session/services/session.service";
import { getUserTeam, isWorkoutSharedWithTeam, shareWorkoutWithTeam } from "@/src/features/team/services/team.service";
import {
    getWorkoutMetadata,
    getWorkoutSessions,
    type WorkoutData,
} from "@/src/features/workout/services/workout.service";

export function useSessionSummaryController() {
  const router = useRouter();
  const { sessionId, workoutId } = useLocalSearchParams<{ sessionId?: string; workoutId?: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<SessionSpotRow[]>([]);
  const [mode, setMode] = useState<"HEAT" | "LIST">("HEAT");
  const [selectedSpotKey, setSelectedSpotKey] = useState<string | null>(null);
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [nextSummarySession, setNextSummarySession] = useState<{ id: string; sessionNumber: number } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const loadData = useCallback(
    async (opts?: { isRefresh?: boolean }) => {
      if (!sessionId) {
        Alert.alert("Error", "Falta sessionId.");
        router.back();
        return;
      }

      try {
        if (!opts?.isRefresh) setLoading(true);

        const result = await loadSessionSpots(sessionId);
        if (!result.length) {
          Alert.alert("Sin datos", "No hay tiros registrados.");
          router.back();
          return;
        }

        setRows(result);
        setSelectedSpotKey((prev) => prev ?? result[0]?.spot_key ?? null);
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo cargar el resumen.");
        router.back();
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, sessionId]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData({ isRefresh: true });
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!workoutId) {
      setWorkout(null);
      setCompletedSessions(0);
      setNextSummarySession(null);
      return;
    }

    (async () => {
      const [workoutData, sessionNumber, workoutSessions] = await Promise.all([
        getWorkoutMetadata(workoutId),
        sessionId ? getSessionNumber(sessionId) : Promise.resolve(0),
        getWorkoutSessions(workoutId),
      ]);

      if (workoutData) setWorkout(workoutData);
      setCompletedSessions(sessionNumber);

      const nextDone = workoutSessions.find(
        (session) => session.session_number > sessionNumber && session.status === "DONE",
      );
      setNextSummarySession(
        nextDone ? { id: nextDone.id, sessionNumber: nextDone.session_number } : null,
      );
    })();
  }, [sessionId, workoutId]);

  const goToNextSummary = useCallback(async () => {
    if (!workoutId || !nextSummarySession) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: "/session/summary",
      params: { sessionId: nextSummarySession.id, workoutId },
    });
  }, [nextSummarySession, router, workoutId]);

  const handleShareTeam = useCallback(async () => {
    if (!workout) return;

    try {
      setShareLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const userId = await getCurrentUserId();
      if (!userId) return;

      const teamData = await getUserTeam(userId);
      if (!teamData) {
        Alert.alert("Sin equipo", "No estas unido a ningun equipo todavia.");
        return;
      }

      const teamId = teamData.team.id;
      const alreadyShared = await isWorkoutSharedWithTeam(teamId, workout.id);
      if (alreadyShared) {
        Alert.alert("Ya compartida", "Esta planilla ya fue compartida con tu equipo.");
        return;
      }

      await shareWorkoutWithTeam({
        teamId,
        userId,
        workout: {
          id: workout.id,
          title: workout.title,
          status: "COMPLETED",
          shot_type: workout.shot_type,
          sessions_goal: workout.sessions_goal,
        },
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Compartida", "Tu planilla fue compartida con el equipo.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo compartir con el equipo.");
    } finally {
      setShareLoading(false);
    }
  }, [workout]);

  const stats = useMemo(() => {
    const totalAttempts = rows.reduce((acc, row) => acc + (row.attempts ?? 0), 0);
    const totalMakes = rows.reduce((acc, row) => acc + (row.makes ?? 0), 0);
    const pct = totalAttempts > 0 ? totalMakes / totalAttempts : 0;

    const perSpot = rows.map((row) => ({
      ...row,
      pct: row.attempts > 0 ? row.makes / row.attempts : 0,
    }));

    const sorted = [...perSpot].sort((a, b) => b.pct - a.pct);
    const mean = perSpot.reduce((acc, row) => acc + row.pct, 0) / Math.max(1, perSpot.length);
    const std = Math.sqrt(
      perSpot.reduce((acc, row) => acc + Math.pow(row.pct - mean, 2), 0) /
        Math.max(1, perSpot.length)
    );

    return {
      best: sorted[0],
      mean,
      perSpot,
      pct,
      std,
      totalAttempts,
      totalMakes,
      worst: sorted[sorted.length - 1],
    };
  }, [rows]);

  const spotMetaByKey = useMemo(() => {
    const map = new Map<string, (typeof ALL_SPOTS)[number]>();
    ALL_SPOTS.forEach((spot) => map.set(spot.id, spot));
    return map;
  }, []);

  const selectedRow = useMemo(
    () => stats.perSpot.find((row) => row.spot_key === selectedSpotKey) ?? null,
    [selectedSpotKey, stats.perSpot]
  );

  const selectedMeta = selectedSpotKey ? spotMetaByKey.get(selectedSpotKey) : null;

  return {
    completedSessions,
    goToNextSummary,
    handleShareTeam,
    loadData,
    loading,
    mode,
    nextSummarySession,
    onRefresh,
    pdfLoading,
    refreshing,
    rows,
    selectedMeta,
    selectedRow,
    selectedSpotKey,
    sessionId,
    setMode,
    setPdfLoading,
    setSelectedSpotKey,
    shareLoading,
    spotMetaByKey,
    stats,
    workout,
    workoutId,
  };
}
