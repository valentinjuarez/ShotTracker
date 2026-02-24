// app/(tabs)/workout/index.tsx
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkoutRow = {
  id: string;
  title: string;
  status: string;
  shot_type: string;
  sessions_goal: number;
  created_at: string;
};

type SessionRow = {
  id: string;
  workout_id: string;
  session_number: number;
  status: string;
  finished_at: string | null;
  pct: number | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pctColor(p: number) {
  if (p >= 0.65) return "rgba(34,197,94,1)";
  if (p >= 0.4) return "rgba(245,158,11,1)";
  return "rgba(239,68,68,1)";
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Animation hooks ─────────────────────────────────────────────────────────

function useFadeSlide(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 380, delay, useNativeDriver: true }).start();
  }, []);
  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function WorkoutHistory() {
  const router = useRouter();
  const [workouts, setWorkouts]   = useState<WorkoutRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sessions per workout, loaded lazily when expanded
  const [sessionsMap, setSessionsMap] = useState<Record<string, SessionRow[]>>({});
  const [loadingSess, setLoadingSess] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});

  const headerAnim = useFadeSlide(0);
  const listAnim   = useFadeSlide(80);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("workouts")
        .select("id, title, status, shot_type, sessions_goal, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWorkouts((data ?? []) as WorkoutRow[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
  }, [loadData]);

  async function loadSessions(workoutId: string) {
    if (sessionsMap[workoutId] || loadingSess[workoutId]) return;
    try {
      setLoadingSess((p) => ({ ...p, [workoutId]: true }));

      const { data: sessList } = await supabase
        .from("sessions")
        .select("id, workout_id, session_number, status, finished_at")
        .eq("workout_id", workoutId)
        .order("session_number", { ascending: true });

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
          agg[s.session_id].mk  += s.makes    ?? 0;
        });
        doneIds.forEach((id) => {
          const a = agg[id];
          pctMap[id] = a && a.att > 0 ? a.mk / a.att : null;
        });
      }

      const withPct: SessionRow[] = rows.map((r) => ({
        ...r, pct: pctMap[r.id] ?? null,
      }));

      setSessionsMap((p) => ({ ...p, [workoutId]: withPct }));
    } finally {
      setLoadingSess((p) => ({ ...p, [workoutId]: false }));
    }
  }

  function toggleExpand(workoutId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !expanded[workoutId];
    setExpanded((p) => ({ ...p, [workoutId]: next }));
    if (next) loadSessions(workoutId);
  }

  function onDeleteWorkout(workoutId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Eliminar planilla",
      "¿Eliminar esta planilla y todas sus sesiones? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const { data: sids } = await supabase
                .from("sessions")
                .select("id")
                .eq("workout_id", workoutId);
              const ids = (sids ?? []).map((s: any) => s.id);
              if (ids.length > 0) {
                await supabase.from("session_spots").delete().in("session_id", ids);
                await supabase.from("sessions").delete().in("id", ids);
              }
              await supabase.from("workouts").delete().eq("id", workoutId);
              setWorkouts((p) => p.filter((w) => w.id !== workoutId));
              setSessionsMap((p) => { const n = { ...p }; delete n[workoutId]; return n; });
            } catch {
              Alert.alert("Error", "No se pudo eliminar la planilla.");
            }
          },
        },
      ]
    );
  }

  function onDeleteSession(sessionId: string, workoutId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Eliminar sesión",
      "¿Eliminar esta sesión y todos sus datos?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.from("session_spots").delete().eq("session_id", sessionId);
              await supabase.from("sessions").delete().eq("id", sessionId);
              setSessionsMap((p) => ({
                ...p,
                [workoutId]: (p[workoutId] ?? []).filter((s) => s.id !== sessionId),
              }));
            } catch {
              Alert.alert("Error", "No se pudo eliminar la sesión.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* Ambient glow */}
      <View style={{
        position: "absolute", top: -50, right: -50,
        width: 220, height: 220, borderRadius: 110,
        backgroundColor: "rgba(245,158,11,0.04)",
      }} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F59E0B"
            colors={["#F59E0B"]}
          />
        }
      >
        {/* Header */}
        <Animated.View style={[{ gap: 3 }, headerAnim]}>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, letterSpacing: 0.2 }}>
            Tu entrenamiento
          </Text>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>
            Planillas 📋
          </Text>
        </Animated.View>

        {loading ? (
          <ActivityIndicator color="#F59E0B" style={{ marginTop: 40 }} />
        ) : workouts.length === 0 ? (
          <Animated.View style={[{ alignItems: "center", gap: 10, paddingVertical: 60 }, listAnim]}>
            <View style={{
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: "rgba(255,255,255,0.05)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="clipboard-outline" size={28} color="rgba(255,255,255,0.18)" />
            </View>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 14 }}>
              Sin planillas aún
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center" }}>
              Creá tu primera planilla desde la pantalla de inicio.
            </Text>
          </Animated.View>
        ) : (
          <Animated.View style={[{ gap: 12 }, listAnim]}>
            {workouts.map((w, i) => {
              const isExpanded = expanded[w.id] ?? false;
              const sessions   = sessionsMap[w.id] ?? [];
              const isSessLoading = loadingSess[w.id] ?? false;
              const isDone     = w.status === "DONE";
              const doneSess   = sessions.filter((s) => s.status === "DONE").length;

              return (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  isDone={isDone}
                  sessions={sessions}
                  isSessLoading={isSessLoading}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpand(w.id)}
                  onDeleteWorkout={() => onDeleteWorkout(w.id)}
                  onDeleteSession={(sess) => onDeleteSession(sess.id, w.id)}
                  onSessionPress={(sess) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (sess.status === "IN_PROGRESS") {
                      router.push({
                        pathname: "/(tabs)/session/run",
                        params: { sessionId: sess.id, workoutId: w.id },
                      });
                    } else if (sess.status === "DONE") {
                      router.push({
                        pathname: "/(tabs)/session/summary",
                        params: { sessionId: sess.id, workoutId: w.id },
                      });
                    }
                  }}
                  delay={i * 50}
                />
              );
            })}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── WorkoutCard ──────────────────────────────────────────────────────────────

