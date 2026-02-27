// app/(trainer)/workouts.tsx — Shared workouts: full detail for coach
import { ALL_SPOTS } from "@/src/data/spots";
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkoutEntry = {
  shareId:      string;
  workoutId:    string;
  title:        string;
  status:       string;
  shotType:     string;
  sessionsGoal: number;
  sharedAt:     string | null;
  playerId:     string;
  playerName:   string;
};

type SessionRow = {
  id:            string;
  sessionNumber: number;
  status:        string;
  finishedAt:    string | null;
  attempts:      number;
  makes:         number;
  pct:           number | null;
  spots:         SpotAgg[];
};

type SpotAgg = {
  spotKey:  string;
  attempts: number;
  makes:    number;
  pct:      number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function heatColor(p: number) {
  const t = clamp01(p);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  let r = 0, g = 0, b = 0;
  if (t <= 0.5) {
    const k = t / 0.5;
    r = 255; g = Math.round(40 + (215 - 40) * k); b = 60;
  } else {
    const k = (t - 0.5) / 0.5;
    r = Math.round(255 + (34 - 255) * k); g = 215; b = Math.round(60 + (94 - 60) * k);
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function pctColor(p: number) {
  if (p >= 0.65) return "rgba(34,197,94,1)";
  if (p >= 0.4)  return "rgba(245,158,11,1)";
  return "rgba(239,68,68,1)";
}

function fmtShort(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

const card = {
  padding: 18, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function WorkoutsScreen() {
  const [entries, setEntries]       = useState<WorkoutEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");

  const loadData = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .eq("role", "coach")
        .maybeSingle();

      if (!membership) { setEntries([]); return; }
      const teamId = (membership as any).team_id as string;

      const { data: shared } = await supabase
        .from("team_workouts")
        .select("id, workout_id, user_id, shared_at, workout_title, workout_status, shot_type, sessions_goal")
        .eq("team_id", teamId)
        .order("shared_at", { ascending: false });

      const sharedRows = shared ?? [];

      const playerIds: string[] = [...new Set(sharedRows.map((s: any) => s.user_id as string))];
      const nameMap: Record<string, string> = {};
      if (playerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", playerIds);
        (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.display_name ?? `#${p.id.slice(0, 6)}`; });
      }

      const result: WorkoutEntry[] = sharedRows.map((s: any) => ({
        shareId:      s.id,
        workoutId:    s.workout_id,
        title:        s.workout_title    ?? "Sin título",
        status:       s.workout_status   ?? "",
        shotType:     s.shot_type        ?? "",
        sessionsGoal: s.sessions_goal    ?? 0,
        sharedAt:     s.shared_at,
        playerId:     s.user_id,
        playerName:   nameMap[s.user_id] ?? `#${s.user_id.slice(0, 6)}`,
      }));

      setEntries(result);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  const byPlayer = useMemo(() => {
    const map = new Map<string, { name: string; items: WorkoutEntry[] }>();
    entries.forEach((e) => {
      if (!map.has(e.playerId)) map.set(e.playerId, { name: e.playerName, items: [] });
      map.get(e.playerId)!.items.push(e);
    });
    return map;
  }, [entries]);

  const filteredByPlayer = useMemo(() => {
    if (!search.trim()) return byPlayer;
    const q = search.trim().toLowerCase();
    const out = new Map<string, { name: string; items: WorkoutEntry[] }>();
    byPlayer.forEach((val, key) => {
      if (val.name.toLowerCase().includes(q)) out.set(key, val);
    });
    return out;
  }, [byPlayer, search]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* ── Fixed header ─────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, letterSpacing: 0.2 }}>Control</Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>Planillas</Text>
          </View>
          {!loading && entries.length > 0 && (
            <View style={{
              paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.07)",
            }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700" }}>
                {filteredByPlayer.size} jugador{filteredByPlayer.size !== 1 ? "as" : "a"}
              </Text>
            </View>
          )}
        </View>

        {!loading && entries.length > 0 && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            height: 42, borderRadius: 13, paddingHorizontal: 12,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
          }}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.35)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar jugador..."
              placeholderTextColor="rgba(255,255,255,0.28)"
              style={{ flex: 1, color: "white", fontSize: 14, paddingVertical: 0 }}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.30)" />
              </Pressable>
            )}
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44, gap: 10 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" colors={["#F59E0B"]} />
        }
      >
        {loading ? (
          <ActivityIndicator color="#F59E0B" style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <EmptyState />
        ) : filteredByPlayer.size === 0 ? (
          <View style={[card, { alignItems: "center", paddingVertical: 36 }]}>
            <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 14 }}>Sin resultados para "{search}"</Text>
          </View>
        ) : (
          Array.from(filteredByPlayer.entries()).map(([playerId, { name, items }]) => (
            <PlayerSection key={playerId} playerName={name} workouts={items} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={[card, { alignItems: "center", gap: 14, paddingVertical: 44 }]}>
      <View style={{
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: "rgba(255,255,255,0.05)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="clipboard-outline" size={28} color="rgba(255,255,255,0.18)" />
      </View>
      <Text style={{ color: "rgba(255,255,255,0.50)", fontWeight: "700", fontSize: 15 }}>
        Sin planillas compartidas
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.28)", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
        Cuando tus jugadoras compartan planillas{"\n"}con el equipo, aparecerán acá.
      </Text>
    </View>
  );
}

// ─── Player section (collapsible) ────────────────────────────────────────────

function PlayerSection({ playerName, workouts }: { playerName: string; workouts: WorkoutEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const initial     = playerName.trim().charAt(0).toUpperCase();
  const doneCount   = workouts.filter((w) => w.status === "DONE").length;
  const activeCount = workouts.filter((w) => w.status === "ACTIVE").length;

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !expanded;
    setExpanded(next);
    Animated.spring(rotateAnim, { toValue: next ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  }

  const chevronRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <View style={{
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.045)",
      borderWidth: 1,
      borderColor: expanded ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.08)",
      overflow: "hidden",
    }}>
      {/* ── Collapsible header ─────────────────────────────────── */}
      <Pressable
        onPress={toggle}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
      >
        {/* Avatar */}
        <View style={{
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: "rgba(245,158,11,0.15)",
          borderWidth: 1.5, borderColor: "rgba(245,158,11,0.35)",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ color: "#F59E0B", fontWeight: "900", fontSize: 16 }}>{initial}</Text>
        </View>

        {/* Name + summary row */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }} numberOfLines={1}>
            {playerName}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* Status dots */}
            {workouts.map((w) => {
              const c = w.status === "DONE"
                ? "rgba(34,197,94,0.90)"
                : w.status === "ACTIVE"
                ? "rgba(245,158,11,0.90)"
                : "rgba(255,255,255,0.28)";
              return (
                <View key={w.shareId} style={{
                  flexDirection: "row", alignItems: "center", gap: 4,
                  paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
                  <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 10, fontWeight: "700" }} numberOfLines={1}>
                    {w.title.length > 14 ? w.title.slice(0, 13) + "…" : w.title}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stats pill */}
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <View style={{
            paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.07)",
          }}>
            <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, fontWeight: "700" }}>
              {workouts.length} planilla{workouts.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {doneCount > 0 && (
              <Text style={{ color: "rgba(34,197,94,0.75)", fontSize: 10, fontWeight: "700" }}>
                {doneCount} ✓
              </Text>
            )}
            {activeCount > 0 && (
              <Text style={{ color: "rgba(245,158,11,0.75)", fontSize: 10, fontWeight: "700" }}>
                {activeCount} ●
              </Text>
            )}
          </View>
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.35)" />
        </Animated.View>
      </Pressable>

      {/* ── Expanded workouts ──────────────────────────────────── */}
      {expanded && (
        <View style={{
          borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
          padding: 12, gap: 10,
        }}>
          {workouts.map((w) => (
            <WorkoutDetailCard key={w.shareId} entry={w} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Workout detail card ──────────────────────────────────────────────────────

function WorkoutDetailCard({ entry }: { entry: WorkoutEntry }) {
  const [expanded, setExpanded]       = useState(false);
  const [sessions, setSessions]       = useState<SessionRow[]>([]);
  const [spotAgg, setSpotAgg]         = useState<SpotAgg[]>([]);
  const [loadingSess, setLoadingSess] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const isDone   = entry.status === "DONE";
  const isActive = entry.status === "ACTIVE";

  async function loadSessions() {
    if (sessions.length > 0) return;
    try {
      setLoadingSess(true);
      const { data: sessList } = await supabase
        .from("sessions")
        .select("id, session_number, status, finished_at")
        .eq("workout_id", entry.workoutId)
        .order("session_number", { ascending: true });

      const rows = (sessList ?? []) as any[];
      const sessionIds = rows.map((r) => r.id);
      let spotsRaw: any[] = [];
      if (sessionIds.length > 0) {
        const { data: sp } = await supabase
          .from("session_spots")
          .select("session_id, spot_key, attempts, makes")
          .in("session_id", sessionIds);
        spotsRaw = sp ?? [];
      }

      const sessAgg: Record<string, { att: number; mk: number }> = {};
      spotsRaw.forEach((s) => {
        if (!sessAgg[s.session_id]) sessAgg[s.session_id] = { att: 0, mk: 0 };
        sessAgg[s.session_id].att += s.attempts ?? 0;
        sessAgg[s.session_id].mk  += s.makes    ?? 0;
      });

      // Per-session spot aggregates
      const spotsBySession: Record<string, Record<string, { att: number; mk: number }>> = {};
      spotsRaw.forEach((s) => {
        if (!spotsBySession[s.session_id]) spotsBySession[s.session_id] = {};
        if (!spotsBySession[s.session_id][s.spot_key]) spotsBySession[s.session_id][s.spot_key] = { att: 0, mk: 0 };
        spotsBySession[s.session_id][s.spot_key].att += s.attempts ?? 0;
        spotsBySession[s.session_id][s.spot_key].mk  += s.makes    ?? 0;
      });

      const builtRows: SessionRow[] = rows.map((r) => {
        const a = sessAgg[r.id] ?? { att: 0, mk: 0 };
        const sessSpots = Object.entries(spotsBySession[r.id] ?? {}).map(([key, v]) => ({
          spotKey: key, attempts: v.att, makes: v.mk, pct: v.att > 0 ? v.mk / v.att : 0,
        }));
        return {
          id:            r.id,
          sessionNumber: r.session_number,
          status:        r.status,
          finishedAt:    r.finished_at ?? null,
          attempts:      a.att,
          makes:         a.mk,
          pct:           a.att > 0 ? a.mk / a.att : null,
          spots:         sessSpots,
        };
      });
      setSessions(builtRows);

      const spotMap: Record<string, { att: number; mk: number }> = {};
      spotsRaw.forEach((s) => {
        if (!spotMap[s.spot_key]) spotMap[s.spot_key] = { att: 0, mk: 0 };
        spotMap[s.spot_key].att += s.attempts ?? 0;
        spotMap[s.spot_key].mk  += s.makes    ?? 0;
      });
      setSpotAgg(Object.entries(spotMap).map(([key, v]) => ({
        spotKey: key, attempts: v.att, makes: v.mk, pct: v.att > 0 ? v.mk / v.att : 0,
      })));
    } finally {
      setLoadingSess(false);
    }
  }

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !expanded;
    setExpanded(next);
    Animated.spring(rotateAnim, { toValue: next ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
    if (next) loadSessions();
  }

  const totalAtt     = sessions.reduce((a, s) => a + s.attempts, 0);
  const totalMk      = sessions.reduce((a, s) => a + s.makes,    0);
  const overallPct   = totalAtt > 0 ? totalMk / totalAtt : null;
  const sessCompleted = sessions.filter((s) => s.status === "DONE").length;
  const chevronRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <View style={[card, { padding: 0, overflow: "hidden" }]}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <Pressable onPress={toggle} style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 13,
            backgroundColor: isDone ? "rgba(34,197,94,0.12)" : isActive ? "rgba(245,158,11,0.12)" : "rgba(99,179,237,0.12)",
            borderWidth: 1,
            borderColor: isDone ? "rgba(34,197,94,0.28)" : isActive ? "rgba(245,158,11,0.28)" : "rgba(99,179,237,0.22)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons
              name={isDone ? "checkmark-done-outline" : "clipboard-outline"}
              size={20}
              color={isDone ? "rgba(34,197,94,0.80)" : isActive ? "rgba(245,158,11,0.80)" : "rgba(99,179,237,0.70)"}
            />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }} numberOfLines={1}>
              {entry.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <StatusBadge status={entry.status} />
              {entry.shotType ? (
                <View style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "700" }}>{entry.shotType}</Text>
                </View>
              ) : null}
              {entry.sharedAt ? (
                <Text style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>· {fmtShort(entry.sharedAt)}</Text>
              ) : null}
            </View>
          </View>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.35)" />
          </Animated.View>
        </View>
        <SessionProgressBar
          sessionsGoal={entry.sessionsGoal}
          sessCompleted={expanded ? sessCompleted : null}
        />
      </Pressable>

      {/* ── Expanded body ───────────────────────────────────────────── */}
      {expanded && (
        <View style={{
          borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
          paddingHorizontal: 16, paddingBottom: 16, paddingTop: 14, gap: 14,
        }}>
          {loadingSess ? (
            <ActivityIndicator color="#F59E0B" style={{ alignSelf: "flex-start" }} />
          ) : (
            <>
              {totalAtt > 0 && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <StatChip label="Tiros"    value={`${totalAtt}`} />
                  <StatChip label="Metidos"  value={`${totalMk}`} />
                  <StatChip
                    label="Promedio"
                    value={overallPct !== null ? `${Math.round(overallPct * 100)}%` : "—"}
                    color={overallPct !== null ? pctColor(overallPct) : undefined}
                  />
                  <StatChip label="Sesiones" value={`${sessCompleted}/${entry.sessionsGoal}`} />
                </View>
              )}

              {spotAgg.length > 0 && (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowHeatmap(true); }}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                    height: 46, borderRadius: 14,
                    backgroundColor: "rgba(245,158,11,0.10)",
                    borderWidth: 1, borderColor: "rgba(245,158,11,0.28)",
                  }}
                >
                  <Ionicons name="flame-outline" size={18} color="rgba(245,158,11,0.90)" />
                  <Text style={{ color: "rgba(245,158,11,0.90)", fontWeight: "800", fontSize: 14 }}>
                    Ver mapa de calor
                  </Text>
                </Pressable>
              )}

              {sessions.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    Sesiones · {sessions.length}
                  </Text>
                  {sessions.map((s) => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      onViewHeat={s.spots.length > 0 ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveSession(s); } : undefined}
                    />
                  ))}
                </View>
              ) : (
                <Text style={{ color: "rgba(255,255,255,0.30)", fontSize: 13 }}>
                  No hay sesiones registradas aún.
                </Text>
              )}
            </>
          )}
        </View>
      )}

      {showHeatmap && (
        <HeatmapModal
          title={entry.title}
          playerName={entry.playerName}
          spotAgg={spotAgg}
          onClose={() => setShowHeatmap(false)}
        />
      )}

      {activeSession && (
        <HeatmapModal
          title={`Sesión ${activeSession.sessionNumber} — ${entry.title}`}
          playerName={entry.playerName}
          spotAgg={activeSession.spots}
          sessionInfo={activeSession}
          onClose={() => setActiveSession(null)}
        />
      )}
    </View>
  );
}

