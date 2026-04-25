// app/workout/create.tsx
import { ALL_SPOTS, DOBLE_SPOTS, TRIPLE_SPOTS } from "@/src/data/spots";
import { getCurrentUserId } from "@/src/features/auth/services/auth.service";
import { Court } from "@/src/features/session/components/Court";
import {
  createWorkoutSession,
  getWorkoutTemplateForEdit,
  updateWorkoutTemplate,
} from "@/src/features/workout/services/workout.service";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { HelpHint } from "@/src/shared/components/ui/HelpHint";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

type PlanTipo = "3PT" | "2PT" | "CUSTOM";

// ─── Animated entrance hook ───────────────────────────────────────────────────
function useFadeSlide(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, delay,
      useNativeDriver: true,
      damping: 14, stiffness: 100,
    }).start();
  }, [anim, delay]);
  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };
}

// ─── Animated counter bump ────────────────────────────────────────────────────
function useCounterAnim() {
  const scale = useRef(new Animated.Value(1)).current;
  function bump() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.30, useNativeDriver: true, speed: 80, bounciness: 8 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }),
    ]).start();
  }
  return { scale, bump };
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CreateWorkout() {
  const { width } = useWindowDimensions();
  const isSmall   = width < 360;
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const editWorkoutId = Array.isArray(workoutId) ? workoutId[0] : workoutId;
  const isEditing = !!editWorkoutId;

  const courtW = Math.min(width - (isSmall ? 32 : 40), 420);
  const courtH = Math.round(courtW * 1.08);

  const [name, setName]               = useState("Planilla de tiro");
  const [tipo, setTipo]               = useState<PlanTipo>("3PT");
  const [sessionsGoal, setSessionsGoal] = useState(14);
  const [defaultTarget, setDefaultTarget] = useState(10);
  const [spotTargetsById, setSpotTargetsById] = useState<Record<string, number>>({});
  const [nameFocused, setNameFocused] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [loadingWorkout, setLoadingWorkout] = useState(isEditing);
  const { isOnline } = useNetworkStatus();

  const router    = useRouter();
  const btnScale   = useRef(new Animated.Value(1)).current;
  const sessAnim   = useCounterAnim();
  const tgtAnim    = useCounterAnim();

  const spots = useMemo(() => {
    if (tipo === "3PT") return TRIPLE_SPOTS;
    if (tipo === "2PT") return DOBLE_SPOTS;
    return ALL_SPOTS;
  }, [tipo]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(TRIPLE_SPOTS.map((s) => s.id))
  );
  const allowedSpotIds = useMemo(() => new Set(spots.map((s) => s.id)), [spots]);
  const selectedInScope = useMemo(
    () => new Set([...selected].filter((id) => allowedSpotIds.has(id))),
    [selected, allowedSpotIds]
  );
  const selectedSpotsInScope = useMemo(
    () => spots.filter((s) => selectedInScope.has(s.id)),
    [spots, selectedInScope],
  );

  useEffect(() => {
    if (!isEditing || !editWorkoutId) {
      setLoadingWorkout(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingWorkout(true);
        const workout = await getWorkoutTemplateForEdit(editWorkoutId);
        if (!workout) throw new Error("No se pudo cargar la planilla.");
        if (cancelled) return;

        setName(workout.title ?? "Planilla de tiro");
        setTipo((workout.shot_type as PlanTipo) ?? "3PT");
        setSessionsGoal(workout.sessions_goal ?? 1);
        setDefaultTarget(workout.target_per_spot ?? 1);
        setSpotTargetsById((workout.targets_by_spot ?? {}) as Record<string, number>);
        setSelected(new Set(workout.spot_keys ?? []));
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo cargar la planilla.");
        router.back();
      } finally {
        if (!cancelled) setLoadingWorkout(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editWorkoutId, isEditing, router]);

  function targetForSpot(spotId: string) {
    return Math.max(1, spotTargetsById[spotId] ?? defaultTarget);
  }

  const syncSelection = (newTipo: PlanTipo) => {
    if (newTipo === "CUSTOM") {
      setSelected((prev) => new Set(prev));
      return;
    }
    const newSpots = newTipo === "3PT" ? TRIPLE_SPOTS : DOBLE_SPOTS;
    setSelected(new Set(newSpots.map((s) => s.id)));
  };

  function toggleSpot(id: string) {
    if (!allowedSpotIds.has(id)) return;
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setSpotTargetsById((curr) => (curr[id] ? curr : { ...curr, [id]: defaultTarget }));
      }
      return next;
    });
  }

  const selectedCount = selectedInScope.size;
  const totalSpots    = spots.length;

  const canCreate =
    name.trim().length > 0 &&
    selectedCount > 0 &&
    sessionsGoal > 0 &&
    defaultTarget > 0 &&
    !loadingWorkout &&
    !saving;

  function setAll(on: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (on) {
      setSelected((prev) => {
        const next = new Set(prev);
        spots.forEach((s) => next.add(s.id));
        return next;
      });
      setSpotTargetsById((prev) => {
        const next = { ...prev };
        spots.forEach((s) => {
          if (!next[s.id]) next[s.id] = defaultTarget;
        });
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        spots.forEach((s) => next.delete(s.id));
        return next;
      });
    }
  }

  function changeSpotTarget(spotId: string, delta: number) {
    Haptics.selectionAsync();
    setSpotTargetsById((prev) => {
      const current = Math.max(1, prev[spotId] ?? defaultTarget);
      return { ...prev, [spotId]: Math.max(1, current + delta) };
    });
  }

  function setSpotTargetFromInput(spotId: string, text: string) {
    const digits = text.replace(/\D/g, "");
    if (!digits) {
      setSpotTargetsById((prev) => ({ ...prev, [spotId]: 1 }));
      return;
    }
    const parsed = Number(digits);
    const safe = Number.isFinite(parsed) ? Math.max(1, Math.min(999, parsed)) : 1;
    setSpotTargetsById((prev) => ({ ...prev, [spotId]: safe }));
  }

  function pressBtn(v: number) {
    Animated.spring(btnScale, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 2 }).start();
  }

  async function onCreateWorkout() {
    if (!canCreate) return;
    if (isOnline === false) {
      Alert.alert(
        "Sin conexión",
        isEditing
          ? "Necesitás conexión para guardar los cambios de la planilla."
          : "Las planillas se sincronizan con el servidor al crearlas. Conectá internet e intentá de nuevo.",
      );
      return;
    }
    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const userId = await getCurrentUserId();
      if (!userId) throw new Error("No autenticado");

      const orderedSpotKeys = spots
        .filter((s) => selectedInScope.has(s.id))
        .map((s) => s.id);

      const customTargets =
        tipo === "CUSTOM"
          ? Object.fromEntries(selectedSpotsInScope.map((s) => [s.id, targetForSpot(s.id)]))
          : undefined;

      const shotTypeForCreate: "3PT" | "2PT" | "CUSTOM" =
        tipo === "CUSTOM" ? "CUSTOM" : tipo;

      if (isEditing) {
        if (!editWorkoutId) throw new Error("Falta workoutId.");

        await updateWorkoutTemplate({
          workoutId: editWorkoutId,
          title: name.trim(),
          shotType: shotTypeForCreate,
          sessionsGoal,
          targetPerSpot: defaultTarget,
          spotKeys: orderedSpotKeys,
          targetsBySpotKey: customTargets,
        });

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)/workout");
        return;
      }

      const { workoutId, sessionId } = await createWorkoutSession({
        title: name.trim(),
        shotType: shotTypeForCreate,
        sessionsGoal,
        targetPerSpot: defaultTarget,
        spotKeys: orderedSpotKeys,
        targetsBySpotKey: customTargets,
      });

      if (!workoutId || !sessionId) throw new Error("No se pudo crear la planilla.");

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 4. Go directly to the run screen
      router.push({
        pathname: "/(tabs)/session/run",
        params: { sessionId, workoutId },
      });
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e?.message ?? (isEditing ? "No se pudo guardar la planilla." : "No se pudo crear la planilla."));
    } finally {
      setSaving(false);
    }
  }

  const reset = useCallback(() => {
    setName("Planilla de tiro");
    setTipo("3PT");
    setSessionsGoal(14);
    setDefaultTarget(10);
    setSpotTargetsById({});
    setSelected(new Set(TRIPLE_SPOTS.map((s) => s.id)));
    setSaving(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => reset();
    }, [reset])
  );

  // Staggered entrance animations
  const a0 = useFadeSlide(0);
  const a1 = useFadeSlide(70);
  const a2 = useFadeSlide(140);
  const a3 = useFadeSlide(200);
  const a4 = useFadeSlide(260);
  const a5 = useFadeSlide(320);

  if (isEditing && loadingWorkout) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#F59E0B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* Ambient glow */}
      <View style={{
        position: "absolute", top: -50, right: -50,
        width: 220, height: 220, borderRadius: 110,
        backgroundColor: "rgba(245,158,11,0.05)",
      }} pointerEvents="none" />
      <View style={{
        position: "absolute", bottom: 100, left: -60,
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: "rgba(99,179,237,0.04)",
      }} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: isSmall ? 16 : 20,
          paddingTop: 14,
          paddingBottom: 36,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[{ gap: 4 }, a0]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, fontWeight: "600", letterSpacing: 0.3 }}>
              {isEditing ? "Editar planilla" : "Nueva planilla"}
            </Text>
            <HelpHint
              storageKey="@onboarding_workout_create_header"
              title={isEditing ? "Editar planilla" : "¿Qué es una planilla?"}
              message={isEditing
                ? "Editá spots, intentos y objetivo. Los cambios se aplicarán a las próximas sesiones."
                : "Es un plan con varias sesiones. Definís tipo de tiro, spots, intentos y objetivo para seguir avances en el tiempo."}
            />
          </View>
          <Text style={{ color: "white", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>
            {isEditing ? "Editar planilla" : "Crear planilla 🏀"}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, lineHeight: 18, marginTop: 2 }}>
            {isEditing
              ? "Ajustá las posiciones y los intentos para la próxima sesión."
              : "Configurá un ciclo de entrenamiento y elegí tus posiciones en la cancha."}
          </Text>
        </Animated.View>

        {/* Nombre */}
        <Animated.View style={a1}>
          <SectionCard>
            <SectionHeader icon="create-outline" title="Nombre de la planilla" />
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              marginTop: 10,
              borderWidth: 1.5,
              borderColor: nameFocused ? "rgba(245,158,11,0.70)" : "rgba(255,255,255,0.10)",
              borderRadius: 14,
              backgroundColor: nameFocused ? "rgba(245,158,11,0.05)" : "rgba(0,0,0,0.20)",
              paddingHorizontal: 14,
              paddingVertical: Platform.OS === "ios" ? 13 : 10,
            }}>
              <Ionicons
                name="clipboard-outline"
                size={17}
                color={nameFocused ? "#F59E0B" : "rgba(255,255,255,0.30)"}
              />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ej: Triples pretemporada"
                placeholderTextColor="rgba(255,255,255,0.22)"
                style={{ flex: 1, color: "white", fontSize: 15, paddingVertical: 0, fontWeight: "700" }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              {name.length > 0 && (
                <Pressable onPress={() => setName("")} hitSlop={10}>
                  <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.22)" />
                </Pressable>
              )}
            </View>
          </SectionCard>
        </Animated.View>

        {/* Tipo */}
        <Animated.View style={a2}>
          <SectionCard>
            <SectionHeader icon="basketball-outline" title="Tipo de tiros" />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              {([
                { value: "3PT" as PlanTipo, label: "Triples", icon: "basketball",         sub: "15 posiciones" },
                { value: "2PT" as PlanTipo, label: "Dobles",  icon: "basketball-outline", sub: "Incluye TL"    },
                { value: "CUSTOM" as PlanTipo, label: "Personalizada", icon: "options-outline", sub: "Elegí tus spots" },
              ] as const).map((opt) => {
                const on = tipo === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTipo(opt.value);
                      syncSelection(opt.value);
                    }}
                    style={{
                      flex: 1, paddingVertical: 14, paddingHorizontal: 12,
                      borderRadius: 16, alignItems: "center", gap: 6,
                      backgroundColor: on ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
                      borderWidth: 2,
                      borderColor: on ? "rgba(245,158,11,0.50)" : "rgba(255,255,255,0.09)",
                    }}
                  >
                    <View style={{
                      width: 42, height: 42, borderRadius: 13,
                      backgroundColor: on ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.06)",
                      borderWidth: 1,
                      borderColor: on ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.09)",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Ionicons name={opt.icon} size={21} color={on ? "#F59E0B" : "rgba(255,255,255,0.38)"} />
                    </View>
                    <Text style={{
                      color: on ? "#F59E0B" : "rgba(255,255,255,0.55)",
                      fontWeight: "900", fontSize: 13,
                    }}>
                      {opt.label}
                    </Text>
                    <Text style={{
                      color: on ? "rgba(245,158,11,0.60)" : "rgba(255,255,255,0.22)",
                      fontSize: 11,
                    }}>
                      {opt.sub}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        </Animated.View>

        {/* Counters */}
        <Animated.View style={[{ flexDirection: "row", gap: 12 }, a3]}>
          <CounterCard
            title="Sesiones objetivo"
            icon="calendar-outline"
            accentColor="rgba(99,179,237,1)"
            value={sessionsGoal}
            counterAnim={sessAnim}
            onDec={() => { if (sessionsGoal <= 1) return; Haptics.selectionAsync(); sessAnim.bump(); setSessionsGoal((v) => Math.max(1, v - 1)); }}
            onInc={() => { Haptics.selectionAsync(); sessAnim.bump(); setSessionsGoal((v) => v + 1); }}
          />
          <CounterCard
            title="Intentos / posición"
            icon="repeat-outline"
            accentColor="rgba(245,158,11,1)"
            value={defaultTarget}
            counterAnim={tgtAnim}
            onDec={() => { if (defaultTarget <= 1) return; Haptics.selectionAsync(); tgtAnim.bump(); setDefaultTarget((v) => Math.max(1, v - 1)); }}
            onInc={() => { Haptics.selectionAsync(); tgtAnim.bump(); setDefaultTarget((v) => v + 1); }}
          />
        </Animated.View>

        {/* Court / Spots */}
        <Animated.View style={a4}>
          <SectionCard>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <SectionHeader icon="map-outline" title="Posiciones" />
                <HelpHint
                  storageKey="@onboarding_workout_create_spots"
                  title="Selección de posiciones"
                  message="Tocá los spots en la cancha para incluirlos. Cuantas más posiciones selecciones, más variado será tu entrenamiento."
                  align="left"
                />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <MiniChip label="Todas"   onPress={() => setAll(true)}  />
                <MiniChip label="Ninguna" onPress={() => setAll(false)} dim />
              </View>
            </View>

            {/* Progress bar */}
            <View style={{ marginTop: 10, gap: 5 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11 }}>Seleccionadas</Text>
                <Text style={{
                  fontWeight: "900", fontSize: 11,
                  color: selectedCount === totalSpots ? "rgba(34,197,94,1)" :
                         selectedCount > 0 ? "#F59E0B" : "rgba(239,68,68,0.80)",
                }}>
                  {selectedCount} / {totalSpots}
                </Text>
              </View>
              <View style={{ height: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <View style={{
                  height: 4, borderRadius: 99,
                  width: `${(selectedCount / totalSpots) * 100}%`,
                  backgroundColor:
                    selectedCount === totalSpots ? "rgba(34,197,94,1)" :
                    selectedCount > 0 ? "#F59E0B" : "rgba(239,68,68,0.60)",
                }} />
              </View>
            </View>

            <View style={{ marginTop: 14, alignItems: "center" }}>
              <Court
                width={courtW}
                height={courtH}
                spots={ALL_SPOTS}
                selectedIds={selectedInScope}
                onToggleSpot={toggleSpot}
                snapToNearest
                hitRadius={46}
              />
            </View>
          </SectionCard>
        </Animated.View>

        {tipo === "CUSTOM" && selectedSpotsInScope.length > 0 && (
          <Animated.View style={a5}>
            <SectionCard>
              <SectionHeader icon="options-outline" title="Intentos por spot" />
              <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 12, marginTop: 8, marginBottom: 10 }}>
                Ajustá cada posición individualmente. Ej: TL con más volumen.
              </Text>
              <View style={{ gap: 8 }}>
                {selectedSpotsInScope.map((spot) => {
                  const target = targetForSpot(spot.id);
                  const typeLabel = spot.shotType === "3PT" ? "Triple" : "Doble";
                  return (
                    <View
                      key={spot.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 9,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        backgroundColor: "rgba(255,255,255,0.05)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.09)",
                      }}
                    >
                      <View>
                        <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>
                          {typeLabel} {spot.label}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 11 }}>
                          {spot.id}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <MiniCounterBtn label="−" onPress={() => changeSpotTarget(spot.id, -1)} />
                        <TextInput
                          value={String(target)}
                          onChangeText={(t) => setSpotTargetFromInput(spot.id, t)}
                          keyboardType="number-pad"
                          maxLength={3}
                          style={{
                            minWidth: 54,
                            height: 34,
                            borderRadius: 10,
                            backgroundColor: "rgba(255,255,255,0.08)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.14)",
                            color: "white",
                            fontWeight: "900",
                            fontSize: 15,
                            textAlign: "center",
                            paddingVertical: 0,
                            paddingHorizontal: 8,
                          }}
                        />
                        <MiniCounterBtn label="+" onPress={() => changeSpotTarget(spot.id, +1)} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </SectionCard>
          </Animated.View>
        )}

        {/* Summary chips */}
        <Animated.View style={[{
          padding: 14, borderRadius: 16, gap: 10,
          backgroundColor: "rgba(255,255,255,0.03)",
          borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
        }, a5]}>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }}>
            Resumen
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { icon: "clipboard-outline",  label: name.trim() || "Sin nombre", accent: name.trim().length > 0 },
              { icon: "basketball-outline", label: tipo === "3PT" ? "Triples" : tipo === "2PT" ? "Dobles" : "Personalizada", accent: true },
              { icon: "map-outline",        label: `${selectedCount} posiciones`, accent: selectedCount > 0 },
              { icon: "calendar-outline",   label: `${sessionsGoal} sesiones`, accent: true },
              { icon: "repeat-outline",     label: tipo === "CUSTOM" ? "Intentos personalizados" : `${defaultTarget} intentos`, accent: true },
            ].map((item) => (
              <View key={item.label} style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                paddingVertical: 5, paddingHorizontal: 10, borderRadius: 99,
                backgroundColor: item.accent ? "rgba(245,158,11,0.09)" : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: item.accent ? "rgba(245,158,11,0.20)" : "rgba(255,255,255,0.08)",
              }}>
                <Ionicons name={item.icon as any} size={12} color={item.accent ? "#F59E0B" : "rgba(255,255,255,0.35)"} />
                <Text style={{ color: item.accent ? "#F59E0B" : "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700" }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Create button */}
        <Animated.View style={[a5, { transform: [...(a5.transform as any[]), { scale: btnScale }] }]}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 }}>
            <HelpHint
              storageKey="@onboarding_workout_create_button"
              title={isEditing ? "Guardar cambios" : "Crear planilla"}
              message={isEditing
                ? "Los cambios quedarán guardados para las próximas sesiones de esta planilla."
                : "Al crearla, se genera automáticamente la primera sesión para empezar de inmediato y guardar progreso por spot."}
            />
          </View>
          <Pressable
            disabled={!canCreate || saving}
            onPress={onCreateWorkout}
            onPressIn={() => pressBtn(0.96)}
            onPressOut={() => pressBtn(1)}
            style={{
              height: 56, borderRadius: 18,
              backgroundColor: canCreate && !saving ? "#F59E0B" : "rgba(245,158,11,0.16)",
              alignItems: "center", justifyContent: "center",
              flexDirection: "row", gap: 10,
              borderWidth: canCreate ? 0 : 1.5,
              borderColor: "rgba(245,158,11,0.22)",
              shadowColor: "#F59E0B",
              shadowOpacity: canCreate && !saving ? 0.28 : 0,
              shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
              elevation: canCreate && !saving ? 6 : 0,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#0B1220" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={canCreate ? "#0B1220" : "rgba(255,255,255,0.22)"}
                />
                <Text style={{
                  color: canCreate ? "#0B1220" : "rgba(255,255,255,0.22)",
                  fontWeight: "900", fontSize: 15, letterSpacing: 0.1,
                }}>
                  {isEditing ? "Guardar cambios" : "Crear planilla"}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniCounterBtn({ label, onPress }: { label: "−" | "+"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "white", fontWeight: "900", fontSize: 18, lineHeight: 20 }}>{label}</Text>
    </Pressable>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      padding: 16, borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.055)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    }}>
      {children}
    </View>
  );
}

