// app/session/summary.tsx
import { ALL_SPOTS } from "@/src/data/spots";
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { File } from "expo-file-system/next";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionSpotRow = {
  id: string;
  session_id: string;
  spot_key: string;
  shot_type: "2PT" | "3PT";
  target_attempts: number;
  attempts: number;
  makes: number;
  order_index: number;
};

// ─── Color helpers ────────────────────────────────────────────────────────────

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function heatColor(p: number) {
  const t = clamp01(p);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  let r = 0, g = 0, b = 0;
  if (t <= 0.5) {
    const k = t / 0.5;
    r = 255;
    g = Math.round(40 + (215 - 40) * k);
    b = 60;
  } else {
    const k = (t - 0.5) / 0.5;
    r = Math.round(255 + (34 - 255) * k);
    g = 215;
    b = Math.round(60 + (94 - 60) * k);
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── Animation hooks ──────────────────────────────────────────────────────────

function useFadeSlide(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, []);
  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
  };
}

function useCountUp(target: number, delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: target, duration: 900, delay, useNativeDriver: false }).start();
  }, [target]);
  return anim;
}

function usePulse(active = true) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) { anim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.22, duration: 650, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,    duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  return anim;
}

function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  return { scale, onIn, onOut };
}

type WorkoutData = {
  id: string;
  title: string;
  shot_type: string;
  sessions_goal: number;
  target_per_spot: number;
};