// ─── Sessions progress bar ────────────────────────────────────────────────────

function SessionProgressBar({ sessionsGoal, sessCompleted }: { sessionsGoal: number; sessCompleted: number | null }) {
  const pct = sessCompleted !== null && sessionsGoal > 0 ? Math.min(sessCompleted / sessionsGoal, 1) : null;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>Progreso</Text>
        <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>
          {sessCompleted !== null ? `${sessCompleted} de ${sessionsGoal} sesiones` : `Meta: ${sessionsGoal} sesiones`}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" }}>
        {pct !== null && (
          <View style={{
            width: `${Math.round(pct * 100)}%`, height: "100%", borderRadius: 999,
            backgroundColor: pct >= 1 ? "rgba(34,197,94,0.80)" : "rgba(245,158,11,0.80)",
          }} />
        )}
      </View>
    </View>
  );
}

// ─── Session item ─────────────────────────────────────────────────────────────

function SessionItem({ session, onViewHeat }: { session: SessionRow; onViewHeat?: () => void }) {
  const isDone = session.status === "DONE";
  return (
    <View style={{
      borderRadius: 13,
      backgroundColor: "rgba(255,255,255,0.03)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
      overflow: "hidden",
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 11 }}>
        <View style={{
          width: 32, height: 32, borderRadius: 10,
          backgroundColor: isDone ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.08)",
          borderWidth: 1, borderColor: isDone ? "rgba(34,197,94,0.22)" : "rgba(245,158,11,0.18)",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ color: isDone ? "rgba(34,197,94,0.80)" : "rgba(245,158,11,0.70)", fontWeight: "900", fontSize: 12 }}>
            {session.sessionNumber}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: "white", fontWeight: "800", fontSize: 13 }}>Sesión {session.sessionNumber}</Text>
          {session.finishedAt && (
            <Text style={{ color: "rgba(255,255,255,0.30)", fontSize: 11 }}>{fmtShort(session.finishedAt)}</Text>
          )}
        </View>
        {session.attempts > 0 && (
          <View style={{ alignItems: "flex-end", gap: 1 }}>
            <Text style={{ color: session.pct !== null ? pctColor(session.pct) : "rgba(255,255,255,0.45)", fontWeight: "900", fontSize: 17 }}>
              {session.pct !== null ? `${Math.round(session.pct * 100)}%` : "—"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.28)", fontSize: 10 }}>{session.makes}/{session.attempts}</Text>
          </View>
        )}
        <View style={{
          paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8,
          backgroundColor: isDone ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.10)",
        }}>
          <Text style={{ color: isDone ? "rgba(34,197,94,0.85)" : "rgba(245,158,11,0.85)", fontSize: 10, fontWeight: "800" }}>
            {isDone ? "Hecha" : "En curso"}
          </Text>
        </View>
      </View>

      {onViewHeat && (
        <Pressable
          onPress={onViewHeat}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
            paddingVertical: 9,
            borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)",
            backgroundColor: "rgba(245,158,11,0.06)",
          }}
        >
          <Ionicons name="flame-outline" size={14} color="rgba(245,158,11,0.80)" />
          <Text style={{ color: "rgba(245,158,11,0.80)", fontWeight: "700", fontSize: 12 }}>Ver mapa de calor</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isDone = status === "DONE"; const isActive = status === "ACTIVE";
  return (
    <View style={{
      paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999,
      backgroundColor: isDone ? "rgba(34,197,94,0.12)" : isActive ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.07)",
      borderWidth: 1,
      borderColor: isDone ? "rgba(34,197,94,0.25)" : isActive ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.10)",
    }}>
      <Text style={{
        color: isDone ? "rgba(34,197,94,0.90)" : isActive ? "rgba(245,158,11,0.90)" : "rgba(255,255,255,0.45)",
        fontSize: 10, fontWeight: "800",
      }}>
        {isDone ? "Completada" : isActive ? "Activa" : status}
      </Text>
    </View>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{
      flex: 1, padding: 10, borderRadius: 13, gap: 4, alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    }}>
      <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, letterSpacing: 0.3 }}>{label}</Text>
      <Text style={{ color: color ?? "white", fontWeight: "900", fontSize: 15 }}>{value}</Text>
    </View>
  );
}

