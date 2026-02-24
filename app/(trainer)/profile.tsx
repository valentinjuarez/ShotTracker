// app/(trainer)/profile.tsx  — Coach profile
import { useProfile } from "@/src/hooks/useProfile";
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from "react-native";

const card = {
  padding: 18, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;

export default function CoachProfile() {
  const { profile, loading: profileLoading, refetch } = useProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [teamStats, setTeamStats]   = useState<{
    players: number; totalSessions: number; totalAttempts: number; teamPct: number | null;
  } | null>(null);
  const [teamId, setTeamId]         = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name)")
        .eq("user_id", userId)
        .eq("role", "coach")
        .maybeSingle();

      if (!membership) { setTeamStats(null); setTeamId(null); return; }
      const tId = (membership as any).team_id as string;
      setTeamId(tId);

      const { data: members } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", tId)
        .eq("role", "player");

      const playerIds: string[] = (members ?? []).map((m: any) => m.user_id);

      let totalSessions = 0;
      let totalAttempts = 0;
      let totalMakes    = 0;

      if (playerIds.length > 0) {
        const { data: sessions } = await supabase
          .from("sessions")
          .select("id")
          .in("user_id", playerIds);

        const sessionIds = (sessions ?? []).map((s: any) => s.id);
        totalSessions = sessionIds.length;

        if (sessionIds.length > 0) {
          const { data: spots } = await supabase
            .from("session_spots")
            .select("attempts, makes")
            .in("session_id", sessionIds);

          totalAttempts = (spots ?? []).reduce((a: number, s: any) => a + (s.attempts ?? 0), 0);
          totalMakes    = (spots ?? []).reduce((a: number, s: any) => a + (s.makes    ?? 0), 0);
        }
      }

      setTeamStats({
        players:       playerIds.length,
        totalSessions,
        totalAttempts,
        teamPct: totalAttempts > 0 ? totalMakes / totalAttempts : null,
      });
    } catch {
      setTeamStats(null);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), loadStats()]);
    setRefreshing(false);
  }, [refetch, loadStats]);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function onLogout() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await supabase.auth.signOut();
  }

  function onDeleteTeam() {
    if (!teamId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Eliminar equipo",
      "Esto borrará el equipo y removerá a todos los jugadores. ¿Estás seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar equipo",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.from("team_members").delete().eq("team_id", teamId);
              await supabase.from("teams").delete().eq("id", teamId);
              setTeamStats(null);
              setTeamId(null);
            } catch {
              Alert.alert("Error", "No se pudo eliminar el equipo.");
            }
          },
        },
      ]
    );
  }

  function onDeleteAccount() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Eliminar cuenta",
      "Esto borrará permanentemente tu cuenta y todos los datos. ¿Estás seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar todo",
          style: "destructive",
          onPress: async () => {
            try {
              const { data: auth } = await supabase.auth.getUser();
              const userId = auth.user?.id;
              if (!userId) return;
              if (teamId) {
                await supabase.from("team_members").delete().eq("team_id", teamId);
                await supabase.from("teams").delete().eq("id", teamId);
              }
              await supabase.from("team_members").delete().eq("user_id", userId);
              await supabase.from("profiles").delete().eq("id", userId);
              await supabase.auth.signOut();
            } catch {
              Alert.alert("Error", "No se pudo eliminar la cuenta.");
            }
          },
        },
      ]
    );
  }

  function pctColor(p: number) {
    if (p >= 0.65) return "rgba(34,197,94,1)";
    if (p >= 0.40) return "rgba(245,158,11,1)";
    return "rgba(239,68,68,1)";
  }

  const displayName = profile?.display_name ?? "Entrenador/a";
  const initials = displayName.split(" ").filter(Boolean).map((w: string) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44, gap: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" colors={["#F59E0B"]} />
        }
      >
        <View style={{ marginBottom: 4 }}>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>Tu cuenta</Text>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>Perfil</Text>
        </View>

        {/* Avatar */}
        <View style={[card, { alignItems: "center", paddingVertical: 28, gap: 12 }]}>
          <View style={{
            width: 76, height: 76, borderRadius: 38,
            backgroundColor: "rgba(99,179,237,0.12)",
            borderWidth: 2, borderColor: "rgba(99,179,237,0.35)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: "rgba(99,179,237,1)", fontWeight: "900", fontSize: 26 }}>
              {initials || "🏅"}
            </Text>
          </View>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 20, letterSpacing: -0.4 }}>
              {displayName}
            </Text>
            <View style={{
              paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999,
              backgroundColor: "rgba(99,179,237,0.12)",
              borderWidth: 1, borderColor: "rgba(99,179,237,0.28)",
            }}>
              <Text style={{ color: "rgba(99,179,237,0.90)", fontWeight: "800", fontSize: 12 }}>
                Entrenador/a
              </Text>
            </View>
          </View>
        </View>

        {/* Team stats */}
        <View style={[card, { gap: 14 }]}>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
            Estadísticas del equipo
          </Text>
          {loadingStats ? (
            <ActivityIndicator color="#F59E0B" />
          ) : !teamStats ? (
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
              Sin datos de equipo aún.
            </Text>
          ) : (
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {[
                { icon: "people-outline",      label: "Jugadoras",   value: String(teamStats.players) },
                { icon: "basketball-outline",  label: "Sesiones",    value: String(teamStats.totalSessions) },
                { icon: "radio-button-on-outline", label: "Tiros",   value: String(teamStats.totalAttempts) },
              ].map((s) => (
                <View key={s.label} style={{
                  flex: 1, minWidth: "44%", padding: 14, borderRadius: 16, gap: 8,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                }}>
                  <Ionicons name={s.icon as any} size={18} color="rgba(255,255,255,0.38)" />
                  <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>{s.label}</Text>
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 22, letterSpacing: -0.5 }}>{s.value}</Text>
                </View>
              ))}
              {teamStats.teamPct !== null && (
                <View style={{
                  flex: 1, minWidth: "44%", padding: 14, borderRadius: 16, gap: 8,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                }}>
                  <Ionicons name="trending-up-outline" size={18} color="rgba(255,255,255,0.38)" />
                  <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>% Equipo</Text>
                  <Text style={{
                    color: pctColor(teamStats.teamPct),
                    fontWeight: "900", fontSize: 22, letterSpacing: -0.5,
                  }}>
                    {Math.round(teamStats.teamPct * 100)}%
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Logout */}
        <Pressable
          onPress={onLogout}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
            height: 52, borderRadius: 16,
            backgroundColor: "rgba(239,68,68,0.08)",
            borderWidth: 1, borderColor: "rgba(239,68,68,0.22)",
          }}
        >
          <Ionicons name="log-out-outline" size={19} color="rgba(239,68,68,0.85)" />
          <Text style={{ color: "rgba(239,68,68,0.85)", fontWeight: "800", fontSize: 15 }}>
            Cerrar sesión
          </Text>
        </Pressable>

        {/* Delete team */}
        {teamId && (
          <Pressable
            onPress={onDeleteTeam}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
              height: 48, borderRadius: 16,
              backgroundColor: "transparent",
              borderWidth: 1, borderColor: "rgba(239,68,68,0.22)",
            }}
          >
            <Ionicons name="people-outline" size={16} color="rgba(239,68,68,0.55)" />
            <Text style={{ color: "rgba(239,68,68,0.55)", fontWeight: "700", fontSize: 13 }}>
              Eliminar equipo
            </Text>
          </Pressable>
        )}

        {/* Delete account */}
        <Pressable
          onPress={onDeleteAccount}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
            height: 48, borderRadius: 16,
            backgroundColor: "transparent",
            borderWidth: 1, borderColor: "rgba(239,68,68,0.14)",
          }}
        >
          <Ionicons name="trash-outline" size={16} color="rgba(239,68,68,0.40)" />
          <Text style={{ color: "rgba(239,68,68,0.40)", fontWeight: "700", fontSize: 13 }}>
            Eliminar cuenta
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
