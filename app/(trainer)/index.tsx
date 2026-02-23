// app/(trainer)/index.tsx  — Coach dashboard
import { useProfile } from "@/src/hooks/useProfile";
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerStat = {
  user_id: string;
  display_name: string | null;
  sessions: number;
  attempts: number;
  makes: number;
  pct: number | null;
  lastActive: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctColor(p: number) {
  if (p >= 0.65) return "rgba(34,197,94,1)";
  if (p >= 0.40) return "rgba(245,158,11,1)";
  return "rgba(239,68,68,1)";
}

function useFadeSlide(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, []);
  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };
}

const card = {
  padding: 18, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const router = useRouter();
  const { profile } = useProfile();

  const [team, setTeam]             = useState<{ id: string; name: string; invite_code: string } | null>(null);
  const [players, setPlayers]       = useState<PlayerStat[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerAnim = useFadeSlide(0);
  const teamAnim   = useFadeSlide(80);
  const statsAnim  = useFadeSlide(160);
  const listAnim   = useFadeSlide(240);

  const loadData = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      // 1. Find coach's team
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name, invite_code)")
        .eq("user_id", userId)
        .eq("role", "coach")
        .maybeSingle();

      if (!membership) { setTeam(null); setPlayers([]); return; }
      const t = (membership as any).teams as { id: string; name: string; invite_code: string };
      setTeam(t);

      // 2. Get all player members
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, role")
        .eq("team_id", t.id)
        .eq("role", "player");

      const playerIds: string[] = (members ?? []).map((m: any) => m.user_id);
      if (!playerIds.length) { setPlayers([]); return; }

      // 3. Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", playerIds);

      const nameMap: Record<string, string | null> = {};
      (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.display_name; });

      // 4. Get sessions per player
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

      // 5. Get spots aggregated
      let spotsData: any[] = [];
      if (allSessionIds.length > 0) {
        const { data: spots } = await supabase
          .from("session_spots")
          .select("session_id, attempts, makes")
          .in("session_id", allSessionIds);
        spotsData = spots ?? [];
      }

      // Build session→player map
      const sessionPlayerMap: Record<string, string> = {};
      (sessions ?? []).forEach((s: any) => { sessionPlayerMap[s.id] = s.user_id; });

      const aggByPlayer: Record<string, { att: number; mk: number }> = {};
      spotsData.forEach((sp: any) => {
        const uid = sessionPlayerMap[sp.session_id];
        if (!uid) return;
        if (!aggByPlayer[uid]) aggByPlayer[uid] = { att: 0, mk: 0 };
        aggByPlayer[uid].att += sp.attempts ?? 0;
        aggByPlayer[uid].mk  += sp.makes    ?? 0;
      });

      // 6. Build player stats array
      const stats: PlayerStat[] = playerIds.map((uid) => {
        const agg = aggByPlayer[uid];
        const att = agg?.att ?? 0;
        const mk  = agg?.mk  ?? 0;
        return {
          user_id:     uid,
          display_name: nameMap[uid] ?? null,
          sessions:    (sessionsByPlayer[uid] ?? []).length,
          attempts:    att,
          makes:       mk,
          pct:         att > 0 ? mk / att : null,
          lastActive:  lastActiveMap[uid] ?? null,
        };
      });

      // Sort by pct desc, then by sessions desc
      stats.sort((a, b) =>
        (b.pct ?? -1) - (a.pct ?? -1) || b.sessions - a.sessions
      );
      setPlayers(stats);
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

  // Aggregate team stats
  const totalAttempts = players.reduce((a, p) => a + p.attempts, 0);
  const totalMakes    = players.reduce((a, p) => a + p.makes, 0);
  const teamPct       = totalAttempts > 0 ? totalMakes / totalAttempts : null;
  const totalSessions = players.reduce((a, p) => a + p.sessions, 0);

  const displayName = profile?.display_name ?? "Entrenador/a";
  const initials = displayName.split(" ").filter(Boolean).map((w: string) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");

  async function onLogout() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44, gap: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" colors={["#F59E0B"]} />
        }
      >
        {/* Header */}
        <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, headerAnim]}>
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: "rgba(99,179,237,0.15)",
            borderWidth: 1.5, borderColor: "rgba(99,179,237,0.35)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: "rgba(99,179,237,1)", fontWeight: "900", fontSize: 15 }}>
              {initials || "🏀"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>Panel de entrenador/a</Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          <Pressable
            onPress={onLogout}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.07)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="log-out-outline" size={19} color="rgba(255,255,255,0.55)" />
          </Pressable>
        </Animated.View>

        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator color="#F59E0B" size="large" />
          </View>
        ) : !team ? (
          <NoTeamState />
        ) : (
          <>
            {/* Team banner */}
            <Animated.View style={teamAnim}>
              <TeamBanner team={team} />
            </Animated.View>

            {/* Global team stats */}
            <Animated.View style={[{ flexDirection: "row", gap: 12 }, statsAnim]}>
              <StatTile icon="people-outline"      label="Jugadoras"    value={String(players.length)} />
              <StatTile icon="basketball-outline"  label="Tiros totales" value={String(totalAttempts)} />
              <StatTile
                icon="trending-up-outline"
                label="% Equipo"
                value={teamPct !== null ? `${Math.round(teamPct * 100)}%` : "–"}
                valueColor={teamPct !== null ? pctColor(teamPct) : undefined}
              />
            </Animated.View>

            {/* Player ranking */}
            <Animated.View style={[card, listAnim, { gap: 14 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
                  Ranking de jugadoras
                </Text>
                <Pressable
                  onPress={() => router.push("/(trainer)/players" as any)}
                  style={{
                    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.07)",
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
                  }}
                >
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700" }}>Ver todas</Text>
                </Pressable>
              </View>

              {players.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 20, gap: 8 }}>
                  <Ionicons name="people-outline" size={28} color="rgba(255,255,255,0.18)" />
                  <Text style={{ color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 13 }}>
                    Aún no hay jugadoras en el equipo.{"\n"}Compartí el código de invitación.
                  </Text>
                </View>
              ) : (
                players.slice(0, 5).map((player, i) => (
                  <PlayerRankRow
                    key={player.user_id}
                    player={player}
                    rank={i + 1}
                    onPress={() => router.push({ pathname: "/(trainer)/players", params: { userId: player.user_id } } as any)}
                  />
                ))
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NoTeamState() {
  return (
    <View style={[card, { alignItems: "center", gap: 14, paddingVertical: 40 }]}>
      <View style={{
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: "rgba(99,179,237,0.10)",
        borderWidth: 1.5, borderColor: "rgba(99,179,237,0.25)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="people-outline" size={28} color="rgba(99,179,237,0.70)" />
      </View>
      <Text style={{ color: "white", fontWeight: "900", fontSize: 18, letterSpacing: -0.3 }}>Sin equipo creado</Text>
      <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
        Creá un equipo desde Supabase y asignate{"\n"}el rol de coach en team_members.
      </Text>
    </View>
  );
}

function TeamBanner({ team }: { team: { id: string; name: string; invite_code: string } }) {
  return (
    <View style={{
      borderRadius: 22, overflow: "hidden",
      borderWidth: 1.5, borderColor: "rgba(99,179,237,0.28)",
    }}>
      <View style={{
        backgroundColor: "rgba(99,179,237,0.10)",
        paddingHorizontal: 20, paddingVertical: 18,
        flexDirection: "row", alignItems: "center", gap: 16,
      }}>
        <View style={{
          width: 54, height: 54, borderRadius: 17,
          backgroundColor: "rgba(99,179,237,0.18)",
          borderWidth: 1.5, borderColor: "rgba(99,179,237,0.35)",
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="shield-half-outline" size={26} color="rgba(99,179,237,0.90)" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 19, letterSpacing: -0.4 }}>{team.name}</Text>
          <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 12 }}>
            Código de invitación:{" "}
            <Text style={{ color: "rgba(99,179,237,0.90)", fontWeight: "900", letterSpacing: 1.5 }}>
              {team.invite_code}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

function StatTile({ icon, label, value, valueColor }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={{
      flex: 1, borderRadius: 16, padding: 14, gap: 8,
      backgroundColor: "rgba(255,255,255,0.055)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    }}>
      <Ionicons name={icon} size={17} color="rgba(255,255,255,0.40)" />
      <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 11 }}>{label}</Text>
      <Text style={{ color: valueColor ?? "white", fontWeight: "900", fontSize: 20, letterSpacing: -0.5 }}>
        {value}
      </Text>
    </View>
  );
}

function PlayerRankRow({ player, rank, onPress }: { player: PlayerStat; rank: number; onPress: () => void }) {
  const pct = player.pct;
  const rankColors: Record<number, string> = { 1: "#F59E0B", 2: "#94A3B8", 3: "#CD7C2F" };
  const rankColor = rankColors[rank] ?? "rgba(255,255,255,0.25)";

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
      }}
    >
      <Text style={{ color: rankColor, fontWeight: "900", fontSize: 15, width: 22, textAlign: "center" }}>
        {rank}
      </Text>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.07)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.45)" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>
          {player.display_name ?? `Jugador ${player.user_id.slice(0, 6)}`}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
          {player.sessions} sesiones · {player.attempts} tiros
        </Text>
      </View>
      <View style={{
        width: 52, height: 52, borderRadius: 14,
        backgroundColor: pct !== null ? pctColor(pct).replace("1)", "0.12)") : "rgba(255,255,255,0.05)",
        borderWidth: 1.5,
        borderColor: pct !== null ? pctColor(pct).replace("1)", "0.35)") : "rgba(255,255,255,0.08)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{
          color: pct !== null ? pctColor(pct) : "rgba(255,255,255,0.25)",
          fontWeight: "900", fontSize: 16, letterSpacing: -0.4,
        }}>
          {pct !== null ? `${Math.round(pct * 100)}%` : "–"}
        </Text>
      </View>
    </Pressable>
  );
}