// ─── Heatmap Modal ────────────────────────────────────────────────────────────

function HeatmapModal({ title, playerName, spotAgg, sessionInfo, onClose }: {
  title: string; playerName: string; spotAgg: SpotAgg[]; sessionInfo?: SessionRow; onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const courtW = Math.min(width - 48, 420);
  const courtH = Math.round(courtW * 1.06);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode]               = useState<"HEAT" | "LIST">("HEAT");

  const spotDataMap = useMemo(() => {
    const m = new Map<string, { pct: number; makes: number; attempts: number; spotKey: string }>();
    spotAgg.forEach((s) => m.set(s.spotKey, { pct: s.pct, makes: s.makes, attempts: s.attempts, spotKey: s.spotKey }));
    return m;
  }, [spotAgg]);

  const spotMetaByKey = useMemo(() => {
    const m = new Map<string, (typeof ALL_SPOTS)[number]>();
    ALL_SPOTS.forEach((s) => m.set(s.id, s));
    return m;
  }, []);

  const selectedAgg  = selectedKey ? spotAgg.find((s) => s.spotKey === selectedKey) ?? null : null;
  const selectedMeta = selectedKey ? spotMetaByKey.get(selectedKey) ?? null : null;
  const totalAtt     = spotAgg.reduce((a, s) => a + s.attempts, 0);
  const totalMk      = spotAgg.reduce((a, s) => a + s.makes,    0);
  const overallPct   = totalAtt > 0 ? totalMk / totalAtt : 0;
  const sortedByPerf = [...spotAgg].sort((a, b) => b.pct - a.pct);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }}>
        <View style={{
          backgroundColor: "#0F1A2E",
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
          paddingTop: 12, paddingBottom: 40, maxHeight: "95%",
        }}>
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: "rgba(255,255,255,0.18)",
            alignSelf: "center", marginBottom: 14,
          }} />

          <View style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 22, marginBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
                {playerName}
              </Text>
              <Text style={{ color: "white", fontWeight: "900", fontSize: 18, letterSpacing: -0.3 }} numberOfLines={2}>
                {title}
              </Text>
              {sessionInfo && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <StatusBadge status={sessionInfo.status} />
                  {sessionInfo.finishedAt && (
                    <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                      {new Date(sessionInfo.finishedAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                    </Text>
                  )}
                </View>
              )}
            </View>
            <Pressable onPress={onClose} style={{ padding: 6, marginTop: 2 }}>
              <Ionicons name="close-outline" size={24} color="rgba(255,255,255,0.50)" />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 22, marginBottom: 14, marginTop: 10 }}>
            <StatChip label="Tiros"    value={`${totalAtt}`} />
            <StatChip label="Metidos"  value={`${totalMk}`} />
            <StatChip label="Promedio" value={`${Math.round(overallPct * 100)}%`} color={pctColor(overallPct)} />
          </View>

          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 22, marginBottom: 16 }}>
            <ModeBtn active={mode === "HEAT"} label="Mapa de calor" icon="flame-outline"    onPress={() => setMode("HEAT")} />
            <ModeBtn active={mode === "LIST"} label="Lista"         icon="list-outline"     onPress={() => setMode("LIST")} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: 22, gap: 14, paddingBottom: 12 }}>
              {mode === "HEAT" ? (
                <>
                  <View style={{ borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" }}>
                    <HeatCourt
                      width={courtW} height={courtH}
                      spots={ALL_SPOTS}
                      spotDataMap={spotDataMap}
                      selectedSpotKey={selectedKey}
                      onSelectSpot={(key) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedKey((prev) => prev === key ? null : key);
                      }}
                    />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
                    {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                      <View key={v} style={{ alignItems: "center", gap: 4 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: heatColor(v) }} />
                        <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 10 }}>{v * 100}%</Text>
                      </View>
                    ))}
                  </View>

                  {selectedAgg ? (
                    <View style={{
                      padding: 16, borderRadius: 16, gap: 10,
                      backgroundColor: "rgba(255,255,255,0.04)",
                      borderWidth: 1, borderColor: `${heatColor(selectedAgg.pct)}44`,
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ gap: 2 }}>
                          <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>
                            {spotMetaByKey.get(selectedAgg.spotKey)?.shotType === "3PT" ? "Triple" : "Doble"}
                          </Text>
                          <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>
                            {selectedMeta?.label ?? selectedAgg.spotKey}
                          </Text>
                        </View>
                        <Text style={{ color: heatColor(selectedAgg.pct), fontWeight: "900", fontSize: 30 }}>
                          {Math.round(selectedAgg.pct * 100)}%
                        </Text>
                      </View>
                      <BarViz value={selectedAgg.pct} color={heatColor(selectedAgg.pct)} />
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <StatChip label="Metidos"  value={`${selectedAgg.makes}`} />
                        <StatChip label="Intentos" value={`${selectedAgg.attempts}`} />
                      </View>
                    </View>
                  ) : (
                    <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, textAlign: "center" }}>
                      Tocá un spot para ver su detalle.
                    </Text>
                  )}
                </>
              ) : (
                <View style={{ gap: 8 }}>
                  {sortedByPerf.map((s, i) => {
                    const meta  = spotMetaByKey.get(s.spotKey);
                    const color = heatColor(s.pct);
                    return (
                      <View key={s.spotKey} style={{
                        padding: 14, borderRadius: 16, gap: 8,
                        backgroundColor: "rgba(255,255,255,0.04)",
                        borderWidth: 1, borderColor: `${color}33`,
                      }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                            <View style={{
                              width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center",
                              backgroundColor: `${color}1A`, borderWidth: 1, borderColor: `${color}44`,
                            }}>
                              <Text style={{ color, fontWeight: "900", fontSize: 11 }}>#{i + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>
                                {meta?.label ?? s.spotKey}
                              </Text>
                              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                                {meta?.shotType === "3PT" ? "Triple" : "Doble"} · {s.makes}/{s.attempts}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color, fontWeight: "900", fontSize: 22 }}>{Math.round(s.pct * 100)}%</Text>
                        </View>
                        <BarViz value={s.pct} color={color} />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Mode button ──────────────────────────────────────────────────────────────

function ModeBtn({ active, label, icon, onPress }: {
  active: boolean; label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={{
        flex: 1, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center",
        flexDirection: "row", gap: 6,
        backgroundColor: active ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
        borderWidth: 1.5, borderColor: active ? "rgba(245,158,11,0.40)" : "rgba(255,255,255,0.10)",
      }}
    >
      <Ionicons name={icon} size={16} color={active ? "#F59E0B" : "rgba(255,255,255,0.45)"} />
      <Text style={{ color: active ? "#F59E0B" : "rgba(255,255,255,0.60)", fontWeight: "800", fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Bar visualization ────────────────────────────────────────────────────────

function BarViz({ value, color }: { value: number; color: string }) {
  return (
    <View style={{ height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" }}>
      <View style={{ width: `${Math.round(value * 100)}%`, height: "100%", borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

// ─── HeatCourt ────────────────────────────────────────────────────────────────

type SpotDataEntry = { pct: number; makes: number; attempts: number; spotKey: string };

function HeatCourt({
  width, height, spots, spotDataMap, selectedSpotKey, onSelectSpot,
}: {
  width: number; height: number;
  spots: typeof ALL_SPOTS;
  spotDataMap: Map<string, SpotDataEntry>;
  selectedSpotKey: string | null;
  onSelectSpot: (key: string) => void;
}) {
  const padX = Math.max(width * 0.04, 18);
  const padTop = height * 0.03; const padBottom = height * 0.04;
  const left = padX; const right = width - padX;
  const top = padTop; const bottom = height - padBottom;
  const courtW = right - left; const courtH = bottom - top;
  const rimX = left + courtW * 0.5; const rimY = top + courtH * 0.11;
  const keyW = courtW * 0.40; const keyH = courtH * 0.36;
  const keyX = rimX - keyW / 2; const keyY = top;
  const ftY = keyY + keyH; const ftArcR = keyW * 0.30;
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
  const R_GLOW = 30; const R_DOT = 19; const R_SEL = 26;

  return (
    <View style={{ width, height, borderRadius: 18, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.30)" }}>
      <Svg width={width} height={height}>
        <Defs>
          {spots.map((s) => {
            const data = spotDataMap.get(s.id);
            const c = data ? heatColor(data.pct) : "rgba(255,255,255,0.1)";
            return (
              <RadialGradient key={`g-${s.id}`} id={`g-${s.id}`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%"   stopColor={c} stopOpacity={0.55} />
                <Stop offset="60%"  stopColor={c} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={c} stopOpacity={0}    />
              </RadialGradient>
            );
          })}
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="rgba(0,0,0,0.0)" />
        <Rect x={left} y={top} width={courtW} height={courtH} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1.5} rx={10} />
        <Rect x={keyX} y={keyY} width={keyW} height={keyH} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />
        <Line x1={keyX} y1={ftY} x2={keyX + keyW} y2={ftY} stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />
        <Path d={hcDescribeArc(rimX, ftY, ftArcR, 270, 90, true)} fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={1.5} />
        <Line x1={rimX - keyW * 0.20} y1={rimY - 12} x2={rimX + keyW * 0.20} y2={rimY - 12} stroke="rgba(255,255,255,0.22)" strokeWidth={2.5} />
        <Circle cx={rimX} cy={rimY} r={7} fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth={2} />
        <Line x1={cornerXLeft}  y1={top} x2={cornerXLeft}  y2={cornerBreakY} stroke="rgba(245,158,11,0.28)" strokeWidth={1.5} />
        <Line x1={cornerXRight} y1={top} x2={cornerXRight} y2={cornerBreakY} stroke="rgba(245,158,11,0.28)" strokeWidth={1.5} />
        <Path d={hcDescribeArc(rimX, rimY, threeArcR, threeStartAngle, threeEndAngle, true)} fill="none" stroke="rgba(245,158,11,0.28)" strokeWidth={1.5} />
        {spots.map((s) => {
          const cx = left + s.x * courtW; const cy = top + s.y * courtH;
          const data = spotDataMap.get(s.id);
          const pct  = data?.pct ?? 0;
          const c    = data ? heatColor(pct) : "rgba(255,255,255,0.18)";
          const isSel   = selectedSpotKey === s.id;
          const hasData = !!data;
          return (
            <React.Fragment key={s.id}>
              {hasData && <Circle cx={cx} cy={cy} r={R_GLOW} fill={`url(#g-${s.id})`} />}
              {isSel && (
                <>
                  <Circle cx={cx} cy={cy} r={R_SEL + 6} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} strokeDasharray="4 3" />
                  <Circle cx={cx} cy={cy} r={R_SEL}     fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
                </>
              )}
              <Circle
                cx={cx} cy={cy} r={isSel ? R_SEL - 4 : R_DOT}
                fill={hasData ? c : "rgba(255,255,255,0.08)"}
                fillOpacity={hasData ? (isSel ? 1 : 0.82) : 0.4}
                stroke={isSel ? "white" : c}
                strokeWidth={isSel ? 2 : 1.5}
                strokeOpacity={hasData ? 1 : 0.3}
                onPress={() => onSelectSpot(s.id)}
              />
              <SvgText
                x={cx} y={cy + (isSel ? 5 : 4)}
                fontSize={isSel ? "13" : "11"} fontWeight="800"
                fill={isSel ? "#0B1220" : "rgba(255,255,255,0.92)"}
                textAnchor="middle"
                onPress={() => onSelectSpot(s.id)}
              >
                {hasData ? `${Math.round(pct * 100)}%` : "—"}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

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
  const ns = ((startAngle % 360) + 360) % 360;
  const ne = ((endAngle   % 360) + 360) % 360;
  const delta = clockwise ? (ne - ns + 360) % 360 : (ns - ne + 360) % 360;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${delta > 180 ? "1" : "0"} ${clockwise ? "1" : "0"} ${end.x} ${end.y}`;
}
