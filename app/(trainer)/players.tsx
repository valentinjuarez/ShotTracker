// app/(trainer)/players.tsx  — All players detail view
import { ALL_SPOTS } from "@/src/data/spots";
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

// â”€â”€â”€ Spot name map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SPOT_LABEL: Record<string, string> = {
  // Triples — línea recta izquierda (corner)
  "3pt_l1": "Triple Izq. · Línea 1",
  "3pt_l2": "Triple Izq. · Línea 2",
  "3pt_l3": "Triple Izq. · Línea 3",
  "3pt_l4": "Triple Izq. · Línea 4",
  // Triples — arco izquierdo
  "3pt_l5": "Triple Izq. · Arco 5",
  "3pt_l6": "Triple Izq. · Arco 6",
  "3pt_l7": "Triple Izq. · Arco 7",
  // Triples — centro
  "3pt_axis": "Triple · Centro",
  // Triples — arco derecho
  "3pt_r7": "Triple Der. · Arco 7",
  "3pt_r6": "Triple Der. · Arco 6",
  "3pt_r5": "Triple Der. · Arco 5",
  // Triples — línea recta derecha (corner)
  "3pt_r4": "Triple Der. · Línea 4",
  "3pt_r3": "Triple Der. · Línea 3",
  "3pt_r2": "Triple Der. · Línea 2",
  "3pt_r1": "Triple Der. · Línea 1",
  // Dobles — izquierda
  "2pt_l3": "Doble Izq. · 3",
  "2pt_l5": "Doble Izq. · 5",
  "2pt_l7": "Doble Izq. · 7",
  // Dobles — tiro libre
  "2pt_ft": "Tiro Libre",
  // Dobles — derecha
  "2pt_r7": "Doble Der. · 7",
  "2pt_r5": "Doble Der. · 5",
  "2pt_r3": "Doble Der. · 3",
};

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PlayerDetail = {
  user_id: string;
  display_name: string | null;
  sessions: number;
  attempts: number;
  makes: number;
  pct: number | null;
  lastActive: string | null;
  spotBreakdown: SpotBreakdown[];
};

type SpotBreakdown = {
  spot_key: string;
  shot_type: string;
  attempts: number;
  makes: number;
  pct: number;
};