function WorkoutCard({
  workout, isDone, sessions, isSessLoading, isExpanded, onToggle, onSessionPress, onDeleteWorkout, onDeleteSession, delay,
}: {
  workout: WorkoutRow;
  isDone: boolean;
  sessions: SessionRow[];
  isSessLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSessionPress: (s: SessionRow) => void;
  onDeleteWorkout: () => void;
  onDeleteSession: (s: SessionRow) => void;
  delay: number;
}) {
  const doneSessions = sessions.filter((s) => s.status === "DONE").length;
  const totalGoal    = workout.sessions_goal ?? 0;
  const progress     = totalGoal > 0 ? Math.min(1, doneSessions / totalGoal) : 0;

  const expandAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const accentColor = isDone ? "rgba(34,197,94,1)" : "rgba(99,179,237,1)";
  const accentBg    = isDone ? "rgba(34,197,94,0.10)" : "rgba(99,179,237,0.08)";
  const accentBorder= isDone ? "rgba(34,197,94,0.25)" : "rgba(99,179,237,0.20)";

  return (
    <View style={{
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.055)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
      overflow: "hidden",
    }}>
      {/* Header row */}
      <Pressable onPress={onToggle} style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          {/* Icon */}
          <View style={{
            width: 42, height: 42, borderRadius: 13,
            backgroundColor: accentBg,
            borderWidth: 1, borderColor: accentBorder,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons
              name={isDone ? "trophy" : "clipboard"}
              size={19}
              color={accentColor}
            />
          </View>

          {/* Title + meta */}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }} numberOfLines={1}>
              {workout.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Status pill */}
              <View style={{
                paddingVertical: 2, paddingHorizontal: 7, borderRadius: 99,
                backgroundColor: accentBg, borderWidth: 1, borderColor: accentBorder,
              }}>
                <Text style={{ color: accentColor, fontWeight: "800", fontSize: 10 }}>
                  {isDone ? "Completada" : "En progreso"}
                </Text>
              </View>
              {/* Type pill */}
              <View style={{
                paddingVertical: 2, paddingHorizontal: 7, borderRadius: 99,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
              }}>
                <Text style={{ color: "rgba(255,255,255,0.40)", fontWeight: "700", fontSize: 10 }}>
                  {workout.shot_type === "3PT" ? "Triples" : "Dobles"}
                </Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                {fmtDate(workout.created_at)}
              </Text>
            </View>
          </View>

          {/* Delete + Chevron */}
          <Pressable
            onPress={onDeleteWorkout}
            hitSlop={12}
            style={{ padding: 4 }}
          >
            <Ionicons name="trash-outline" size={15} color="rgba(239,68,68,0.55)" />
          </Pressable>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color="rgba(255,255,255,0.30)"
          />
        </View>

        {/* Progress bar */}
        <View style={{ gap: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
              Sesiones completadas
            </Text>
            <Text style={{ color: accentColor, fontWeight: "900", fontSize: 11 }}>
              {isDone ? totalGoal : doneSessions} / {totalGoal}
            </Text>
          </View>
          <View style={{ height: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <View style={{
              height: 4, borderRadius: 99,
              backgroundColor: accentColor,
              width: `${Math.round(progress * 100)}%`,
            }} />
          </View>
        </View>
      </Pressable>

      {/* Expanded sessions list */}
      {isExpanded && (
        <View style={{
          borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
          paddingHorizontal: 16, paddingBottom: 12, paddingTop: 10, gap: 8,
        }}>
          <Text style={{
            color: "rgba(255,255,255,0.32)", fontSize: 10,
            fontWeight: "700", letterSpacing: 1.0, textTransform: "uppercase",
            marginBottom: 2,
          }}>
            Sesiones
          </Text>

          {isSessLoading ? (
            <ActivityIndicator color="#F59E0B" style={{ marginVertical: 12 }} />
          ) : sessions.length === 0 ? (
            <Text style={{ color: "rgba(255,255,255,0.30)", fontSize: 13 }}>
              Sin sesiones registradas.
            </Text>
          ) : (
            sessions.map((sess) => {
              const isInProgress = sess.status === "IN_PROGRESS";
              const isDoneSess   = sess.status === "DONE";
              const canTap       = isInProgress || isDoneSess;
              const pctStr       = sess.pct !== null ? `${Math.round(sess.pct * 100)}%` : "–";
              const dateStr      = fmtDate(sess.finished_at);

              return (
                <Pressable
                  key={sess.id}
                  onPress={() => canTap && onSessionPress(sess)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 12,
                    padding: 12, borderRadius: 14,
                    backgroundColor: isInProgress
                      ? "rgba(245,158,11,0.08)"
                      : "rgba(255,255,255,0.04)",
                    borderWidth: 1,
                    borderColor: isInProgress
                      ? "rgba(245,158,11,0.25)"
                      : "rgba(255,255,255,0.08)",
                  }}
                >
                  {/* Session number badge */}
                  <View style={{
                    width: 34, height: 34, borderRadius: 10,
                    backgroundColor: isInProgress
                      ? "rgba(245,158,11,0.14)"
                      : isDoneSess && sess.pct !== null
                        ? pctColor(sess.pct).replace("1)", "0.12)")
                        : "rgba(255,255,255,0.06)",
                    borderWidth: 1,
                    borderColor: isInProgress
                      ? "rgba(245,158,11,0.30)"
                      : isDoneSess && sess.pct !== null
                        ? pctColor(sess.pct).replace("1)", "0.28)")
                        : "rgba(255,255,255,0.09)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {isInProgress ? (
                      <Ionicons name="play" size={13} color="#F59E0B" />
                    ) : isDoneSess && sess.pct !== null ? (
                      <Text style={{
                        color: pctColor(sess.pct), fontWeight: "900", fontSize: 11,
                      }}>
                        {pctStr}
                      </Text>
                    ) : (
                      <Text style={{ color: "rgba(255,255,255,0.35)", fontWeight: "900", fontSize: 12 }}>
                        {sess.session_number}
                      </Text>
                    )}
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>
                      Sesión {sess.session_number}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 1 }}>
                      {isInProgress ? "En progreso" : dateStr || "—"}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Pressable
                      onPress={() => onDeleteSession(sess)}
                      hitSlop={12}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={14} color="rgba(239,68,68,0.50)" />
                    </Pressable>
                    {canTap && (
                      <Ionicons
                        name={isInProgress ? "arrow-forward-circle" : "chevron-forward"}
                        size={16}
                        color={isInProgress ? "#F59E0B" : "rgba(255,255,255,0.22)"}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}
