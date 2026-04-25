import { useCallback, useMemo, useState } from "react";

import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { ALL_SPOTS, DOBLE_SPOTS, TRIPLE_SPOTS } from "@/src/data/spots";
import { getCurrentUserId } from "@/src/features/auth/services/auth.service";
import {
    createSessionWithSpots,
} from "@/src/features/session/services/session.service";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { generateUUID, saveLocalSession } from "@/src/utils/localStore";
import { enqueueOp } from "@/src/utils/offlineQueue";

export type SelectionMode = "FREE" | "3PT" | "2PT" | "ALL";

export function useCreateSessionController() {
  const router = useRouter();
  const { isOnline } = useNetworkStatus();

  const [mode, setMode] = useState<SelectionMode>("FREE");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultTarget, setDefaultTarget] = useState(10);
  const [spotTargetsById, setSpotTargetsById] = useState<Record<string, number>>({});
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [currentSpotIndex, setCurrentSpotIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const selectedCount = selected.size;
  const currentSpot = ALL_SPOTS[currentSpotIndex];
  const canContinue = selectedCount > 0 && !saving;

  const selectedSpots = useMemo(
    () => ALL_SPOTS.filter((spot) => selected.has(spot.id)),
    [selected]
  );

  const targetForSpot = useCallback(
    (spotId: string) => {
      const candidate = spotTargetsById[spotId];
      if (Number.isFinite(candidate)) {
        return Math.max(1, Math.min(100, Number(candidate)));
      }
      return defaultTarget;
    },
    [defaultTarget, spotTargetsById]
  );

  const totalTargetAttempts = useMemo(
    () => selectedSpots.reduce((acc, spot) => acc + targetForSpot(spot.id), 0),
    [selectedSpots, targetForSpot]
  );

  const changeSpotTarget = useCallback(
    (spotId: string, delta: number) => {
      const current = targetForSpot(spotId);
      const next = Math.max(1, Math.min(100, current + delta));
      setSpotTargetsById((prev) => ({ ...prev, [spotId]: next }));
    },
    [targetForSpot]
  );

  const setSpotTargetFromInput = useCallback((spotId: string, text: string) => {
    const digits = text.replace(/\D/g, "");
    if (!digits) {
      setSpotTargetsById((prev) => ({ ...prev, [spotId]: 1 }));
      return;
    }
    const parsed = Number(digits);
    const safe = Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : 1;
    setSpotTargetsById((prev) => ({ ...prev, [spotId]: safe }));
  }, []);

  const applyMode = useCallback((nextMode: SelectionMode) => {
    setMode(nextMode);
    setSpotTargetsById({});
    switch (nextMode) {
      case "3PT":
        setSelected(new Set(TRIPLE_SPOTS.map((spot) => spot.id)));
        break;
      case "2PT":
        setSelected(new Set(DOBLE_SPOTS.map((spot) => spot.id)));
        break;
      case "ALL":
        setSelected(new Set(ALL_SPOTS.map((spot) => spot.id)));
        break;
      case "FREE":
        setSelected(new Set());
        break;
    }
  }, []);

  const toggleSpot = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setSpotTargetsById((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (mode !== "FREE") setMode("FREE");
    },
    [mode]
  );

  const reset = useCallback(() => {
    setMode("FREE");
    setSelected(new Set());
    setDefaultTarget(10);
    setSpotTargetsById({});
    setShowCourtModal(false);
    setCurrentSpotIndex(0);
    setSaving(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => reset();
    }, [reset])
  );

  const createSessionAndGo = useCallback(async () => {
    if (saving) return;
    if (selectedCount === 0) {
      Alert.alert("Falta info", "Elegi al menos una posicion.");
      return;
    }

    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert("Error", "No hay usuario logueado.");
        return;
      }

      const modeLabel =
        mode === "3PT"
          ? "Triples"
          : mode === "2PT"
            ? "Dobles"
            : mode === "ALL"
              ? "Completo"
              : "Libre";
      const title = `Sesion ${modeLabel}  ${new Date().toLocaleDateString()}`;

      if (isOnline === false) {
        const sessionId = generateUUID();
        const now = new Date().toISOString();
        const sessionRow = {
          id: sessionId,
          user_id: userId,
          kind: "FREE",
          title,
          default_target_attempts: defaultTarget,
          status: "IN_PROGRESS",
          started_at: now,
          workout_id: null,
        };

        const spotRows = selectedSpots.map((spot, index) => ({
          id: generateUUID(),
          session_id: sessionId,
          user_id: userId,
          spot_key: spot.id,
          shot_type: spot.shotType as "2PT" | "3PT",
          target_attempts: targetForSpot(spot.id),
          attempts: targetForSpot(spot.id),
          makes: 0,
          order_index: index,
        }));

        await saveLocalSession(sessionRow, spotRows);
        await enqueueOp({ type: "CREATE_SESSION", session: sessionRow, spots: spotRows });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setShowCourtModal(false);
        router.push({ pathname: "/session/run", params: { sessionId } });
        return;
      }

      const { sessionId } = await createSessionWithSpots({
        userId,
        title,
        defaultTarget,
        selectedSpots,
        spotTargetsById,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCourtModal(false);
      router.push({ pathname: "/session/run", params: { sessionId } });
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e?.message ?? "Algo salio mal creando la sesion.");
    } finally {
      setSaving(false);
    }
  }, [defaultTarget, isOnline, mode, router, saving, selectedCount, selectedSpots, spotTargetsById, targetForSpot]);

  return {
    applyMode,
    canContinue,
    createSessionAndGo,
    currentSpot,
    currentSpotIndex,
    changeSpotTarget,
    defaultTarget,
    mode,
    saving,
    selected,
    selectedCount,
    selectedSpots,
    setSpotTargetFromInput,
    setCurrentSpotIndex,
    setDefaultTarget,
    setShowCourtModal,
    showCourtModal,
    targetForSpot,
    totalTargetAttempts,
    toggleSpot,
  };
}