type SortKey = "pct" | "sessions" | "name";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function pctColor(p: number) {
  if (p >= 0.65) return "rgba(34,197,94,1)";
  if (p >= 0.40) return "rgba(245,158,11,1)";
  return "rgba(239,68,68,1)";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

const card = {
  padding: 18, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;

// â”€â”€â”€ Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function PlayersScreen() {
  const [players, setPlayers]       = useState<PlayerDetail[]>([]);
  const [selected, setSelected]     = useState<PlayerDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [sort, setSort]             = useState<SortKey>("pct");

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

      if (!membership) { setPlayers([]); return; }
      const teamId = (membership as any).team_id as string;

      const { data: members } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
        .eq("role", "player");

      const playerIds: string[] = (members ?? []).map((m: any) => m.user_id);
      if (!playerIds.length) { setPlayers([]); return; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", playerIds);

      const nameMap: Record<string, string | null> = {};
      (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.display_name; });

      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, user_id, started_at")
        .in("user_id", playerIds)
        .order("started_at", { ascending: false });

      // Also collect workout sessions (workout_id in user's workouts)
      const { data: playerWorkouts } = await supabase
        .from("workouts")
        .select("id, user_id")
        .in("user_id", playerIds);
      const wkIds = (playerWorkouts ?? []).map((w: any) => w.id as string);
      const workoutOwnerMap: Record<string, string> = {};
      (playerWorkouts ?? []).forEach((w: any) => { workoutOwnerMap[w.id] = w.user_id; });

      let workoutSessions: any[] = [];
      if (wkIds.length > 0) {
        const { data: ws } = await supabase
          .from("sessions")
          .select("id, workout_id, started_at")
          .in("workout_id", wkIds)
          .order("started_at", { ascending: false });
        workoutSessions = ws ?? [];
      }

      // Build combined sessions with a reliable player mapping
      const freeRows = (sessions ?? []).map((s: any) => ({ id: s.id, user_id: s.user_id, started_at: s.started_at }));
      const wkRows   = workoutSessions.map((s: any) => ({ id: s.id, user_id: workoutOwnerMap[s.workout_id] ?? null, started_at: s.started_at }));
      const allRows  = [...freeRows];
      const seenIds  = new Set(freeRows.map((r) => r.id));
      wkRows.forEach((r) => { if (r.user_id && !seenIds.has(r.id)) { allRows.push(r); seenIds.add(r.id); } });

      const sessionsByPlayer: Record<string, string[]> = {};
      const lastActiveMap: Record<string, string> = {};
      allRows.forEach((s) => {
        if (!s.user_id) return;
        if (!sessionsByPlayer[s.user_id]) sessionsByPlayer[s.user_id] = [];
        sessionsByPlayer[s.user_id].push(s.id);
        if (!lastActiveMap[s.user_id]) lastActiveMap[s.user_id] = s.started_at;
      });

      const allSessionIds = allRows.map((s) => s.id);
      let spotsData: any[] = [];
      if (allSessionIds.length > 0) {
        const { data: spots } = await supabase
          .from("session_spots")
          .select("session_id, spot_key, shot_type, attempts, makes")
          .in("session_id", allSessionIds);
        spotsData = spots ?? [];
      }

      const sessionPlayerMap: Record<string, string> = {};
      allRows.forEach((s) => { if (s.user_id) sessionPlayerMap[s.id] = s.user_id; });

      type SpotKey = string;
      const spotsByPlayer: Record<string, Record<SpotKey, { shot_type: string; att: number; mk: number }>> = {};
      spotsData.forEach((sp: any) => {
        const uid = sessionPlayerMap[sp.session_id];
        if (!uid) return;
        if (!spotsByPlayer[uid]) spotsByPlayer[uid] = {};
        if (!spotsByPlayer[uid][sp.spot_key]) spotsByPlayer[uid][sp.spot_key] = { shot_type: sp.shot_type, att: 0, mk: 0 };
        spotsByPlayer[uid][sp.spot_key].att += sp.attempts ?? 0;
        spotsByPlayer[uid][sp.spot_key].mk  += sp.makes    ?? 0;
      });

      const result: PlayerDetail[] = playerIds.map((uid) => {
        const spots = spotsByPlayer[uid] ?? {};
        const breakdown: SpotBreakdown[] = Object.entries(spots)
          .map(([key, v]) => ({
            spot_key: key, shot_type: v.shot_type,
            attempts: v.att, makes: v.mk,
            pct: v.att > 0 ? v.mk / v.att : 0,
          }))
          .sort((a, b) => b.pct - a.pct);

        const att = breakdown.reduce((a, s) => a + s.attempts, 0);
        const mk  = breakdown.reduce((a, s) => a + s.makes, 0);

        return {
          user_id:       uid,
          display_name:  nameMap[uid] ?? null,
          sessions:      (sessionsByPlayer[uid] ?? []).length,
          attempts:      att,
          makes:         mk,
          pct:           att > 0 ? mk / att : null,
          lastActive:    lastActiveMap[uid] ?? null,
          spotBreakdown: breakdown,
        };
      });

      result.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
      setPlayers(result);
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

  const filtered = useMemo(() => {
    let list = [...players];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => (p.display_name ?? "").toLowerCase().includes(q));
    }
    if (sort === "pct")      list.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
    if (sort === "sessions") list.sort((a, b) => b.sessions - a.sessions);
    if (sort === "name")     list.sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
    return list;
  }, [players, search, sort]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" colors={["#F59E0B"]} />
        }
      >
        {/* Header */}
        <View style={{ marginBottom: 2 }}>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>Estadísticas</Text>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>Jugadores</Text>
        </View>

        {/* Search */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
          paddingHorizontal: 14, height: 44,
        }}>
          <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.35)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar jugador…"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={{ flex: 1, color: "white", fontSize: 14 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.30)" />
            </Pressable>
          )}
        </View>

        {/* Sort pills */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([
            { key: "pct",      label: "% Acierto" },
            { key: "sessions", label: "Sesiones" },
            { key: "name",     label: "Nombre" },
          ] as { key: SortKey; label: string }[]).map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setSort(s.key)}
              style={{
                paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999,
                backgroundColor: sort === s.key ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: sort === s.key ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.09)",
              }}
            >
              <Text style={{
                color: sort === s.key ? "#F59E0B" : "rgba(255,255,255,0.45)",
                fontSize: 12, fontWeight: "700",
              }}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color="#F59E0B" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={[card, { alignItems: "center", gap: 10, paddingVertical: 40 }]}>
            <Ionicons name="people-outline" size={30} color="rgba(255,255,255,0.18)" />
            <Text style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 13 }}>
              {players.length === 0 ? "Sin jugadores en el equipo aún." : "Sin resultados para esa búsqueda."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {filtered.map((p, idx) => (
              <PlayerRow
                key={p.user_id}
                player={p}
                rank={idx + 1}
                onPress={() => setSelected(p)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      {selected && (
        <PlayerDetailModal player={selected} onClose={() => setSelected(null)} />
      )}
    </SafeAreaView>
  );
}

// â”€â”€â”€ Player row (compact list item) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PlayerRow({ player, rank, onPress }: { player: PlayerDetail; rank: number; onPress: () => void }) {
  const hasPct = player.pct !== null;
  const color  = hasPct ? pctColor(player.pct!) : "rgba(255,255,255,0.30)";
  const pctVal = hasPct ? Math.round(player.pct! * 100) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 14,
        padding: 14, borderRadius: 18,
        backgroundColor: pressed ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.045)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
      })}
    >
      {/* Rank badge */}
      <View style={{
        width: 28, height: 28, borderRadius: 9,
        backgroundColor: rank <= 3 ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: rank <= 3 ? "rgba(245,158,11,0.30)" : "rgba(255,255,255,0.08)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{
          color: rank <= 3 ? "#F59E0B" : "rgba(255,255,255,0.35)",
          fontWeight: "900", fontSize: 12,
        }}>{rank}</Text>
      </View>

      {/* Avatar */}
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: "rgba(245,158,11,0.10)",
        borderWidth: 1.5, borderColor: "rgba(245,158,11,0.22)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ color: "rgba(245,158,11,0.85)", fontWeight: "900", fontSize: 15 }}>
          {(player.display_name ?? "?")[0].toUpperCase()}
        </Text>
      </View>

      {/* Name + stats */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: "white", fontWeight: "800", fontSize: 14, letterSpacing: -0.2 }} numberOfLines={1}>
          {player.display_name ?? `Jugador ${player.user_id.slice(0, 6)}`}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
            {player.sessions} ses.
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.18)", fontSize: 11 }}>·</Text>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
            {player.attempts} tiros
          </Text>
        </View>
        {/* Mini pct bar */}
        {hasPct && (
          <View style={{ height: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: 2 }}>
            <View style={{ width: `${pctVal}%`, height: "100%", borderRadius: 999, backgroundColor: color }} />
          </View>
        )}
      </View>

      {/* Pct value */}
      <Text style={{ color, fontWeight: "900", fontSize: 20, letterSpacing: -0.5, minWidth: 46, textAlign: "right" }}>
        {pctVal !== null ? `${pctVal}%` : "—"}
      </Text>

      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.20)" />
    </Pressable>
  );
}

