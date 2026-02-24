// app/(trainer)/players.tsx  — All players detail view
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from "react-native";

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

function pctColor(p: number) {
  if (p >= 0.65) return "rgba(34,197,94,1)";
  if (p >= 0.40) return "rgba(245,158,11,1)";
  return "rgba(239,68,68,1)";
}

const card = {
  padding: 18, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;

export default function PlayersScreen() {
  const [players, setPlayers]       = useState<PlayerDetail[]>([]);
  const [selected, setSelected]     = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      const sessionsByPlayer: Record<string, string[]> = {};
      const lastActiveMap: Record<string, string> = {};
      (sessions ?? []).forEach((s: any) => {
        if (!sessionsByPlayer[s.user_id]) sessionsByPlayer[s.user_id] = [];
        sessionsByPlayer[s.user_id].push(s.id);
        if (!lastActiveMap[s.user_id]) lastActiveMap[s.user_id] = s.started_at;
      });

      const allSessionIds = (sessions ?? []).map((s: any) => s.id);
      let spotsData: any[] = [];
      if (allSessionIds.length > 0) {
        const { data: spots } = await supabase
          .from("session_spots")
          .select("session_id, spot_key, shot_type, attempts, makes")
          .in("session_id", allSessionIds);
        spotsData = spots ?? [];
      }

      const sessionPlayerMap: Record<string, string> = {};
      (sessions ?? []).forEach((s: any) => { sessionPlayerMap[s.id] = s.user_id; });

      // Aggregate by player+spot
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
          user_id:      uid,
          display_name: nameMap[uid] ?? null,
          sessions:     (sessionsByPlayer[uid] ?? []).length,
          attempts:     att,
          makes:        mk,
          pct:          att > 0 ? mk / att : null,
          lastActive:   lastActiveMap[uid] ?? null,
          spotBreakdown: breakdown,
        };
      });

      result.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
      setPlayers(result);
      if (!selected && result.length > 0) setSelected(result[0].user_id);
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

  const selectedPlayer = players.find((p) => p.user_id === selected) ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" colors={["#F59E0B"]} />
        }
      >
        <View style={{ marginBottom: 4 }}>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>Estadísticas</Text>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>Jugadores</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#F59E0B" style={{ marginTop: 40 }} />
        ) : players.length === 0 ? (
          <View style={[card, { alignItems: "center", gap: 10, paddingVertical: 40 }]}>
            <Ionicons name="people-outline" size={30} color="rgba(255,255,255,0.18)" />
            <Text style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 13 }}>
              Sin jugadores en el equipo aún.
            </Text>
          </View>
        ) : (
          <>
            {/* Player chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
                {players.map((p) => (
                  <Pressable
                    key={p.user_id}
                    onPress={() => setSelected(p.user_id)}
                    style={{
                      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                      backgroundColor: selected === p.user_id ? "#F59E0B" : "rgba(255,255,255,0.07)",
                      borderWidth: 1.5,
                      borderColor: selected === p.user_id ? "#F59E0B" : "rgba(255,255,255,0.10)",
                    }}
                  >
                    <Text style={{
                      color: selected === p.user_id ? "#0B1220" : "rgba(255,255,255,0.75)",
                      fontWeight: "800", fontSize: 13,
                    }}>
                      {p.display_name ?? `J-${p.user_id.slice(0, 4)}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Selected player detail */}
            {selectedPlayer && <PlayerDetailCard player={selectedPlayer} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerDetailCard({ player }: { player: PlayerDetail }) {
  const triples = player.spotBreakdown.filter((s) => s.shot_type === "3PT");
  const doubles = player.spotBreakdown.filter((s) => s.shot_type === "2PT");

  const lastDate = player.lastActive
    ? new Date(player.lastActive).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <View style={{ gap: 14 }}>
      {/* Summary card */}
      <View style={[card, { gap: 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{
            width: 54, height: 54, borderRadius: 27,
            backgroundColor: "rgba(245,158,11,0.12)",
            borderWidth: 1.5, borderColor: "rgba(245,158,11,0.30)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="person-outline" size={24} color="rgba(245,158,11,0.80)" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 18, letterSpacing: -0.3 }}>
              {player.display_name ?? `Jugador ${player.user_id.slice(0, 6)}`}
            </Text>
            {lastDate && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.30)" />
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                  Última actividad: {lastDate}
                </Text>
              </View>
            )}
          </View>
          {player.pct !== null && (
            <View style={{
              width: 60, height: 60, borderRadius: 16,
              backgroundColor: pctColor(player.pct).replace("1)", "0.12)"),
              borderWidth: 1.5, borderColor: pctColor(player.pct).replace("1)", "0.35)"),
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: pctColor(player.pct), fontWeight: "900", fontSize: 18, letterSpacing: -0.5 }}>
                {Math.round(player.pct * 100)}%
              </Text>
            </View>
          )}
        </View>

        {/* Mini stats row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Sesiones",  value: String(player.sessions) },
            { label: "Tiros",     value: String(player.attempts) },
            { label: "Metidos",   value: String(player.makes) },
          ].map((s) => (
            <View key={s.label} style={{
              flex: 1, padding: 10, borderRadius: 12, gap: 4,
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
              alignItems: "center",
            }}>
              <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>{s.value}</Text>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Progress bar */}
        {player.pct !== null && (
          <View style={{ height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <View style={{
              width: `${Math.round(player.pct * 100)}%`,
              height: "100%", borderRadius: 999,
              backgroundColor: pctColor(player.pct),
            }} />
          </View>
        )}
      </View>

      {/* Spot breakdown */}
      {player.spotBreakdown.length > 0 && (
        <View style={[card, { gap: 14 }]}>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
            Rendimiento por posición
          </Text>
          {[
            { label: "Triples", items: triples, color: "rgba(245,158,11,1)" },
            { label: "Dobles",  items: doubles, color: "rgba(34,197,94,1)" },
          ].map((group) => group.items.length === 0 ? null : (
            <View key={group.label} style={{ gap: 8 }}>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>
                {group.label}
              </Text>
              {group.items.map((spot) => (
                <View key={spot.spot_key} style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
                }}>
                  <View style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: pctColor(spot.pct),
                  }} />
                  <Text style={{ flex: 1, color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
                    {spot.spot_key}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 12 }}>
                    {spot.makes}/{spot.attempts}
                  </Text>
                  <Text style={{
                    color: pctColor(spot.pct), fontWeight: "900", fontSize: 14,
                    minWidth: 40, textAlign: "right",
                  }}>
                    {Math.round(spot.pct * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
