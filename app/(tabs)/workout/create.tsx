// app/workout/create.tsx
import { DOBLE_SPOTS, TRIPLE_SPOTS } from "@/src/data/spots";
import { supabase } from "@/src/lib/supabase";
import { Court } from "@/src/ui/Court";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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

type PlanTipo = "3PT" | "2PT";

// ─── Animated entrance hook ───────────────────────────────────────────────────
function useFadeSlide(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, delay,
      useNativeDriver: true,
      damping: 14, stiffness: 100,
    }).start();
  }, []);
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

  const courtW = Math.min(width - (isSmall ? 32 : 40), 420);
  const courtH = Math.round(courtW * 1.2);

  const [name, setName]               = useState("Planilla de tiro");
  const [tipo, setTipo]               = useState<PlanTipo>("3PT");
  const [sessionsGoal, setSessionsGoal] = useState(14);
  const [defaultTarget, setDefaultTarget] = useState(10);
  const [nameFocused, setNameFocused] = useState(false);
  const [saving, setSaving]           = useState(false);

  const router    = useRouter();
  const btnScale   = useRef(new Animated.Value(1)).current;
  const sessAnim   = useCounterAnim();
  const tgtAnim    = useCounterAnim();

  const spots = useMemo(
    () => (tipo === "3PT" ? TRIPLE_SPOTS : DOBLE_SPOTS),
    [tipo]
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(TRIPLE_SPOTS.map((s) => s.id))
  );

  const syncSelection = (newTipo: PlanTipo) => {
    const newSpots = newTipo === "3PT" ? TRIPLE_SPOTS : DOBLE_SPOTS;
    setSelected(new Set(newSpots.map((s) => s.id)));
  };

  function toggleSpot(id: string) {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCount = selected.size;
  const totalSpots    = spots.length;

  const canCreate =
    name.trim().length > 0 &&
    selectedCount > 0 &&
    sessionsGoal > 0 &&
    defaultTarget > 0;

  function setAll(on: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (on) setSelected(new Set(spots.map((s) => s.id)));
    else setSelected(new Set());
  }

  function pressBtn(v: number) {
    Animated.spring(btnScale, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 2 }).start();
  }

  async function onCreateWorkout() {
    if (!canCreate) return;
    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("No autenticado");

      // Create workout + first session + spots in one security-definer RPC
      const orderedSpotKeys = spots
        .filter((s) => selected.has(s.id))
        .map((s) => s.id);

      const { data: rpcData, error: rpcErr } = await supabase
        .rpc("create_workout_session", {
          p_title:           name.trim(),
          p_shot_type:       tipo,
          p_sessions_goal:   sessionsGoal,
          p_target_per_spot: defaultTarget,
          p_spot_keys:       orderedSpotKeys,
        });
      if (rpcErr) throw rpcErr;

      const workoutId = (rpcData as any).workout_id as string;
      const sessionId = (rpcData as any).session_id as string;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 4. Go directly to the run screen
      router.push({
        pathname: "/(tabs)/session/run",
        params: { sessionId, workoutId },
      });
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e?.message ?? "No se pudo crear la planilla.");
    } finally {
      setSaving(false);
    }
  }

  const reset = useCallback(() => {
    setName("Planilla de tiro");
    setTipo("3PT");
    setSessionsGoal(14);
    setDefaultTarget(10);
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
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, fontWeight: "600", letterSpacing: 0.3 }}>
            Nueva planilla
          </Text>
          <Text style={{ color: "white", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>
            Crear planilla 🏀
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, lineHeight: 18, marginTop: 2 }}>
            Configurá un ciclo de entrenamiento y elegí tus posiciones en la cancha.
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
              <SectionHeader icon="map-outline" title="Posiciones" />
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
                spots={spots}
                selectedIds={selected}
                onToggleSpot={toggleSpot}
              />
            </View>
          </SectionCard>
        </Animated.View>

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
              { icon: "basketball-outline", label: tipo === "3PT" ? "Triples" : "Dobles", accent: true },
              { icon: "map-outline",        label: `${selectedCount} posiciones`, accent: selectedCount > 0 },
              { icon: "calendar-outline",   label: `${sessionsGoal} sesiones`, accent: true },
              { icon: "repeat-outline",     label: `${defaultTarget} intentos`, accent: true },
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
                  Crear planilla
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
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