// â”€â”€â”€ Player detail Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PlayerDetailModal({ player, onClose }: { player: PlayerDetail; onClose: () => void }) {
  const triples = player.spotBreakdown.filter((s) => s.shot_type === "3PT");
  const doubles = player.spotBreakdown.filter((s) => s.shot_type === "2PT");
  const [expandedSpot, setExpandedSpot] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const courtW = Math.min(width - 88, 300);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }}>
        <SafeAreaView style={{
          backgroundColor: "#0F1A2E",
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
          maxHeight: "92%",
        }}>
          {/* Handle */}
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: "rgba(255,255,255,0.18)",
            alignSelf: "center", marginTop: 12, marginBottom: 4,
          }} />

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 44, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: "rgba(245,158,11,0.12)",
                borderWidth: 1.5, borderColor: "rgba(245,158,11,0.30)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ color: "rgba(245,158,11,0.90)", fontWeight: "900", fontSize: 22 }}>
                  {(player.display_name ?? "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 4, paddingTop: 4 }}>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 20, letterSpacing: -0.4 }}>
                  {player.display_name ?? `Jugador ${player.user_id.slice(0, 6)}`}
                </Text>
                {player.lastActive && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.30)" />
                    <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                      Última actividad: {fmtDate(player.lastActive)}
                    </Text>
                  </View>
                )}
              </View>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close-outline" size={24} color="rgba(255,255,255,0.45)" />
              </Pressable>
            </View>

            {/* Overall pct */}
            {player.pct !== null && (
              <View style={{
                alignItems: "center", padding: 20, borderRadius: 20, gap: 6,
                backgroundColor: pctColor(player.pct).replace("1)", "0.08)"),
                borderWidth: 1.5, borderColor: pctColor(player.pct).replace("1)", "0.28)"),
              }}>
                <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Efectividad general
                </Text>
                <Text style={{ color: pctColor(player.pct), fontWeight: "900", fontSize: 48, letterSpacing: -2 }}>
                  {Math.round(player.pct * 100)}%
                </Text>
                <View style={{ width: "100%", height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <View style={{
                    width: `${Math.round(player.pct * 100)}%`,
                    height: "100%", borderRadius: 999,
                    backgroundColor: pctColor(player.pct),
                  }} />
                </View>
              </View>
            )}

            {/* Mini stats */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { label: "Sesiones", value: String(player.sessions),  icon: "calendar-outline" as const },
                { label: "Tiros",    value: String(player.attempts),  icon: "basketball-outline" as const },
                { label: "Metidos",  value: String(player.makes),     icon: "checkmark-circle-outline" as const },
              ].map((s) => (
                <View key={s.label} style={{
                  flex: 1, padding: 12, borderRadius: 16, gap: 6,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
                  alignItems: "center",
                }}>
                  <Ionicons name={s.icon} size={16} color="rgba(255,255,255,0.30)" />
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 20 }}>{s.value}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Spot breakdown */}
            {player.spotBreakdown.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
                  Rendimiento por posición
                </Text>
                {([
                  { label: "Triples", items: triples, accent: "rgba(245,158,11,1)" },
                  { label: "Dobles",  items: doubles, accent: "rgba(99,179,237,1)" },
                ] as { label: string; items: SpotBreakdown[]; accent: string }[]).map((group) =>
                  group.items.length === 0 ? null : (
                    <View key={group.label} style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: group.accent }} />
                        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "700" }}>
                          {group.label} · {group.items.length} posiciones
                        </Text>
                      </View>
                      {group.items.map((spot) => {
                        const color = pctColor(spot.pct);
                        const label = SPOT_LABEL[spot.spot_key] ?? spot.spot_key;
                        const isOpen = expandedSpot === spot.spot_key;
                        return (
                          <Pressable
                            key={spot.spot_key}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setExpandedSpot(isOpen ? null : spot.spot_key);
                            }}
                            style={({ pressed }) => ({
                              paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, gap: 7,
                              backgroundColor: isOpen
                                ? "rgba(255,255,255,0.06)"
                                : pressed ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
                              borderWidth: 1,
                              borderColor: isOpen ? `${color}44` : "rgba(255,255,255,0.07)",
                            })}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                              <Text style={{ flex: 1, color: "rgba(255,255,255,0.80)", fontSize: 13, fontWeight: "600" }}>
                                {label}
                              </Text>
                              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                                {spot.makes}/{spot.attempts}
                              </Text>
                              <Text style={{ color, fontWeight: "900", fontSize: 15, minWidth: 44, textAlign: "right" }}>
                                {Math.round(spot.pct * 100)}%
                              </Text>
                              <Ionicons
                                name={isOpen ? "chevron-up" : "location-outline"}
                                size={13}
                                color={isOpen ? color : "rgba(255,255,255,0.25)"}
                              />
                            </View>
                            {/* Mini bar per spot */}
                            <View style={{ height: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                              <View style={{ width: `${Math.round(spot.pct * 100)}%` as `${number}%`, height: "100%", borderRadius: 999, backgroundColor: color }} />
                            </View>
                            {/* Mini court map */}
                            {isOpen && (
                              <View style={{ alignItems: "center", marginTop: 6 }}>
                                <SpotMiniCourt
                                  width={courtW}
                                  height={Math.round(courtW * 1.06)}
                                  highlightKey={spot.spot_key}
                                  spotAgg={player.spotBreakdown}
                                />
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Mini Court ───────────────────────────────────────────────────────────────

function SpotMiniCourt({
  width, height, highlightKey, spotAgg,
}: {
  width: number; height: number;
  highlightKey: string;
  spotAgg: SpotBreakdown[];
}) {
  const padX      = width  * 0.05;
  const padTop    = height * 0.03;
  const padBottom = height * 0.04;
  const left   = padX;
  const right  = width  - padX;
  const top    = padTop;
  const bottom = height - padBottom;
  const courtW = right  - left;
  const courtH = bottom - top;
  const rimX   = left + courtW * 0.5;
  const rimY   = top  + courtH * 0.11;
  const keyW   = courtW * 0.40;
  const keyH   = courtH * 0.36;
  const keyX   = rimX - keyW / 2;
  const keyY   = top;
  const ftY    = keyY + keyH;
  const ftArcR = keyW * 0.30;
  const cornerXLeft  = left  + courtW * 0.12;
  const cornerXRight = right - courtW * 0.12;
  const threeArcR    = courtW * 0.382;
  const dxCorner     = Math.abs(rimX - cornerXLeft);
  const cornerBreakY = Math.min(
    rimY + Math.sqrt(Math.max(threeArcR * threeArcR - dxCorner * dxCorner, 0)),
    bottom - courtH * 0.02,
  );
  const threeStartAngle = mcAngle(rimX, rimY, cornerXLeft,  cornerBreakY);
  const threeEndAngle   = mcAngle(rimX, rimY, cornerXRight, cornerBreakY);

  const spotDataMap = useMemo(() => {
    const m = new Map<string, number>();
    spotAgg.forEach((s) => m.set(s.spot_key, s.pct));
    return m;
  }, [spotAgg]);

  const R_DOT = Math.max(width * 0.052, 10);
  const R_HL  = R_DOT + 5;

  return (
    <View style={{
      width, height, borderRadius: 14, overflow: "hidden",
      backgroundColor: "rgba(0,0,0,0.35)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    }}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="hlGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#F59E0B" stopOpacity={0.60} />
            <Stop offset="70%"  stopColor="#F59E0B" stopOpacity={0.15} />
            <Stop offset="100%" stopColor="#F59E0B" stopOpacity={0}    />
          </RadialGradient>
        </Defs>

        {/* Court outline */}
        <Rect x={left} y={top} width={courtW} height={courtH}
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1.2} rx={8} />
        {/* Key */}
        <Rect x={keyX} y={keyY} width={keyW} height={keyH}
          fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.13)" strokeWidth={1.2} />
        {/* Free-throw line */}
        <Line x1={keyX} y1={ftY} x2={keyX + keyW} y2={ftY}
          stroke="rgba(255,255,255,0.13)" strokeWidth={1.2} />
        {/* FT arc */}
        <Path d={mcArc(rimX, ftY, ftArcR, 270, 90, true)}
          fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={1.2} />
        {/* Rim */}
        <Line x1={rimX - keyW * 0.20} y1={rimY - 10} x2={rimX + keyW * 0.20} y2={rimY - 10}
          stroke="rgba(255,255,255,0.20)" strokeWidth={2} />
        <Circle cx={rimX} cy={rimY} r={5} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
        {/* 3pt corners */}
        <Line x1={cornerXLeft}  y1={top} x2={cornerXLeft}  y2={cornerBreakY}
          stroke="rgba(245,158,11,0.22)" strokeWidth={1.2} />
        <Line x1={cornerXRight} y1={top} x2={cornerXRight} y2={cornerBreakY}
          stroke="rgba(245,158,11,0.22)" strokeWidth={1.2} />
        {/* 3pt arc */}
        <Path d={mcArc(rimX, rimY, threeArcR, threeStartAngle, threeEndAngle, true)}
          fill="none" stroke="rgba(245,158,11,0.22)" strokeWidth={1.2} />

        {/* All spots */}
        {ALL_SPOTS.map((s) => {
          const cx      = left + s.x * courtW;
          const cy      = top  + s.y * courtH;
          const isHL    = s.id === highlightKey;
          const spotPct = spotDataMap.get(s.id);
          const dotColor = isHL
            ? "#F59E0B"
            : spotPct !== undefined
              ? pctColor(spotPct)
              : "rgba(255,255,255,0.10)";

          return (
            <React.Fragment key={s.id}>
              {isHL && (
                <Circle cx={cx} cy={cy} r={R_HL + 8} fill="url(#hlGlow)" />
              )}
              {isHL && (
                <Circle cx={cx} cy={cy} r={R_HL}
                  fill="none" stroke="rgba(245,158,11,0.70)" strokeWidth={2}
                  strokeDasharray="4 3" />
              )}
              <Circle
                cx={cx} cy={cy} r={isHL ? R_HL - 2 : R_DOT}
                fill={dotColor}
                fillOpacity={isHL ? 1 : spotPct !== undefined ? 0.55 : 0.18}
                stroke={isHL ? "white" : "transparent"}
                strokeWidth={isHL ? 1.5 : 0}
              />
              <SvgText
                x={cx} y={cy + (isHL ? 5 : 4)}
                fontSize={isHL ? "12" : "9"}
                fontWeight="800"
                fill={isHL ? "#0B1220" : "rgba(255,255,255,0.75)"}
                textAnchor="middle"
              >
                {spotPct !== undefined ? `${Math.round(spotPct * 100)}%` : s.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function mcPolar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function mcAngle(cx: number, cy: number, x: number, y: number) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
}
function mcArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, cw = false) {
  const start = mcPolar(cx, cy, r, endAngle);
  const end   = mcPolar(cx, cy, r, startAngle);
  const ns = ((startAngle % 360) + 360) % 360;
  const ne = ((endAngle   % 360) + 360) % 360;
  const delta = cw ? (ne - ns + 360) % 360 : (ns - ne + 360) % 360;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${delta > 180 ? "1" : "0"} ${cw ? "1" : "0"} ${end.x} ${end.y}`;
}
