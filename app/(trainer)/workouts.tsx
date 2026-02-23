// app/(trainer)/workouts.tsx  — Shared workouts from players
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from "react-native";

type SharedWorkout = {
  id: string;
  workout_id: string;
  title: string;
  status: string;
  shared_at: string | null;
  player_name: string | null;
  user_id: string;
};

const card = {
  padding: 18, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;

export default function WorkoutsScreen() {
  const [workouts, setWorkouts]     = useState<SharedWorkout[]>([]);
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

      if (!membership) { setWorkouts([]); return; }
      const teamId = (membership as any).team_id as string;

      // Get shared workouts with workout info
      const { data: shared } = await supabase
        .from("team_workouts")
        .select("id, workout_id, user_id, shared_at, workouts(id, title, status)")
        .eq("team_id", teamId)
        .order("shared_at", { ascending: false });

      const playerIds: string[] = [...new Set((shared ?? []).map((s: any) => s.user_id))];

      // Get player names
      const nameMap: Record<string, string | null> = {};
      if (playerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", playerIds);
        (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.display_name; });
      }

      const result: SharedWorkout[] = (shared ?? []).map((s: any) => ({
        id:          s.id,
        workout_id:  s.workout_id,
        title:       s.workouts?.title ?? "Sin título",
        status:      s.workouts?.status ?? "",
        shared_at:   s.shared_at,
        user_id:     s.user_id,
        player_name: nameMap[s.user_id] ?? null,
      }));

      setWorkouts(result);
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

  // Group by player
  const byPlayer: Record<string, SharedWorkout[]> = {};
  workouts.forEach((w) => {
    const key = w.player_name ?? w.user_id.slice(0, 6);
    if (!byPlayer[key]) byPlayer[key] = [];
    byPlayer[key].push(w);
  });

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
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>Control</Text>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>Planillas</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#F59E0B" style={{ marginTop: 40 }} />
        ) : workouts.length === 0 ? (
          <View style={[card, { alignItems: "center", gap: 12, paddingVertical: 40 }]}>
            <View style={{
              width: 54, height: 54, borderRadius: 27,
              backgroundColor: "rgba(255,255,255,0.05)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="clipboard-outline" size={26} color="rgba(255,255,255,0.18)" />
            </View>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 14 }}>
              Sin planillas compartidas
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center" }}>
              Cuando tus jugadoras compartan planillas{"\n"}aparecerán acá.
            </Text>
          </View>
        ) : (
          Object.entries(byPlayer).map(([playerName, items]) => (
            <View key={playerName} style={[card, { gap: 12 }]}>
              {/* Player header */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: "rgba(245,158,11,0.12)",
                  borderWidth: 1, borderColor: "rgba(245,158,11,0.25)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name="person-outline" size={16} color="rgba(245,158,11,0.80)" />
                </View>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
                  {playerName}
                </Text>
                <View style={{
                  marginLeft: "auto",
                  paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.07)",
                }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700" }}>
                    {items.length} planilla{items.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>

              {/* Workout rows */}
              {items.map((w) => {
                const sharedDate = w.shared_at
                  ? new Date(w.shared_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
                  : null;
                const isDone = w.status === "DONE";

                return (
                  <View
                    key={w.id}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      padding: 12, borderRadius: 14,
                      backgroundColor: "rgba(255,255,255,0.04)",
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
                    }}
                  >
                    <View style={{
                      width: 38, height: 38, borderRadius: 11,
                      backgroundColor: isDone ? "rgba(34,197,94,0.10)" : "rgba(99,179,237,0.10)",
                      borderWidth: 1,
                      borderColor: isDone ? "rgba(34,197,94,0.22)" : "rgba(99,179,237,0.22)",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Ionicons
                        name={isDone ? "checkmark-done-outline" : "clipboard-outline"}
                        size={18}
                        color={isDone ? "rgba(34,197,94,0.70)" : "rgba(99,179,237,0.70)"}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
                        {w.title}
                      </Text>
                      {sharedDate && (
                        <Text style={{ color: "rgba(255,255,255,0.30)", fontSize: 12 }}>
                          Compartida el {sharedDate}
                        </Text>
                      )}
                    </View>
                    <View style={{
                      paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8,
                      backgroundColor: isDone ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                    }}>
                      <Text style={{
                        color: isDone ? "rgba(34,197,94,0.90)" : "rgba(245,158,11,0.90)",
                        fontSize: 11, fontWeight: "800",
                      }}>
                        {isDone ? "Completada" : "En progreso"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