type PdfSessionRow = {
  session_number: number;
  spotRows: { spot_key: string; makes: number; attempts: number; target_attempts: number; order_index: number }[];
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SessionSummary() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const courtW = Math.min(width - (isSmall ? 32 : 40) - 32, 520);
  const courtH = Math.round(courtW * 1.08);

  const { sessionId, workoutId } = useLocalSearchParams<{ sessionId?: string; workoutId?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<SessionSpotRow[]>([]);
  const [mode, setMode] = useState<"HEAT" | "LIST">("HEAT");
  const [selectedSpotKey, setSelectedSpotKey] = useState<string | null>(null);

  // ─── Workout mode state ───────────────────────────────────────────────────
  const [workout, setWorkout]               = useState<WorkoutData | null>(null);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [savingNext, setSavingNext]         = useState(false);
  const [pdfLoading, setPdfLoading]         = useState(false);
  const [shareLoading, setShareLoading]     = useState(false);

  const headerAnim  = useFadeSlide(0);
  const toggleAnim  = useFadeSlide(80);
  const statsAnim   = useFadeSlide(160);
  const insightAnim = useFadeSlide(240);
  const bodyAnim    = useFadeSlide(320);
  const actionsAnim = useFadeSlide(400);

  const loadData = useCallback(async (opts?: { isRefresh?: boolean }) => {
    if (!sessionId) { Alert.alert("Error", "Falta sessionId."); router.back(); return; }
    try {
      if (!opts?.isRefresh) setLoading(true);
      const { data, error } = await supabase
        .from("session_spots")
        .select("id, session_id, spot_key, shot_type, target_attempts, attempts, makes, order_index")
        .eq("session_id", sessionId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      const r = (data ?? []) as SessionSpotRow[];
      if (!r.length) { Alert.alert("Sin datos", "No hay tiros registrados."); router.back(); return; }
      setRows(r);
      setSelectedSpotKey((prev) => prev ?? r[0]?.spot_key ?? null);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo cargar el resumen."); router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData({ isRefresh: true });
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load workout metadata + completed count when in workout mode
  // completedSessions = session_number of the current session (reliable, no race condition)
  useEffect(() => {
    if (!workoutId) {
      // Free session or navigated without workoutId — reset workout state to
      // prevent stale data from a previous workout summary showing "Planilla completada"
      setWorkout(null);
      setCompletedSessions(0);
      return;
    }
    (async () => {
      const [{ data: wkData }, { data: sessData }] = await Promise.all([
        supabase
          .from("workouts")
          .select("id, title, shot_type, sessions_goal, target_per_spot")
          .eq("id", workoutId)
          .single(),
        supabase
          .from("sessions")
          .select("session_number")
          .eq("id", sessionId ?? "")
          .single(),
      ]);
      if (wkData) setWorkout(wkData as WorkoutData);
      // session_number IS the completed count: session 1 finished = 1 done, session 3 finished = 3 done
      setCompletedSessions(sessData?.session_number ?? 0);
    })();
  }, [workoutId, sessionId]);

  // Create the next session of the workout and navigate to run screen
  async function createNextSession() {
    if (!workoutId || !workout) return;
    try {
      setSavingNext(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { data: rpcData, error: rpcErr } = await supabase
        .rpc("create_next_workout_session", { p_workout_id: workoutId });
      if (rpcErr) throw rpcErr;

      const nextSessionId = (rpcData as any).session_id as string;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/session/run",
        params: { sessionId: nextSessionId, workoutId },
      });
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e?.message ?? "No se pudo iniciar la siguiente sesión.");
    } finally {
      setSavingNext(false);
    }
  }

  async function handlePdf() {
    try {
      setPdfLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let html: string;

      if (workout && completedSessions >= workout.sessions_goal) {
        // ── Planilla completada: buscar TODAS las sesiones ────────────────
        const { data: allSess, error: sessErr } = await supabase
          .from("sessions")
          .select("id, session_number")
          .eq("workout_id", workout.id)
          .neq("status", "PENDING")
          .order("session_number", { ascending: true });
        if (sessErr) throw sessErr;

        const sessIds = (allSess ?? []).map((s: any) => s.id as string);
        const { data: allSpots, error: spotErr } = await supabase
          .from("session_spots")
          .select("session_id, spot_key, makes, attempts, target_attempts, order_index")
          .in("session_id", sessIds);
        if (spotErr) throw spotErr;

        const sessMap = new Map<string, PdfSessionRow>();
        (allSess ?? []).forEach((s: any) =>
          sessMap.set(s.id, { session_number: s.session_number, spotRows: [] })
        );
        (allSpots ?? []).forEach((sp: any) =>
          sessMap.get(sp.session_id)?.spotRows.push(sp)
        );

        const orderedSessions = Array.from(sessMap.values())
          .sort((a, b) => a.session_number - b.session_number);

        // Orden de spots tomado de la primera sesión
        const firstSpots = (orderedSessions[0]?.spotRows ?? [])
          .slice()
          .sort((a, b) => a.order_index - b.order_index);
        const spotOrder = firstSpots.map((s) => s.spot_key);

        html = generateWorkoutHtml({ workout, orderedSessions, spotOrder, spotMetaByKey });
      } else {
        // ── Sesión libre ─────────────────────────────────────────────────
        html = generateFreeSessionHtml({ rows, stats, spotMetaByKey });
      }

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      // Renombrar con el nombre del usuario
      const { data: authData } = await supabase.auth.getUser();
      const rawName: string = authData.user?.user_metadata?.display_name
        ?? authData.user?.user_metadata?.username
        ?? "jugador";
      const safeName = rawName
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // quitar tildes
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, 32) || "jugador";
      const suffix = workout ? `_${workout.title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24)}` : "";
      const dir = uri.substring(0, uri.lastIndexOf("/") + 1);
      const newUri = `${dir}Planilla_${safeName}${suffix}.pdf`;
      const dest = new File(newUri);
      if (dest.exists) dest.delete();
      new File(uri).move(dest);

      await Sharing.shareAsync(newUri, { mimeType: "application/pdf", dialogTitle: "Exportar PDF", UTI: "com.adobe.pdf" });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo generar el PDF.");
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleShareTeam() {
    if (!workout) return;
    try {
      setShareLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      // Equipo del jugador
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .eq("role", "player")
        .maybeSingle();

      if (!membership) {
        Alert.alert("Sin equipo", "No estás unido a ningún equipo todavía.");
        return;
      }
      const teamId = (membership as any).team_id as string;

      // ¿Ya compartida?
      const { data: existing } = await supabase
        .from("team_workouts")
        .select("id")
        .eq("workout_id", workout.id)
        .eq("team_id", teamId)
        .maybeSingle();

      if (existing) {
        Alert.alert("Ya compartida", "Esta planilla ya fue compartida con tu equipo.");
        return;
      }

      await supabase.from("team_workouts").insert({
        workout_id:     workout.id,
        team_id:        teamId,
        user_id:        userId,
        workout_title:  workout.title,
        workout_status: "COMPLETED",
        shot_type:      workout.shot_type,
        sessions_goal:  workout.sessions_goal,
        shared_at:      new Date().toISOString(),
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("¡Compartida! 🎉", "Tu planilla fue compartida con el equipo. El entrenador ya puede verla.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo compartir con el equipo.");
    } finally {
      setShareLoading(false);
    }
  }

  const stats = useMemo(() => {
    const totalAttempts = rows.reduce((acc, r) => acc + (r.attempts ?? 0), 0);
    const totalMakes    = rows.reduce((acc, r) => acc + (r.makes ?? 0), 0);
    const pct = totalAttempts > 0 ? totalMakes / totalAttempts : 0;
    const perSpot = rows.map((r) => ({ ...r, pct: r.attempts > 0 ? r.makes / r.attempts : 0 }));
    const sorted  = [...perSpot].sort((a, b) => b.pct - a.pct);
    const mean = perSpot.reduce((acc, r) => acc + r.pct, 0) / Math.max(1, perSpot.length);
    const std  = Math.sqrt(perSpot.reduce((acc, r) => acc + Math.pow(r.pct - mean, 2), 0) / Math.max(1, perSpot.length));
    return { totalAttempts, totalMakes, pct, perSpot, best: sorted[0], worst: sorted[sorted.length - 1], mean, std };
  }, [rows]);

  const spotMetaByKey = useMemo(() => {
    const map = new Map<string, (typeof ALL_SPOTS)[number]>();
    ALL_SPOTS.forEach((s) => map.set(s.id, s));
    return map;
  }, []);

  const selectedRow  = useMemo(
    () => stats.perSpot.find((r) => r.spot_key === selectedSpotKey) ?? null,
    [selectedSpotKey, stats.perSpot]
  );
  const selectedMeta = selectedSpotKey ? spotMetaByKey.get(selectedSpotKey) : null;

  function pctLabel(p: number) { return `${Math.round(p * 100)}%`; }
  async function onHaptic(style = Haptics.ImpactFeedbackStyle.Light) {
    try { await Haptics.impactAsync(style); } catch {}
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#F59E0B" size="large" />
        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 14, fontWeight: "700" }}>Cargando resumen…</Text>
      </SafeAreaView>
    );
  }

  const sortedByPerf = stats.perSpot.slice().sort((a, b) => b.pct - a.pct);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: isSmall ? 16 : 20, paddingTop: 10, paddingBottom: 36, gap: 14 }}
        keyboardShouldPersistTaps="handled"
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
        <Animated.View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, headerAnim]}>
          <View style={{ gap: 3, flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" }}>
              {workout ? workout.title : "Resumen de sesión"}
            </Text>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }} numberOfLines={1}>
              {workout
                ? `Sesión ${completedSessions} de ${workout.sessions_goal}`
                : "Análisis completo"}
            </Text>
          </View>
          <SpringBtn onPress={() => router.replace("/")} onHaptic={() => onHaptic()}>
            <Ionicons name="home" size={18} color="rgba(255,255,255,0.9)" />
          </SpringBtn>
        </Animated.View>

        {/* Mode toggle */}
        <Animated.View style={[{ flexDirection: "row", gap: 10 }, toggleAnim]}>
          <SegBtn active={mode === "HEAT"} text="Mapa de calor" icon="flame"
            onPress={async () => { await onHaptic(); setMode("HEAT"); }} />
          <SegBtn active={mode === "LIST"} text="Lista" icon="list"
            onPress={async () => { await onHaptic(); setMode("LIST"); }} />
        </Animated.View>

        {/* Animated stat pills */}
        <Animated.View style={[{ flexDirection: "row", gap: 12 }, statsAnim]}>
          <AnimatedStatPill title="Metidos"  target={stats.totalMakes}            delay={200} />
          <AnimatedStatPill title="Intentos" target={stats.totalAttempts}         delay={300} />
          <AnimatedStatPill title="Promedio" target={Math.round(stats.pct * 100)} delay={400} suffix="%" />
        </Animated.View>

        {/* Insights */}
        <Animated.View style={[card, insightAnim]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="sparkles" size={14} color="#F59E0B" />
            <Text style={{ color: "#F59E0B", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>
              Insights
            </Text>
          </View>
          <View style={{ marginTop: 10, gap: 10 }}>
            <InsightRow
              title="Mejor spot"
              value={`${spotMetaByKey.get(stats.best?.spot_key ?? "")?.label ?? stats.best?.spot_key ?? "—"} · ${pctLabel(stats.best?.pct ?? 0)}`}
              color={heatColor(stats.best?.pct ?? 0)} icon="trending-up" pulse />
            <InsightRow
              title="Peor spot"
              value={`${spotMetaByKey.get(stats.worst?.spot_key ?? "")?.label ?? stats.worst?.spot_key ?? "—"} · ${pctLabel(stats.worst?.pct ?? 0)}`}
              color={heatColor(stats.worst?.pct ?? 0)} icon="trending-down" />
            <InsightRow
              title="Consistencia"
              value={`${Math.max(0, Math.round((1 - stats.std) * 100))}%`}
              color="rgba(255,255,255,0.7)" icon="analytics"
              hint="Mientras más alto, más parejos tus % entre spots." />
          </View>
        </Animated.View>

        {/* Body */}
        <Animated.View style={bodyAnim}>
          {mode === "HEAT" ? (
            <>
              <View style={card}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <View style={{ gap: 2 }}>
                    <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>Mapa de calor</Text>
                    <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 12 }}>Tocá un spot para ver su detalle.</Text>
                  </View>
                  <View style={{ gap: 5 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 28, height: 6, borderRadius: 999, backgroundColor: heatColor(0) }} />
                      <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 10 }}>0 %</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 28, height: 6, borderRadius: 999, backgroundColor: heatColor(0.5) }} />
                      <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 10 }}>50 %</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 28, height: 6, borderRadius: 999, backgroundColor: heatColor(1) }} />
                      <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 10 }}>100 %</Text>
                    </View>
                  </View>
                </View>

                <HeatCourt
                  width={courtW}
                  height={courtH}
                  spots={ALL_SPOTS}
                  spotDataMap={new Map(stats.perSpot.map((r) => [r.spot_key, r]))}
                  selectedSpotKey={selectedSpotKey}
                  onSelectSpot={async (key) => { await onHaptic(); setSelectedSpotKey(key); }}
                />
              </View>

              <View style={[card, { marginTop: 14 }]}>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>Detalle del spot</Text>
                {selectedRow ? (
                  <View style={{ marginTop: 12, gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ gap: 3, flex: 1 }}>
                        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>
                          {selectedRow.shot_type === "3PT" ? "Triple" : "Doble"}
                        </Text>
                        <Text style={{ color: "white", fontWeight: "900", fontSize: 20 }} numberOfLines={1}>
                          {selectedMeta?.label ?? selectedRow.spot_key}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <Text style={{ color: heatColor(selectedRow.pct), fontWeight: "900", fontSize: 30 }}>
                          {pctLabel(selectedRow.pct)}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 12 }}>
                          {selectedRow.makes} de {selectedRow.attempts}
                        </Text>
                      </View>
                    </View>
                    <AnimatedBar value={selectedRow.pct} color={heatColor(selectedRow.pct)} />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <MiniStat label="Metidos"  value={`${selectedRow.makes}`} />
                      <MiniStat label="Intentos" value={`${selectedRow.attempts}`} />
                      <MiniStat label="Objetivo" value={`${selectedRow.target_attempts}`} />
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, lineHeight: 16 }}>
                      {selectedRow.pct < 0.4
                        ? "⚠️ Este spot necesita trabajo. Sumá sesiones extra focalizadas acá."
                        : selectedRow.pct < 0.65
                        ? "📈 Buen progreso. Seguí acumulando repeticiones para consolidar."
                        : "🔥 Excelente rendimiento. Mantené el nivel con sesiones de mantenimiento."}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: "rgba(255,255,255,0.50)", marginTop: 12 }}>Elegí un spot para ver el detalle.</Text>
                )}
              </View>
            </>
          ) : (
            <View style={card}>
              <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>Lista · rendimiento</Text>
              <Text style={{ color: "rgba(255,255,255,0.50)", marginTop: 4, fontSize: 12 }}>
                Tocá un item para enfocarlo en el mapa.
              </Text>
              <View style={{ marginTop: 14, gap: 10 }}>
                {sortedByPerf.map((r, i) => {
                  const meta = spotMetaByKey.get(r.spot_key);
                  return (
                    <ListSpotRow key={r.id}
                      rank={i + 1} label={meta?.label ?? r.spot_key}
                      makes={r.makes} attempts={r.attempts} shotType={r.shot_type}
                      pct={r.pct} color={heatColor(r.pct)} selected={selectedSpotKey === r.spot_key}
                      delay={i * 45}
                      onPress={async () => { await onHaptic(); setSelectedSpotKey(r.spot_key); setMode("HEAT"); }} />
                  );
                })}
              </View>
            </View>
          )}
        </Animated.View>

        {/* Bottom actions */}
        <Animated.View style={[{ gap: 10 }, actionsAnim]}>

          {/* ── Planilla completada ─────────────────────────────────────── */}
          {workout && completedSessions >= workout.sessions_goal ? (
            <View style={{
              padding: 18, borderRadius: 20, gap: 12,
              backgroundColor: "rgba(34,197,94,0.10)",
              borderWidth: 1.5, borderColor: "rgba(34,197,94,0.35)",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 13,
                  backgroundColor: "rgba(34,197,94,0.18)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name="trophy" size={24} color="rgba(34,197,94,1)" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "rgba(34,197,94,1)", fontWeight: "900", fontSize: 16 }}>
                    ¡Planilla completada! 🎉
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
                    {workout.sessions_goal} sesiones · {workout.title}
                  </Text>
                </View>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 12, lineHeight: 17 }}>
                Completaste todas las sesiones de esta planilla. Podés descargar el PDF o compartir con tu equipo.
              </Text>
            </View>
          ) : null}

          {/* ── Primary CTA ─────────────────────────────────────────────── */}
          {workout && completedSessions < workout.sessions_goal ? (
            /* Next workout session */
            <SpringBtn
              onPress={createNextSession}
              onHaptic={() => onHaptic()}
              style={{ height: 54, borderRadius: 18, backgroundColor: "#F59E0B",
                alignItems: "center" as const, justifyContent: "center" as const,
                flexDirection: "row" as const, gap: 10 }}>
              {savingNext ? (
                <ActivityIndicator color="#0B1220" />
              ) : (
                <>
                  <Ionicons name="arrow-forward-circle" size={20} color="#0B1220" />
                  <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 15 }}>
                    Siguiente · Sesión {completedSessions + 1} de {workout.sessions_goal}
                  </Text>
                </>
              )}
            </SpringBtn>
          ) : !workout ? (
            /* Free session — new free session */
            <SpringBtn
              onPress={async () => { await onHaptic(Haptics.ImpactFeedbackStyle.Medium); router.push("/session/create"); }}
              onHaptic={() => onHaptic()}
              style={{ height: 54, borderRadius: 18, backgroundColor: "#F59E0B",
                alignItems: "center" as const, justifyContent: "center" as const,
                flexDirection: "row" as const, gap: 10 }}>
              <Ionicons name="refresh" size={18} color="#0B1220" />
              <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 15 }}>Nueva sesión</Text>
            </SpringBtn>
          ) : null}

          {/* ── Secondary row: Home · PDF (condicional) · Mi equipo (solo planillas) ── */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {/* Home */}
            <SpringBtn
              onPress={async () => { await onHaptic(); router.replace("/"); }}
              onHaptic={() => onHaptic()}
              style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                alignItems: "center" as const, justifyContent: "center" as const }}>
              <Ionicons name="home" size={20} color="rgba(255,255,255,0.9)" />
            </SpringBtn>

            {/* PDF — sesión libre: siempre. Planilla: solo al completar */}
            {(!workout || completedSessions >= workout.sessions_goal) && (
              <SpringBtn
                onPress={handlePdf}
                onHaptic={() => onHaptic()}
                style={{ flex: 1, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                  alignItems: "center" as const, justifyContent: "center" as const,
                  flexDirection: "row" as const, gap: 8 }}>
                {pdfLoading ? (
                  <ActivityIndicator color="rgba(255,255,255,0.75)" size="small" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={17} color="rgba(255,255,255,0.75)" />
                    <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 13 }}>PDF</Text>
                  </>
                )}
              </SpringBtn>
            )}

            {/* Mi equipo — solo cuando la planilla está completada */}
            {workout && completedSessions >= workout.sessions_goal && (
              <SpringBtn
                onPress={handleShareTeam}
                onHaptic={() => onHaptic()}
                style={{ flex: 1, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                  alignItems: "center" as const, justifyContent: "center" as const,
                  flexDirection: "row" as const, gap: 8 }}>
                {shareLoading ? (
                  <ActivityIndicator color="rgba(255,255,255,0.75)" size="small" />
                ) : (
                  <>
                    <Ionicons name="people" size={17} color="rgba(255,255,255,0.75)" />
                    <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 13 }}>Mi equipo</Text>
                  </>
                )}
              </SpringBtn>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── PDF: court SVG helper ───────────────────────────────────────────────────

