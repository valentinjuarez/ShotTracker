import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";

import { ALL_SPOTS } from "@/src/data/spots";
import { getCurrentUserId } from "@/src/features/auth/services/auth.service";
import {
    finishSession as finishSessionInDb,
    finishWorkoutIfComplete,
    loadSessionSpots,
    markSessionInProgress,
    updateSessionSpotMakes,
    type SessionSpotRow,
} from "@/src/features/session/services/session.service";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { finishLocalSession, loadLocalSession, updateLocalSpotMakes } from "@/src/utils/localStore";
import { enqueueOp, processQueue } from "@/src/utils/offlineQueue";

export function useRunSessionController() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string; workoutId?: string }>();
  const sessionId = params.sessionId;
  const workoutId = params.workoutId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const { isOnline } = useNetworkStatus();
  const wasOffline = useRef(false);

  const [spotsRows, setSpotsRows] = useState<SessionSpotRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [makesDraft, setMakesDraft] = useState(0);

  const currentRow = spotsRows[idx];

  const spotMeta = useMemo(() => {
    if (!currentRow) return null;
    return ALL_SPOTS.find((spot) => spot.id === currentRow.spot_key) ?? null;
  }, [currentRow]);

  const selectedIdsForCourt = useMemo(
    () => new Set(spotsRows.map((row) => row.spot_key)),
    [spotsRows]
  );

  useEffect(() => {
    if (isOnline === true && wasOffline.current) {
      wasOffline.current = false;
      processQueue()
        .then((processed) => {
          if (processed > 0) setPendingSync(0);
        })
        .catch(() => {});
    }
    if (isOnline === false) {
      wasOffline.current = true;
    }
  }, [isOnline]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sessionId) {
        Alert.alert("Error", "Falta sessionId.");
        router.back();
        return;
      }

      try {
        setLoading(true);

        let rows: SessionSpotRow[] = [];
        try {
          rows = await loadSessionSpots(sessionId);
        } catch {
          rows = [];
        }

        if (!rows.length) {
          const local = await loadLocalSession(sessionId);
          if (local && local.spots.length > 0) {
            rows = local.spots as SessionSpotRow[];
          }
        }

        if (!rows.length) {
          Alert.alert("Sin spots", "Esta sesion no tiene posiciones cargadas.");
          router.back();
          return;
        }

        if (!cancelled) {
          setSpotsRows(rows);
          setIdx(0);
          setMakesDraft(rows[0]?.makes ?? 0);
        }

        if (isOnline !== false) {
          const runUserId = await getCurrentUserId();
          await markSessionInProgress(sessionId, runUserId ?? undefined);
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo cargar la sesion.");
        router.back();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isOnline, router, sessionId]);

  useEffect(() => {
    if (!currentRow) return;
    setMakesDraft(currentRow.makes ?? 0);
  }, [idx, currentRow]);

  const attempts = currentRow?.attempts ?? 10;
  const progressText = currentRow ? `${idx + 1} / ${spotsRows.length}` : "";

  const clampMakes = useCallback(
    (value: number) => {
      if (!currentRow) return 0;
      return Math.max(0, Math.min(attempts, value));
    },
    [attempts, currentRow]
  );

  const finishSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const finishedAt = new Date().toISOString();

      if (isOnline !== false) {
        await processQueue().catch(() => {});
        try {
          await finishSessionInDb(sessionId, finishedAt);
        } catch {}

        if (workoutId) {
          try {
            await finishWorkoutIfComplete(workoutId);
          } catch {}
        }
      } else {
        await finishLocalSession(sessionId).catch(() => {});
        await enqueueOp({ type: "FINISH_SESSION", sessionId, finishedAt });
        if (workoutId) {
          await enqueueOp({ type: "FINISH_WORKOUT", workoutId });
        }
        setPendingSync((current) => current + 1);
      }

      router.replace({
        pathname: "/session/summary",
        params: { sessionId, ...(workoutId ? { workoutId } : {}) },
      });
    } catch (e: any) {
      Alert.alert(
        "Sesion guardada, pero...",
        e?.message ?? "No se pudo finalizar la sesion. Proba de nuevo."
      );
    }
  }, [isOnline, router, sessionId, workoutId]);

  const saveCurrentAndNext = useCallback(async () => {
    if (!currentRow || !sessionId || saving) return;

    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const safeMakes = clampMakes(makesDraft);

      if (isOnline !== false) {
        await updateSessionSpotMakes(currentRow.id, safeMakes);
      } else {
        await enqueueOp({ type: "UPDATE_SPOT", spotId: currentRow.id, makes: safeMakes });
        await updateLocalSpotMakes(sessionId, currentRow.id, safeMakes).catch(() => {});
        setPendingSync((current) => current + 1);
      }

      setSpotsRows((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], makes: safeMakes };
        return next;
      });

      const isLast = idx >= spotsRows.length - 1;
      if (isLast) {
        await finishSession();
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIdx((current) => current + 1);
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e?.message ?? "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [clampMakes, currentRow, finishSession, idx, isOnline, makesDraft, saving, sessionId, spotsRows.length]);

  const confirmExit = useCallback(() => {
    Alert.alert("Salir de la sesion", "Podes salir y volver despues. Queres salir ahora?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: () => router.back(),
      },
    ]);
  }, [router]);

  const pct = attempts > 0 ? Math.round((clampMakes(makesDraft) / attempts) * 100) : 0;

  return {
    attempts,
    clampMakes,
    confirmExit,
    currentRow,
    finishSession,
    idx,
    isOnline,
    loading,
    makesDraft,
    pendingSync,
    pct,
    progressText,
    saveCurrentAndNext,
    saving,
    selectedIdsForCourt,
    sessionId,
    setMakesDraft,
    spotMeta,
    spotsRows,
    workoutId,
  };
}
