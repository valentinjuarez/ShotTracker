// app/session/summary.tsx
import { ALL_SPOTS } from "@/src/data/spots";
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SessionSummary() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const courtW = Math.min(width - (isSmall ? 32 : 40) - 32, 520);
  const courtH = Math.round(courtW * 1.08);

  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<SessionSpotRow[]>([]);
  const [mode, setMode] = useState<"HEAT" | "LIST">("HEAT");
  const [selectedSpotKey, setSelectedSpotKey] = useState<string | null>(null);

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
              Resumen de sesión
            </Text>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }} numberOfLines={1}>
              Análisis completo
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
          {/* Primary CTA */}
          <SpringBtn
            onPress={async () => { await onHaptic(Haptics.ImpactFeedbackStyle.Medium); router.push("/session/create"); }}
            onHaptic={() => onHaptic()}
            style={{ height: 54, borderRadius: 18, backgroundColor: "#F59E0B",
              alignItems: "center" as const, justifyContent: "center" as const, flexDirection: "row" as const, gap: 10 }}>
            <Ionicons name="refresh" size={18} color="#0B1220" />
            <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 15 }}>Nueva sesión</Text>
          </SpringBtn>

          {/* Secondary row */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {/* Home — icon only */}
            <SpringBtn
              onPress={async () => { await onHaptic(); router.replace("/"); }}
              onHaptic={() => onHaptic()}
              style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                alignItems: "center" as const, justifyContent: "center" as const }}>
              <Ionicons name="home" size={20} color="rgba(255,255,255,0.9)" />
            </SpringBtn>

            {/* Descargar PDF */}
            <SpringBtn
              onPress={async () => {
                await onHaptic();
                Alert.alert("Próximamente", "La exportación a PDF estará disponible en la próxima versión.");
              }}
              onHaptic={() => onHaptic()}
              style={{ flex: 1, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                alignItems: "center" as const, justifyContent: "center" as const,
                flexDirection: "row" as const, gap: 8 }}>
              <Ionicons name="document-text" size={17} color="rgba(255,255,255,0.75)" />
              <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 13 }}>PDF</Text>
            </SpringBtn>

            {/* Mi equipo */}
            <SpringBtn
              onPress={async () => {
                await onHaptic();
                Alert.alert("Próximamente", "La función de compartir con tu equipo estará disponible pronto.");
              }}
              onHaptic={() => onHaptic()}
              style={{ flex: 1, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                alignItems: "center" as const, justifyContent: "center" as const,
                flexDirection: "row" as const, gap: 8 }}>
              <Ionicons name="people" size={17} color="rgba(255,255,255,0.75)" />
              <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 13 }}>Mi equipo</Text>
            </SpringBtn>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
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