function SectionHeader({
  icon, title,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"]; title: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Ionicons name={icon} size={14} color="rgba(255,255,255,0.38)" />
      <Text style={{
        color: "rgba(255,255,255,0.50)", fontSize: 11,
        fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase",
      }}>
        {title}
      </Text>
    </View>
  );
}

function MiniChip({ label, onPress, dim }: { label: string; onPress: () => void; dim?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10,
        backgroundColor: dim ? "rgba(255,255,255,0.04)" : "rgba(245,158,11,0.10)",
        borderWidth: 1,
        borderColor: dim ? "rgba(255,255,255,0.09)" : "rgba(245,158,11,0.25)",
      }}
    >
      <Text style={{
        color: dim ? "rgba(255,255,255,0.38)" : "#F59E0B",
        fontWeight: "800", fontSize: 12,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CounterCard({
  title, icon, accentColor, value, counterAnim, onDec, onInc,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accentColor: string;
  value: number;
  counterAnim: { scale: Animated.Value; bump: () => void };
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={{
      flex: 1, padding: 16, borderRadius: 20, gap: 10,
      backgroundColor: "rgba(255,255,255,0.055)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={13} color={accentColor} style={{ opacity: 0.70 }} />
        <Text style={{
          color: "rgba(255,255,255,0.42)", fontSize: 11, fontWeight: "700", flex: 1,
        }} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Animated.Text style={{
        color: "white", fontWeight: "900", fontSize: 30, letterSpacing: -1,
        transform: [{ scale: counterAnim.scale }],
      }}>
        {value}
      </Animated.Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {([{ label: "−", action: onDec }, { label: "+", action: onInc }] as const).map(({ label, action }) => (
          <Pressable
            key={label}
            onPress={action}
            style={{
              flex: 1, height: 38, borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.07)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900", fontSize: 18, lineHeight: 22 }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
