// app/(tabs)/profile.tsx
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

function pctColor(p: number) {
  if (p >= 0.65) return "rgba(34,197,94,1)";
  if (p >= 0.4) return "rgba(245,158,11,1)";
  return "rgba(239,68,68,1)";
}

const card = {
  padding: 16, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;

export default function Profile() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [totalAttempts, setTotalAttempts] = useState<number | null>(null);
  const [totalMakes, setTotalMakes]       = useState<number | null>(null);
  const [bestPct, setBestPct]             = useState<number | null>(null);

  const initials = useMemo(() => {
    const n = (name || "").trim();
    if (!n) return "";
    const parts = n.split(" ").filter(Boolean);
    const a = parts[0]?.[0]?.toUpperCase() ?? "";
    const b = parts[1]?.[0]?.toUpperCase() ?? "";
    return (a + b) || a || "";
  }, [name]);

  const loadData = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      const meta: any = auth.user?.user_metadata ?? {};
      setName(meta.display_name ?? meta.username ?? "");
      setEmail(auth.user?.email ?? "");
      if (!userId) return;

      // Collect ALL session IDs: free sessions (user_id) + workout sessions (workout_id in user's workouts)
      const { data: userWorkouts } = await supabase
        .from("workouts").select("id").eq("user_id", userId);
      const workoutIds = (userWorkouts ?? []).map((w: any) => w.id as string);

      const [{ data: freeSess }, { data: wkSess }] = await Promise.all([
        supabase.from("sessions").select("id").eq("user_id", userId),
        workoutIds.length > 0
          ? supabase.from("sessions").select("id").in("workout_id", workoutIds)
          : Promise.resolve({ data: [] }),
      ]);

      const ids = [
        ...new Set([
          ...(freeSess ?? []).map((s: any) => s.id as string),
          ...(wkSess  ?? []).map((s: any) => s.id as string),
        ]),
      ];
      setTotalSessions(ids.length);

      if (ids.length > 0) {
        const { data: spots } = await supabase
          .from("session_spots")
          .select("session_id, attempts, makes")
          .in("session_id", ids);

        const sp = (spots ?? []) as { session_id: string; attempts: number; makes: number }[];
        const att = sp.reduce((a, s) => a + (s.attempts ?? 0), 0);
        const mk  = sp.reduce((a, s) => a + (s.makes ?? 0), 0);
        setTotalAttempts(att);
        setTotalMakes(mk);

        // best session pct
        const bySession: Record<string, { att: number; mk: number }> = {};
        sp.forEach((s) => {
          if (!bySession[s.session_id]) bySession[s.session_id] = { att: 0, mk: 0 };
          bySession[s.session_id].att += s.attempts ?? 0;
          bySession[s.session_id].mk += s.makes ?? 0;
        });
        const pcts = Object.values(bySession)
          .filter((v) => v.att > 0)
          .map((v) => v.mk / v.att);
        setBestPct(pcts.length > 0 ? Math.max(...pcts) : null);
      }
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

  async function onLogout() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await supabase.auth.signOut();
  }

  function onDeleteAccount() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Eliminar cuenta",
      "Esto borrará permanentemente todas tus planillas, sesiones y datos. ¿Estás seguro?",
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

              // Delete spots for ALL sessions (free + workout)
              const { data: userWorkouts } = await supabase
                .from("workouts").select("id").eq("user_id", userId);
              const workoutIds = (userWorkouts ?? []).map((w: any) => w.id as string);

              const [{ data: freeSess }, { data: wkSess }] = await Promise.all([
                supabase.from("sessions").select("id").eq("user_id", userId),
                workoutIds.length > 0
                  ? supabase.from("sessions").select("id").in("workout_id", workoutIds)
                  : Promise.resolve({ data: [] as any[] }),
              ]);
              const allSessionIds = [
                ...new Set([
                  ...(freeSess ?? []).map((s: any) => s.id as string),
                  ...(wkSess  ?? []).map((s: any) => s.id as string),
                ]),
              ];

              if (allSessionIds.length > 0) {
                await supabase.from("session_spots").delete().in("session_id", allSessionIds);
                await supabase.from("sessions").delete().in("id", allSessionIds);
              }
              if (workoutIds.length > 0) {
                await supabase.from("workouts").delete().in("id", workoutIds);
              }
              await supabase.from("team_members").delete().eq("user_id", userId);
              await supabase.from("profiles").delete().eq("id", userId);
              // Eliminar el registro de autenticación (requerido por Apple)
              await supabase.rpc("delete_own_auth_user");
              await supabase.auth.signOut();
            } catch {
              Alert.alert("Error", "No se pudo eliminar la cuenta.");
            }
          },
        },
      ]
    );
  }

  const overallPct = totalAttempts && totalAttempts > 0 && totalMakes != null
    ? totalMakes / totalAttempts
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" colors={["#F59E0B"]} />
        }
      >
        {/* Header */}
        <View style={{ marginBottom: 6 }}>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, letterSpacing: 0.2 }}>Tu cuenta</Text>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>Perfil</Text>
        </View>

        {/* Avatar + name */}
        <View style={[card, { alignItems: "center", paddingVertical: 28, gap: 12 }]}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: "rgba(245,158,11,0.15)",
            borderWidth: 2, borderColor: "rgba(245,158,11,0.40)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: "#F59E0B", fontWeight: "900", fontSize: 26 }}>
              {initials || "🏀"}
            </Text>
          </View>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 20, letterSpacing: -0.4 }}>
              {name || "Jugador/a"}
            </Text>
            {email ? (
              <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 13 }}>{email}</Text>
            ) : null}
          </View>
        </View>

        {/* Stats */}
        <View style={[card, { gap: 16 }]}>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
            Estadísticas globales
          </Text>

          {loading ? (
            <ActivityIndicator color="#F59E0B" />
          ) : (
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <StatPill icon="basketball-outline" label="Sesiones" value={String(totalSessions ?? "–")} />
              <StatPill icon="radio-button-on-outline" label="Tiros" value={String(totalAttempts ?? "–")} />
              <StatPill icon="checkmark-circle-outline" label="Metidos" value={String(totalMakes ?? "–")} />
              {overallPct !== null && (
                <StatPill
                  icon="trending-up-outline"
                  label="% Global"
                  value={`${Math.round(overallPct * 100)}%`}
                  valueColor={pctColor(overallPct)}
                />
              )}
              {bestPct !== null && (
                <StatPill
                  icon="trophy-outline"
                  label="Mejor sesión"
                  value={`${Math.round(bestPct * 100)}%`}
                  valueColor={pctColor(bestPct)}
                />
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
            backgroundColor: "rgba(239,68,68,0.10)",
            borderWidth: 1, borderColor: "rgba(239,68,68,0.28)",
          }}
        >
          <Ionicons name="log-out-outline" size={19} color="rgba(239,68,68,0.90)" />
          <Text style={{ color: "rgba(239,68,68,0.90)", fontWeight: "800", fontSize: 15 }}>
            Cerrar sesión
          </Text>
        </Pressable>

        {/* Delete account */}
        <Pressable
          onPress={onDeleteAccount}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
            height: 48, borderRadius: 16,
            backgroundColor: "transparent",
            borderWidth: 1, borderColor: "rgba(239,68,68,0.18)",
          }}
        >
          <Ionicons name="trash-outline" size={16} color="rgba(239,68,68,0.50)" />
          <Text style={{ color: "rgba(239,68,68,0.50)", fontWeight: "700", fontSize: 13 }}>
            Eliminar cuenta
          </Text>
        </Pressable>

        {/* Privacy policy */}
        <Pressable
          onPress={() => router.push("/privacy")}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,0.22)" />
          <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
            Política de privacidad
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({
  icon, label, value, valueColor,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={{
      flex: 1, minWidth: "44%", padding: 14, borderRadius: 16, gap: 8,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    }}>
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.40)" />
      <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 12 }}>{label}</Text>
      <Text style={{ color: valueColor ?? "white", fontWeight: "900", fontSize: 22, letterSpacing: -0.5 }}>
        {value}
      </Text>
    </View>
  );
}
