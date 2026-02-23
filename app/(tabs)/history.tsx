// app/(tabs)/history.tsx
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

type SessionRow = {
  id: string;
  title: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
};

function pctColor(p: number) {
  if (p >= 0.65) return "rgba(34,197,94,1)";
  if (p >= 0.4) return "rgba(245,158,11,1)";
  return "rgba(239,68,68,1)";
}

export default function History() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pcts, setPcts] = useState<Record<string, number | null>>({});

  const loadData = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("sessions")
        .select("id, title, status, started_at, finished_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const rows = (data ?? []) as SessionRow[];
      setSessions(rows);

      // fetch pct for each session
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: spots } = await supabase
          .from("session_spots")
          .select("session_id, attempts, makes")
          .in("session_id", ids);

        const map: Record<string, { att: number; mk: number }> = {};
        (spots ?? []).forEach((s: any) => {
          if (!map[s.session_id]) map[s.session_id] = { att: 0, mk: 0 };
          map[s.session_id].att += s.attempts ?? 0;
          map[s.session_id].mk += s.makes ?? 0;
        });

        const pctMap: Record<string, number | null> = {};
        rows.forEach((r) => {
          const agg = map[r.id];
          pctMap[r.id] = agg && agg.att > 0 ? agg.mk / agg.att : null;
        });
        setPcts(pctMap);
      }
    } catch (e) {
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" colors={["#F59E0B"]} />
        }
      >
        {/* Header */}
        <View style={{ marginBottom: 6 }}>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, letterSpacing: 0.2 }}>Tu actividad</Text>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>Historial</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#F59E0B" style={{ marginTop: 40 }} />
        ) : sessions.length === 0 ? (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 60 }}>
            <View style={{
              width: 54, height: 54, borderRadius: 27,
              backgroundColor: "rgba(255,255,255,0.05)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="basketball-outline" size={26} color="rgba(255,255,255,0.20)" />
            </View>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 14 }}>Sin sesiones aún</Text>
            <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center" }}>
              Completá sesiones para verlas acá.
            </Text>
          </View>
        ) : (
          sessions.map((session) => {
            const pct = pcts[session.id] ?? null;
            const dateStr = session.started_at
              ? new Date(session.started_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
              : null;
            const label = session.title ?? dateStr ?? "Sesión";
            const pctStr = pct !== null ? `${Math.round(pct * 100)}%` : "–";

            return (
              <Pressable
                key={session.id}
                onPress={() => router.push({ pathname: "/session/summary", params: { sessionId: session.id } })}
                style={{
                  padding: 16, borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.055)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
                  flexDirection: "row", alignItems: "center", gap: 14,
                }}
              >
                {/* Pct badge */}
                <View style={{
                  width: 54, height: 54, borderRadius: 15,
                  backgroundColor: pct !== null ? pctColor(pct).replace("1)", "0.12)") : "rgba(255,255,255,0.05)",
                  borderWidth: 1.5,
                  borderColor: pct !== null ? pctColor(pct).replace("1)", "0.35)") : "rgba(255,255,255,0.10)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{
                    color: pct !== null ? pctColor(pct) : "rgba(255,255,255,0.30)",
                    fontWeight: "900", fontSize: 16, letterSpacing: -0.4,
                  }}>
                    {pctStr}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }} numberOfLines={1}>
                    {label}
                  </Text>
                  {dateStr && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.28)" />
                      <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{dateStr}</Text>
                    </View>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.22)" />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