function buildCourtSvgHtml(
  spots: typeof ALL_SPOTS,
  aggregateMap: Map<string, { makes: number; attempts: number }>,
): string {
  const W = 240, H = 256;
  const L = 10, R = 230, T = 8, B = 246;
  const cW = R - L, cH = B - T;          // 220 × 238
  const rimX = L + cW * 0.5;             // 120
  const rimY = T + cH * 0.11;            // ~34.2
  const keyW = cW * 0.40;                // 88
  const keyH = cH * 0.36;               // ~85.7
  const keyX = rimX - keyW / 2;          // 76
  const keyY = T;                        // 8
  const ftY  = keyY + keyH;             // ~93.7
  const ftR  = keyW * 0.30;             // 26.4
  const cXL  = L  + cW * 0.12;          // ~36.4
  const cXR  = R  - cW * 0.12;          // ~203.6
  const tR   = cW * 0.382;              // ~84.0
  const dxC  = rimX - cXL;
  const cbY  = rimY + Math.sqrt(Math.max(tR * tR - dxC * dxC, 0));

  function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function toAngle(cx: number, cy: number, x: number, y: number) {
    return (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
  }
  function arc(cx: number, cy: number, r: number, sa: number, ea: number, cw = true): string {
    const [sx, sy] = polar(cx, cy, r, ea);
    const [ex, ey] = polar(cx, cy, r, sa);
    const ns = ((sa % 360) + 360) % 360, ne = ((ea % 360) + 360) % 360;
    const delta = cw ? (ne - ns + 360) % 360 : (ns - ne + 360) % 360;
    const large = delta > 180 ? 1 : 0;
    return `M${sx.toFixed(1)},${sy.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${large} ${cw ? 1 : 0} ${ex.toFixed(1)},${ey.toFixed(1)}`;
  }

  const sa3    = toAngle(rimX, rimY, cXL, cbY);
  const ea3    = toAngle(rimX, rimY, cXR, cbY);
  const ftArc  = arc(rimX, ftY, ftR, 270, 90, true);
  const threeA = arc(rimX, rimY, tR, sa3, ea3, true);
  const bk1 = rimX - keyW * 0.20, bk2 = rimX + keyW * 0.20;
  const rimLine = rimY - 12;

  function spotColor(p: number) {
    return p >= 0.65 ? "#22C55E" : p >= 0.40 ? "#F59E0B" : "#EF4444";
  }

  const spotSvg = spots.map((s) => {
    const cx = (L + s.x * cW).toFixed(1);
    const cyN = T + s.y * cH;
    const cy  = cyN.toFixed(1);
    const agg = aggregateMap.get(s.id);
    const hasPct = !!agg && agg.attempts > 0;
    const pct  = hasPct ? agg!.makes / agg!.attempts : 0;
    const color = hasPct ? spotColor(pct) : "#94a3b8";
    const opacity = hasPct ? "0.30" : "0.12";
    return [
      `<circle cx="${cx}" cy="${cy}" r="12" fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-width="1.8"/>`,
      `<text x="${cx}" y="${(cyN + 4).toFixed(1)}" text-anchor="middle" fill="${color}" font-size="9" font-weight="800" font-family="-apple-system,sans-serif">${s.label}</text>`,
    ].join("");
  }).join("\n  ");

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
  <rect x="${L}" y="${T}" width="${cW}" height="${cH}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" rx="8"/>
  <rect x="${keyX.toFixed(1)}" y="${keyY}" width="${keyW.toFixed(1)}" height="${keyH.toFixed(1)}" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1.2"/>
  <line x1="${keyX.toFixed(1)}" y1="${ftY.toFixed(1)}" x2="${(keyX+keyW).toFixed(1)}" y2="${ftY.toFixed(1)}" stroke="#e2e8f0" stroke-width="1.2"/>
  <path d="${ftArc}" fill="none" stroke="#e2e8f0" stroke-width="1.2"/>
  <line x1="${bk1.toFixed(1)}" y1="${rimLine.toFixed(1)}" x2="${bk2.toFixed(1)}" y2="${rimLine.toFixed(1)}" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="${rimX.toFixed(1)}" cy="${rimY.toFixed(1)}" r="5" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="${cXL.toFixed(1)}" y1="${T}" x2="${cXL.toFixed(1)}" y2="${cbY.toFixed(1)}" stroke="#F59E0B" stroke-opacity="0.45" stroke-width="1.2"/>
  <line x1="${cXR.toFixed(1)}" y1="${T}" x2="${cXR.toFixed(1)}" y2="${cbY.toFixed(1)}" stroke="#F59E0B" stroke-opacity="0.45" stroke-width="1.2"/>
  <path d="${threeA}" fill="none" stroke="#F59E0B" stroke-opacity="0.45" stroke-width="1.2"/>
  ${spotSvg}
</svg>`;
}

// ─── PDF: workout grid ────────────────────────────────────────────────────────

function generateWorkoutHtml({
  workout,
  orderedSessions,
  spotOrder,
  spotMetaByKey,
}: {
  workout: WorkoutData;
  orderedSessions: PdfSessionRow[];
  spotOrder: string[];
  spotMetaByKey: Map<string, { label: string } | undefined>;
}): string {
  const date = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  // Aggregate per spot across all sessions
  const aggMap = new Map<string, { makes: number; attempts: number }>();
  orderedSessions.forEach((sess) =>
    sess.spotRows.forEach((sp) => {
      const a = aggMap.get(sp.spot_key) ?? { makes: 0, attempts: 0 };
      a.makes += sp.makes; a.attempts += sp.attempts;
      aggMap.set(sp.spot_key, a);
    })
  );

  let totalMakes = 0, totalAttempts = 0;
  aggMap.forEach((a) => { totalMakes += a.makes; totalAttempts += a.attempts; });
  const overallPct = totalAttempts > 0 ? Math.round(totalMakes / totalAttempts * 100) : 0;
  const overallColor = overallPct >= 65 ? "#16a34a" : overallPct >= 40 ? "#d97706" : "#dc2626";

  // Spots filtered to only those in this workout, in order
  const spotsFiltered = ALL_SPOTS.filter((s) => spotOrder.includes(s.id))
    .sort((a, b) => spotOrder.indexOf(a.id) - spotOrder.indexOf(b.id));

  const courtSvg = buildCourtSvgHtml(spotsFiltered, aggMap);

  function cellColor(p: number) {
    return p >= 0.65 ? "#16a34a" : p >= 0.40 ? "#d97706" : "#dc2626";
  }

  // Column headers: sequential number with full label as tooltip
  const spotHeaders = spotOrder.map((key, i) => {
    const spot = ALL_SPOTS.find((s) => s.id === key);
    const tip = spotMetaByKey.get(key)?.label ?? key;
    const shortType = spot?.shotType === "3PT" ? "3" : "2";
    return `<th title="${tip}">${shortType}·${spot?.label ?? i + 1}</th>`;
  }).join("");

  // Table body: one row per session
  const tableRows = orderedSessions.map((sess) => {
    const spotMap = new Map(sess.spotRows.map((sp) => [sp.spot_key, sp]));
    let sessMakes = 0, sessAttempts = 0, sessTarget = 0;
    spotOrder.forEach((k) => {
      const sp = spotMap.get(k);
      if (sp) { sessMakes += sp.makes; sessAttempts += sp.attempts; sessTarget += sp.target_attempts; }
    });
    const sessPct = sessAttempts > 0 ? sessMakes / sessAttempts : 0;
  const spotCells = spotOrder.map((k) => {
      const sp = spotMap.get(k);
      if (!sp || sp.attempts === 0) return `<td class="spot-cell" style="color:#94a3b8">—</td>`;
      const p = sp.makes / sp.attempts;
      const color = cellColor(p);
      return `<td class="spot-cell">
        <span class="sub">${sp.makes}/${sp.target_attempts}</span><br/>
        <span class="pct" style="color:${color}">${Math.round(p * 100)}%</span>
      </td>`;
    }).join("");
    const totalPctStr = sessAttempts > 0 ? `${Math.round(sessPct * 100)}%` : "—";
    const totalCell = `<td class="total-col">
      <span class="sub">${sessMakes}/${sessTarget}</span><br/>
      <span class="pct" style="color:${cellColor(sessPct)}">${totalPctStr}</span>
    </td>`;
    return `<tr>
      <td class="row-head">S${sess.session_number}</td>
      ${spotCells}
      ${totalCell}
    </tr>`;
  }).join("");

  // Footer total row
  const footerSpotCells = spotOrder.map((k) => {
    const a = aggMap.get(k);
    if (!a || a.attempts === 0) return `<td class="spot-cell footer-cell">—</td>`;
    const p = a.makes / a.attempts;
    return `<td class="spot-cell footer-cell">
      <span class="sub">${a.makes}/${a.attempts}</span><br/>
      <span class="pct" style="color:${cellColor(p)}">${Math.round(p * 100)}%</span>
    </td>`;
  }).join("");
  const footerTotalCell = `<td class="total-col footer-cell" style="background:#f0fdf4">
    <span class="sub">${totalMakes}/${totalAttempts}</span><br/>
    <span style="font-size:11px;font-weight:900;color:${overallColor}">${overallPct}%</span>
  </td>`;
  const footerRow = `<tr class="footer-row">
    <td class="row-head" style="color:#0f172a">TOTAL</td>
    ${footerSpotCells}
    ${footerTotalCell}
  </tr>`;

  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <title>ShotTracker — ${workout.title}</title>
  <style>
    @page{size:A4 landscape;margin:14mm 12mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#1e293b;font-size:10px}
    .page{width:100%;padding:0}
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
    .brand{font-size:11px;font-weight:900;letter-spacing:3px;color:#64748b;text-transform:uppercase}
    .date{font-size:10px;color:#94a3b8}
    .badge{display:inline-block;background:#dcfce7;color:#16a34a;font-weight:700;font-size:10px;padding:2px 8px;border-radius:20px;margin-bottom:6px}
    .title{font-size:17px;font-weight:900;color:#0f172a;letter-spacing:-.4px;margin-bottom:2px}
    .subtitle{font-size:10px;color:#64748b;margin-bottom:10px}
    .two-col{display:flex;gap:14px;align-items:flex-start;margin-bottom:12px}
    .stats-col{flex:1}
    .stats-row{display:flex;gap:8px}
    .stat-card{flex:1;padding:8px;border-radius:8px;background:#f8fafc;border:1.5px solid #e2e8f0;text-align:center}
    .stat-label{font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:.4px;text-transform:uppercase;margin-bottom:2px}
    .stat-value{font-size:17px;font-weight:900;color:#0f172a}
    .court-col{flex-shrink:0}
    .section-title{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
    .legend{display:flex;gap:10px;margin-bottom:8px;align-items:center}
    .legend-item{display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b}
    .legend-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
    table{border-collapse:collapse;background:white;border:1.5px solid #e2e8f0;width:100%;table-layout:fixed}
    thead tr{background:#f1f5f9}
    th{padding:4px 3px;text-align:center;font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:1.5px solid #e2e8f0;white-space:nowrap;overflow:hidden}
    th:first-child{text-align:left;padding-left:6px;width:28px}
    td{padding:4px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:center;overflow:hidden}
    td:first-child{padding-left:6px}
    tr:last-child td{border-bottom:none}
    .spot-cell{text-align:center;line-height:1.35}
    .total-col{text-align:center;background:#f8fafc;border-left:1.5px solid #e2e8f0;line-height:1.35;width:42px}
    .row-head{font-weight:700;color:#1e293b;white-space:nowrap;text-align:left;font-size:9px}
    .sub{font-size:8px;color:#64748b;font-weight:600;display:block}
    .pct{font-size:10px;font-weight:900;display:block}
    .footer-cell{background:#f8fafc}
    .footer-row{border-top:2px solid #e2e8f0}
    .footer{text-align:center;font-size:9px;color:#94a3b8;padding-top:8px;margin-top:10px;border-top:1px solid #e2e8f0}
  </style>
</head><body>
  <div class="page">
    <div class="header"><span class="brand">ShotTracker</span><span class="date">${date}</span></div>
    <div class="badge">Planilla completada · ${workout.sessions_goal} sesiones</div>
    <div class="title">${workout.title}</div>
    <div class="subtitle">${workout.shot_type} · ${workout.sessions_goal} sesiones · ${date}</div>
    <div class="two-col">
      <div class="stats-col">
        <div class="section-title" style="margin-bottom:6px">Resumen global</div>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-label">Metidos</div><div class="stat-value">${totalMakes}</div></div>
          <div class="stat-card"><div class="stat-label">Intentos</div><div class="stat-value">${totalAttempts}</div></div>
          <div class="stat-card"><div class="stat-label">Promedio</div><div class="stat-value" style="color:${overallColor}">${overallPct}%</div></div>
        </div>
        <div style="margin-top:10px">
          <div class="section-title">Referencias de color</div>
          <div class="legend">
            <div class="legend-item"><span class="legend-dot" style="background:#22C55E"></span>&ge;65% bueno</div>
            <div class="legend-item"><span class="legend-dot" style="background:#F59E0B"></span>40–64% regular</div>
            <div class="legend-item"><span class="legend-dot" style="background:#EF4444"></span>&lt;40% a mejorar</div>
          </div>
        </div>
      </div>
      <div class="court-col">
        <div class="section-title">Mapa de spots — color = % promedio global</div>
        ${courtSvg}
      </div>
    </div>
    <div class="section-title">Cuadrícula: sesión (filas) × spot (columnas)</div>
    <table>
      <thead><tr><th>Ses.</th>${spotHeaders}<th style="border-left:1.5px solid #e2e8f0;width:42px">Total</th></tr></thead>
      <tbody>${tableRows}${footerRow}</tbody>
    </table>
    <div class="footer">Generado con ShotTracker · ${date} · cabeceras: tipo·número (3=3PT, 2=2PT)</div>
  </div>
</body></html>`;
}

// ─── PDF: free session ────────────────────────────────────────────────────────

function generateFreeSessionHtml({
  rows,
  stats,
  spotMetaByKey,
}: {
  rows: SessionSpotRow[];
  stats: { totalMakes: number; totalAttempts: number; pct: number };
  spotMetaByKey: Map<string, { label: string } | undefined>;
}): string {
  const date = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const pct = Math.round(stats.pct * 100);
  const pctColor = pct >= 65 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";

  const spotsRows = rows
    .slice()
    .sort((a, b) => (b.attempts > 0 ? b.makes / b.attempts : 0) - (a.attempts > 0 ? a.makes / a.attempts : 0))
    .map((r) => {
      const label = spotMetaByKey.get(r.spot_key)?.label ?? r.spot_key;
      const p = r.attempts > 0 ? Math.round((r.makes / r.attempts) * 100) : 0;
      const barColor = p >= 65 ? "#22C55E" : p >= 40 ? "#F59E0B" : "#EF4444";
      return `<tr>
        <td>${label}</td>
        <td style="color:#64748b">${r.shot_type}</td>
        <td style="text-align:center;font-weight:700">${r.makes}</td>
        <td style="text-align:center;font-weight:700">${r.attempts}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:8px;border-radius:4px;background:#e5e7eb;overflow:hidden">
              <div style="width:${p}%;height:100%;background:${barColor};border-radius:4px"></div>
            </div>
            <span style="font-weight:700;color:${barColor};min-width:36px;text-align:right">${p}%</span>
          </div>
        </td>
      </tr>`;
    }).join("");

  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <title>ShotTracker — Sesión libre</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b}
    .page{max-width:700px;margin:0 auto;padding:32px 24px}
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:18px;border-bottom:2px solid #e2e8f0}
    .brand{font-size:13px;font-weight:900;letter-spacing:3px;color:#64748b;text-transform:uppercase}
    .date{font-size:12px;color:#94a3b8}
    .title{font-size:26px;font-weight:900;color:#0f172a;letter-spacing:-.5px;margin-bottom:4px}
    .subtitle{font-size:14px;color:#64748b;margin-bottom:24px}
    .stats-row{display:flex;gap:14px;margin-bottom:24px}
    .stat-card{flex:1;padding:14px;border-radius:12px;background:white;border:1.5px solid #e2e8f0;text-align:center}
    .stat-label{font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px}
    .stat-value{font-size:26px;font-weight:900;color:#0f172a}
    .section-title{font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
    table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;border:1.5px solid #e2e8f0;margin-bottom:24px}
    thead tr{background:#f8fafc}
    th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #e2e8f0}
    td{padding:11px 14px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9}
    tr:last-child td{border-bottom:none}
    .footer{text-align:center;font-size:11px;color:#94a3b8;padding-top:16px;border-top:1px solid #e2e8f0}
  </style>
</head><body>
  <div class="page">
    <div class="header"><span class="brand">ShotTracker</span><span class="date">${date}</span></div>
    <div class="title">Sesión libre</div>
    <div class="subtitle">Análisis de tiros · ${date}</div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Metidos</div><div class="stat-value">${stats.totalMakes}</div></div>
      <div class="stat-card"><div class="stat-label">Intentos</div><div class="stat-value">${stats.totalAttempts}</div></div>
      <div class="stat-card"><div class="stat-label">Promedio</div><div class="stat-value" style="color:${pctColor}">${pct}%</div></div>
    </div>
    <div class="section-title">Rendimiento por spot</div>
    <table>
      <thead><tr><th>Spot</th><th>Tipo</th><th style="text-align:center">Met.</th><th style="text-align:center">Int.</th><th>%</th></tr></thead>
      <tbody>${spotsRows}</tbody>
    </table>
    <div class="footer">Generado con ShotTracker · ${date}</div>
  </div>
</body></html>`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SpringBtn({
  children, onPress, onHaptic, style,
}: {
  children: React.ReactNode; onPress: () => void; onHaptic?: () => void; style?: object;
}) {
  const { scale, onIn, onOut } = usePressScale();
  const defaultStyle = {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center" as const, justifyContent: "center" as const,
  };
  return (
    <Animated.View style={[style ?? defaultStyle, { transform: [{ scale }] }]}>
      <Pressable
        onPressIn={onIn} onPressOut={onOut}
        onPress={() => { onHaptic?.(); onPress(); }}
        style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, flex: 1, width: "100%" }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function SegBtn({ active, text, icon, onPress }: {
  active: boolean; text: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void;
}) {
  const { scale, onIn, onOut } = usePressScale();
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable onPressIn={onIn} onPressOut={onOut} onPress={onPress}
        style={{
          height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center",
          flexDirection: "row", gap: 8,
          backgroundColor: active ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.06)",
          borderWidth: 1.5, borderColor: active ? "rgba(245,158,11,0.52)" : "rgba(255,255,255,0.12)",
        }}>
        <Ionicons name={icon} size={18} color={active ? "#F59E0B" : "rgba(255,255,255,0.55)"} />
        <Text style={{ color: active ? "#F59E0B" : "rgba(255,255,255,0.80)", fontWeight: "900" }}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

function AnimatedStatPill({ title, target, delay = 0, suffix = "" }: {
  title: string; target: number; delay?: number; suffix?: string;
}) {
  const slide = useFadeSlide(delay);
  const count = useCountUp(target, delay);
  const displayText = count.interpolate({
    inputRange: [0, Math.max(target, 1)],
    outputRange: ["0", `${target}`],
    extrapolate: "clamp",
  });
  return (
    <Animated.View style={[{
      flex: 1, padding: 14, borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", gap: 6,
    }, slide]}>
      <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, letterSpacing: 0.5 }}>{title}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
        <Animated.Text style={{ color: "white", fontWeight: "900", fontSize: 22 }}>
          {displayText as any}
        </Animated.Text>
        {suffix ? <Text style={{ color: "rgba(255,255,255,0.65)", fontWeight: "900", fontSize: 14 }}>{suffix}</Text> : null}
      </View>
    </Animated.View>
  );
}

function AnimatedBar({ value, color }: { value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, { toValue: value, useNativeDriver: false, speed: 3, bounciness: 5 }).start();
  }, [value]);
  return (
    <View style={{
      height: 13, borderRadius: 999, overflow: "hidden",
      backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    }}>
      <Animated.View style={{
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
        height: "100%", backgroundColor: color, borderRadius: 999,
      }} />
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{
      flex: 1, padding: 10, borderRadius: 12, gap: 4, alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    }}>
      <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 10, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{value}</Text>
    </View>
  );
}



function ListSpotRow({ rank, label, makes, attempts, shotType, pct, color, selected, delay, onPress }: {
  rank: number; label: string; makes: number; attempts: number;
  shotType: string; pct: number; color: string; selected: boolean; delay: number; onPress: () => void;
}) {
  const entrance = useFadeSlide(delay);
  const { scale, onIn, onOut } = usePressScale();
  return (
    <Animated.View style={entrance}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable onPressIn={onIn} onPressOut={onOut} onPress={onPress}
          style={{
            padding: 14, borderRadius: 18, gap: 10,
            backgroundColor: selected ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
            borderWidth: 1.5, borderColor: selected ? color : "rgba(255,255,255,0.09)",
          }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={{
                width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center",
                backgroundColor: `${color}1A`, borderWidth: 1, borderColor: `${color}44`,
              }}>
                <Text style={{ color, fontWeight: "900", fontSize: 12 }}>#{rank}</Text>
              </View>
              <Text style={{ color: "white", fontWeight: "900", flex: 1, fontSize: 14 }} numberOfLines={1}>{label}</Text>
            </View>
            <Text style={{ color, fontWeight: "900", fontSize: 20 }}>{Math.round(pct * 100)}%</Text>
          </View>
          <AnimatedBar value={pct} color={color} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{makes}/{attempts} tiros · {shotType}</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.22)" />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function InsightRow({ title, value, color, icon, hint, pulse = false }: {
  title: string; value: string; color: string;
  icon: keyof typeof Ionicons.glyphMap; hint?: string; pulse?: boolean;
}) {
  const pulseScale = usePulse(pulse);
  return (
    <View style={{
      padding: 12, borderRadius: 16, gap: 8,
      backgroundColor: "rgba(0,0,0,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <Ionicons name={icon} size={16} color="rgba(255,255,255,0.70)" />
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, letterSpacing: 0.3 }}>{title}</Text>
        </View>
        <Animated.View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: color, transform: [{ scale: pulseScale }] }} />
      </View>
      <Text style={{ color: "white", fontWeight: "900", fontSize: 14 }} numberOfLines={2}>{value}</Text>
      {hint ? <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11 }}>{hint}</Text> : null}
    </View>
  );
}

// ─── HeatCourt ───────────────────────────────────────────────────────────────

type SpotData = { pct: number; makes: number; attempts: number; spot_key: string };

function HeatCourt({
  width,
  height,
  spots,
  spotDataMap,
  selectedSpotKey,
  onSelectSpot,
}: {
  width: number;
  height: number;
  spots: typeof import("@/src/data/spots").ALL_SPOTS;
  spotDataMap: Map<string, SpotData>;
  selectedSpotKey: string | null;
  onSelectSpot: (key: string) => void;
}) {
  const padX      = Math.max(width * 0.04, 18);
  const padTop    = height * 0.03;
  const padBottom = height * 0.04;
  const left      = padX;
  const right     = width - padX;
  const top       = padTop;
  const bottom    = height - padBottom;
  const courtW    = right - left;
  const courtH    = bottom - top;

  const rimX = left + courtW * 0.5;
  const rimY = top  + courtH * 0.11;

  const keyW = courtW * 0.40;
  const keyH = courtH * 0.36;
  const keyX = rimX - keyW / 2;
  const keyY = top;
  const ftY  = keyY + keyH;
  const ftArcR = keyW * 0.30;

  const cornerXLeft  = left  + courtW * 0.12;
  const cornerXRight = right - courtW * 0.12;
  const threeArcR    = courtW * 0.382;
  const dxCorner     = Math.abs(rimX - cornerXLeft);
  const cornerBreakY = Math.min(
    rimY + Math.sqrt(Math.max(threeArcR * threeArcR - dxCorner * dxCorner, 0)),
    bottom - courtH * 0.02,
  );
  const threeStartAngle = hcCartesianToAngle(rimX, rimY, cornerXLeft,  cornerBreakY);
  const threeEndAngle   = hcCartesianToAngle(rimX, rimY, cornerXRight, cornerBreakY);

  const R_GLOW = 32;
  const R_DOT  = 20;
  const R_SEL  = 28;

  return (
    <View style={{ width, height, borderRadius: 18, overflow: "hidden",
      backgroundColor: "rgba(0,0,0,0.30)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" }}>
      <Svg width={width} height={height} style={{ overflow: "hidden" }}>
        <Defs>
          {spots.map((s) => {
            const data = spotDataMap.get(s.id);
            const c    = data ? heatColor(data.pct) : "rgba(255,255,255,0.1)";
            return (
              <RadialGradient key={`grad-${s.id}`} id={`grad-${s.id}`}
                cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%"   stopColor={c} stopOpacity={0.55} />
                <Stop offset="60%"  stopColor={c} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={c} stopOpacity={0}    />
              </RadialGradient>
            );
          })}
        </Defs>

        {/* Court background */}
        <Rect x="0" y="0" width={width} height={height} fill="rgba(0,0,0,0.0)" />

        {/* Half-court border */}
        <Rect x={left} y={top} width={courtW} height={courtH}
          fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1.5} rx={10} />

        {/* Key */}
        <Rect x={keyX} y={keyY} width={keyW} height={keyH}
          fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />

        {/* Free-throw line */}
        <Line x1={keyX} y1={ftY} x2={keyX + keyW} y2={ftY}
          stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />

        {/* Free-throw arc */}
        <Path d={hcDescribeArc(rimX, ftY, ftArcR, 270, 90, true)}
          fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={1.5} />

        {/* Backboard */}
        <Line x1={rimX - keyW * 0.20} y1={rimY - 12} x2={rimX + keyW * 0.20} y2={rimY - 12}
          stroke="rgba(255,255,255,0.22)" strokeWidth={2.5} />

        {/* Rim */}
        <Circle cx={rimX} cy={rimY} r={7}
          fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth={2} />

        {/* 3PT corner lines */}
        <Line x1={cornerXLeft}  y1={top} x2={cornerXLeft}  y2={cornerBreakY}
          stroke="rgba(245,158,11,0.28)" strokeWidth={1.5} />
        <Line x1={cornerXRight} y1={top} x2={cornerXRight} y2={cornerBreakY}
          stroke="rgba(245,158,11,0.28)" strokeWidth={1.5} />

        {/* 3PT arc */}
        <Path d={hcDescribeArc(rimX, rimY, threeArcR, threeStartAngle, threeEndAngle, true)}
          fill="none" stroke="rgba(245,158,11,0.28)" strokeWidth={1.5} />

        {/* ── Spots ──────────────────────────────────────────────────────── */}
        {spots.map((s) => {
          const cx   = left + s.x * courtW;
          const cy   = top  + s.y * courtH;
          const data = spotDataMap.get(s.id);
          const pct  = data?.pct ?? 0;
          const c    = data ? heatColor(pct) : "rgba(255,255,255,0.18)";
          const isSel = selectedSpotKey === s.id;
          const hasData = !!data;
          const pctStr = hasData ? `${Math.round(pct * 100)}%` : "—";

          return (
            <React.Fragment key={s.id}>
              {/* Glow halo */}
              {hasData && (
                <Circle cx={cx} cy={cy} r={R_GLOW}
                  fill={`url(#grad-${s.id})`} />
              )}

              {/* Selection ring */}
              {isSel && (
                <>
                  <Circle cx={cx} cy={cy} r={R_SEL + 6}
                    fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} strokeDasharray="4 3" />
                  <Circle cx={cx} cy={cy} r={R_SEL}
                    fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
                </>
              )}

              {/* Main dot */}
              <Circle cx={cx} cy={cy} r={isSel ? R_SEL - 4 : R_DOT}
                fill={hasData ? c : "rgba(255,255,255,0.08)"}
                fillOpacity={hasData ? (isSel ? 1 : 0.82) : 0.4}
                stroke={isSel ? "white" : c}
                strokeWidth={isSel ? 2 : 1.5}
                strokeOpacity={hasData ? 1 : 0.3}
                onPress={() => onSelectSpot(s.id)}
              />

              {/* % label */}
              <SvgText
                x={cx} y={cy + (isSel ? 5 : 4)}
                fontSize={isSel ? "13" : "11"}
                fontWeight="800"
                fill={isSel ? "#0B1220" : "rgba(255,255,255,0.92)"}
                textAnchor="middle"
                onPress={() => onSelectSpot(s.id)}
              >
                {pctStr}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

// HeatCourt geometry helpers
function hcPolarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function hcCartesianToAngle(cx: number, cy: number, x: number, y: number) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
}
function hcDescribeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, clockwise = false) {
  const start = hcPolarToCartesian(cx, cy, r, endAngle);
  const end   = hcPolarToCartesian(cx, cy, r, startAngle);
  const normalizedStart = ((startAngle % 360) + 360) % 360;
  const normalizedEnd   = ((endAngle   % 360) + 360) % 360;
  const delta = clockwise
    ? (normalizedEnd - normalizedStart + 360) % 360
    : (normalizedStart - normalizedEnd + 360) % 360;
  const largeArc = delta > 180 ? "1" : "0";
  const sweep    = clockwise   ? "1" : "0";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card = {
  padding: 16, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;
