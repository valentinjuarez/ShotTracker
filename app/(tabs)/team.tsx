// app/(tabs)/team.tsx
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type Team = {
  id: string;
  name: string;
  invite_code: string;
};

type MemberRow = {
  id: string;
  user_id: string;
  role: "player" | "coach";
  joined_at: string;
  display_name: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  return { scale, onIn, onOut };
}

const card = {
  padding: 20, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TeamScreen() {
  const [userId, setUserId]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Team state
  const [team, setTeam]           = useState<Team | null>(null);
  const [members, setMembers]     = useState<MemberRow[]>([]);
  const [myRole, setMyRole]       = useState<"player" | "coach" | null>(null);

  // Join flow
  const [codeInput, setCodeInput] = useState("");
  const [joining, setJoining]     = useState(false);
  const [leaving, setLeaving]     = useState(false);

  // DB error (tables may not exist yet)
  const [dbError, setDbError]     = useState(false);

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;

      const { data: membership, error } = await supabase
        .from("team_members")
        .select("id, team_id, user_id, role, joined_at, teams(id, name, invite_code)")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        // Table doesn't exist yet — show "coming soon" state
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setDbError(true);
        }
        setTeam(null);
        return;
      }

      setDbError(false);

      if (!membership) {
        setTeam(null);
        setMyRole(null);
        setMembers([]);
        return;
      }

      const t = (membership as any).teams as Team;
      setTeam(t);
      setMyRole((membership as any).role ?? "player");

      // Load teammates
      const { data: allMembers } = await supabase
        .from("team_members")
        .select("id, user_id, role, joined_at")
        .eq("team_id", t.id)
        .order("joined_at", { ascending: true });

      // Fetch display names from profiles
      const memberIds = (allMembers ?? []).map((m: any) => m.user_id);
      let nameMap: Record<string, string | null> = {};
      if (memberIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", memberIds);
        (profileRows ?? []).forEach((p: any) => { nameMap[p.id] = p.display_name; });
      }

      setMembers(
        (allMembers ?? []).map((m: any) => ({
          ...m,
          display_name: nameMap[m.user_id] ?? null,
        })) as MemberRow[]
      );
    } catch {
      setTeam(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
    }
  }, [fadeAnim]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Join team ──────────────────────────────────────────────────────────────

  async function joinTeam() {
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      Alert.alert("Código vacío", "Ingresá el código que te envió tu entrenador.");
      return;
    }
    if (!userId) return;
    try {
      setJoining(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { data, error } = await supabase
        .rpc("join_team_by_code", { invite_code: code });

      if (error) throw error;

      if (data?.error === "team_not_found") {
        Alert.alert("Código inválido", "No encontramos ningún equipo con ese código. Verificá con tu entrenador.");
        return;
      }

      if (data?.error === "already_member") {
        Alert.alert("Ya sos parte", "Ya estás unido/a a este equipo.");
        await loadData();
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCodeInput("");
      await loadData();
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e?.message ?? "No se pudo unir al equipo.");
    } finally {
      setJoining(false);
    }
  }

  // ─── Leave team ─────────────────────────────────────────────────────────────

  function confirmLeave() {
    Alert.alert(
      "Salir del equipo",
      "¿Estás segura? Dejará de aparecer en las estadísticas del entrenador.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Salir", style: "destructive", onPress: leaveTeam },
      ]
    );
  }

  async function leaveTeam() {
    if (!userId || !team) return;
    try {
      setLeaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", team.id)
        .eq("user_id", userId);

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTeam(null);
      setMembers([]);
      setMyRole(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo salir del equipo.");
    } finally {
      setLeaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44, gap: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
          <View style={{ marginBottom: 4 }}>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, letterSpacing: 0.2 }}>
              Colaboración
            </Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>
              Mi equipo
            </Text>
          </View>

          {loading ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <ActivityIndicator color="#F59E0B" size="large" />
              <Text style={{ color: "rgba(255,255,255,0.40)", marginTop: 14, fontSize: 13 }}>
                Cargando…
              </Text>
            </View>
          ) : dbError ? (
            <DbErrorState />
          ) : team ? (
            <Animated.View style={{ opacity: fadeAnim, gap: 18 }}>
              <TeamCard team={team} memberCount={members.length} myRole={myRole} />
              <MembersCard members={members} userId={userId} />
              <SharedSection team={team} userId={userId} />
              <LeaveBtn onPress={confirmLeave} loading={leaving} />
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim, gap: 18 }}>
              <NoTeamHero />
              <JoinCard
                code={codeInput}
                onCodeChange={setCodeInput}
                onJoin={joinTeam}
                joining={joining}
              />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DbErrorState() {
  return (
    <View style={[card, { alignItems: "center", gap: 14, paddingVertical: 36 }]}>
      <View style={{
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: "rgba(245,158,11,0.10)", borderWidth: 1.5, borderColor: "rgba(245,158,11,0.25)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="construct-outline" size={26} color="rgba(245,158,11,0.80)" />
      </View>
      <Text style={{ color: "white", fontWeight: "900", fontSize: 18, letterSpacing: -0.3 }}>
        Próximamente
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
        La funcionalidad de equipos está en desarrollo.{"\n"}Pronto podrás unirte a tu equipo.
      </Text>
    </View>
  );
}

function NoTeamHero() {
  return (
    <View style={[card, { alignItems: "center", gap: 16, paddingVertical: 32 }]}>
      {/* Icon ring */}
      <View style={{
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: "rgba(99,179,237,0.10)",
        borderWidth: 2, borderColor: "rgba(99,179,237,0.25)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="people-outline" size={34} color="rgba(99,179,237,0.80)" />
      </View>

      <View style={{ alignItems: "center", gap: 6 }}>
        <Text style={{ color: "white", fontWeight: "900", fontSize: 20, letterSpacing: -0.4 }}>
          Sin equipo todavía
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
          Usá el código que te envía tu entrenador{"\n"}para unirte y compartir tus planillas.
        </Text>
      </View>

      {/* Feature pills */}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
        {[
          { icon: "stats-chart-outline", label: "Stats en tiempo real" },
          { icon: "clipboard-outline",   label: "Planillas compartidas" },
          { icon: "eye-outline",         label: "Control del entrenador" },
        ].map((f) => (
          <View
            key={f.label}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
            }}
          >
            <Ionicons name={f.icon as any} size={12} color="rgba(255,255,255,0.45)" />
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{f.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function JoinCard({
  code, onCodeChange, onJoin, joining,
}: {
  code: string;
  onCodeChange: (v: string) => void;
  onJoin: () => void;
  joining: boolean;
}) {
  const { scale, onIn, onOut } = usePressScale();

  return (
    <View style={[card, { gap: 16 }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: "white", fontWeight: "900", fontSize: 16, letterSpacing: -0.2 }}>
          Unirse con código
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 13 }}>
          Pedí el código a tu entrenador/a e ingresalo acá.
        </Text>
      </View>

      {/* Input */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        height: 52, borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)",
        paddingHorizontal: 16,
      }}>
        <Ionicons name="key-outline" size={18} color="rgba(255,255,255,0.35)" />
        <TextInput
          value={code}
          onChangeText={(t) => onCodeChange(t.toUpperCase())}
          placeholder="Ej: EQUIPO2025"
          placeholderTextColor="rgba(255,255,255,0.25)"
          autoCapitalize="characters"
          autoCorrect={false}
          style={{
            flex: 1, color: "white", fontWeight: "800",
            fontSize: 16, letterSpacing: 1.5,
          }}
        />
        {code.length > 0 && (
          <Pressable onPress={() => onCodeChange("")}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.30)" />
          </Pressable>
        )}
      </View>

      {/* Join button */}
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={onIn}
          onPressOut={onOut}
          onPress={onJoin}
          disabled={joining || code.trim().length === 0}
          style={{
            height: 52, borderRadius: 14,
            backgroundColor: code.trim().length > 0 ? "rgba(99,179,237,1)" : "rgba(99,179,237,0.20)",
            alignItems: "center", justifyContent: "center",
            flexDirection: "row", gap: 10,
          }}
        >
          {joining ? (
            <ActivityIndicator color="#0B1220" />
          ) : (
            <>
              <Ionicons
                name="enter-outline"
                size={20}
                color={code.trim().length > 0 ? "#0B1220" : "rgba(99,179,237,0.50)"}
              />
              <Text style={{
                color: code.trim().length > 0 ? "#0B1220" : "rgba(99,179,237,0.50)",
                fontWeight: "900", fontSize: 15,
              }}>
                Unirse al equipo
              </Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

function TeamCard({
  team, memberCount, myRole,
}: {
  team: Team; memberCount: number; myRole: "player" | "coach" | null;
}) {
  return (
    <View style={{
      borderRadius: 22, overflow: "hidden",
      borderWidth: 1.5, borderColor: "rgba(99,179,237,0.28)",
    }}>
      {/* Banner */}
      <View style={{
        backgroundColor: "rgba(99,179,237,0.12)",
        paddingHorizontal: 20, paddingVertical: 22,
        flexDirection: "row", alignItems: "center", gap: 16,
      }}>
        <View style={{
          width: 64, height: 64, borderRadius: 20,
          backgroundColor: "rgba(99,179,237,0.20)",
          borderWidth: 2, borderColor: "rgba(99,179,237,0.40)",
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="shield-half-outline" size={30} color="rgba(99,179,237,0.90)" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 20, letterSpacing: -0.4 }}>
            {team.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{
              paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999,
              backgroundColor: "rgba(34,197,94,0.15)",
              borderWidth: 1, borderColor: "rgba(34,197,94,0.30)",
            }}>
              <Text style={{ color: "rgba(34,197,94,0.90)", fontWeight: "800", fontSize: 11 }}>
                ● Activo
              </Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 12 }}>
              {memberCount} integrante{memberCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      </View>

      {/* Meta row */}
      <View style={{
        flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
        backgroundColor: "rgba(255,255,255,0.03)",
      }}>
        <MetaCell icon="person-outline" label="Tu rol" value={myRole === "coach" ? "Entrenador/a" : "Jugador/a"} />
        <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.07)" }} />
        <MetaCell icon="key-outline" label="Código" value={team.invite_code} mono />
      </View>
    </View>
  );
}

function MetaCell({
  icon, label, value, mono,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string; value: string; mono?: boolean;
}) {
  return (
    <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Ionicons name={icon} size={11} color="rgba(255,255,255,0.35)" />
        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 0.3 }}>{label}</Text>
      </View>
      <Text style={{
        color: "white", fontWeight: mono ? "900" : "800", fontSize: 14,
        letterSpacing: mono ? 1.5 : 0,
      }}>
        {value}
      </Text>
    </View>
  );
}

function MembersCard({ members, userId }: { members: MemberRow[]; userId: string | null }) {
  const coaches = members.filter((m) => m.role === "coach");
  const players = members.filter((m) => m.role === "player");

  return (
    <View style={[card, { gap: 14 }]}>
      <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
        Integrantes · {members.length}
      </Text>

      {coaches.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>
            Entrenador/a
          </Text>
          {coaches.map((m) => (
            <MemberRow key={m.id} member={m} isMe={m.user_id === userId} />
          ))}
        </View>
      )}

      {players.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>
            Jugadores
          </Text>
          {players.map((m) => (
            <MemberRow key={m.id} member={m} isMe={m.user_id === userId} />
          ))}
        </View>
      )}
    </View>
  );
}

function MemberRow({ member, isMe }: { member: MemberRow; isMe: boolean }) {
  const joinDate = member.joined_at
    ? new Date(member.joined_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    : null;

  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
      backgroundColor: isMe ? "rgba(245,158,11,0.07)" : "rgba(255,255,255,0.03)",
      borderWidth: 1,
      borderColor: isMe ? "rgba(245,158,11,0.20)" : "rgba(255,255,255,0.07)",
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: isMe ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.07)",
        borderWidth: 1, borderColor: isMe ? "rgba(245,158,11,0.30)" : "rgba(255,255,255,0.10)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons
          name="person-outline"
          size={16}
          color={isMe ? "rgba(245,158,11,0.90)" : "rgba(255,255,255,0.45)"}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          color: isMe ? "#F59E0B" : "white",
          fontWeight: "800", fontSize: 14,
        }}>
          {isMe ? "Vos" : (member.display_name ?? `${member.user_id.slice(0, 6)}…`)}
        </Text>
        {joinDate && (
          <Text style={{ color: "rgba(255,255,255,0.30)", fontSize: 12 }}>
            Desde {joinDate}
          </Text>
        )}
      </View>
      {isMe && (
        <View style={{
          paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999,
          backgroundColor: "rgba(245,158,11,0.15)",
        }}>
          <Text style={{ color: "#F59E0B", fontWeight: "800", fontSize: 11 }}>Tú</Text>
        </View>
      )}
    </View>
  );
}

function SharedSection({ team, userId }: { team: Team; userId: string | null }) {
  const [sharedWorkouts, setSharedWorkouts] = useState<{ id: string; title: string; status: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const loadShared = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      // Load only workouts already shared with THIS team
      const { data } = await supabase
        .from("team_workouts")
        .select("workout_id, workouts(id, title, status)")
        .eq("team_id", team.id)
        .eq("user_id", userId);
      const rows = (data ?? []).map((r: any) => r.workouts).filter(Boolean);
      setSharedWorkouts(rows as any[]);
    } catch {
      setSharedWorkouts([]);
    } finally {
      setLoading(false);
    }
  }, [userId, team.id]);

  useEffect(() => { loadShared(); }, [loadShared]);

  return (
    <View style={[card, { gap: 16 }]}>
      {/* Header row */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
            Planillas compartidas
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 13 }}>
            Visibles para tu entrenador/a.
          </Text>
        </View>
        <Pressable
          onPress={() => setShowPicker(true)}
          style={{
            flexDirection: "row", alignItems: "center", gap: 6,
            paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12,
            backgroundColor: "rgba(99,179,237,0.15)",
            borderWidth: 1, borderColor: "rgba(99,179,237,0.30)",
          }}
        >
          <Ionicons name="share-outline" size={14} color="rgba(99,179,237,0.90)" />
          <Text style={{ color: "rgba(99,179,237,0.90)", fontWeight: "800", fontSize: 13 }}>
            Compartir
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#F59E0B" style={{ alignSelf: "flex-start" }} />
      ) : sharedWorkouts.length === 0 ? (
        <View style={{
          alignItems: "center", gap: 8, paddingVertical: 18,
          borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
          borderStyle: "dashed", backgroundColor: "rgba(255,255,255,0.02)",
        }}>
          <Ionicons name="clipboard-outline" size={24} color="rgba(255,255,255,0.18)" />
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            Todavía no compartiste ninguna planilla.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {sharedWorkouts.map((w) => (
            <SharedWorkoutRow
              key={w.id}
              workout={w}
              teamId={team.id}
              userId={userId}
              onUnshared={loadShared}
            />
          ))}
        </View>
      )}

      {showPicker && (
        <SharePickerModal
          team={team}
          userId={userId}
          alreadyShared={sharedWorkouts.map((w) => w.id)}
          onClose={() => setShowPicker(false)}
          onShared={loadShared}
        />
      )}
    </View>
  );
}

function SharedWorkoutRow({
  workout, teamId, userId, onUnshared,
}: {
  workout: { id: string; title: string; status: string };
  teamId: string;
  userId: string | null;
  onUnshared: () => void;
}) {
  const [unsharing, setUnsharing] = useState(false);

  function confirmUnshare() {
    Alert.alert(
      "Dejar de compartir",
      `¿Querés dejar de compartir "${workout.title}" con el equipo?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Dejar de compartir", style: "destructive", onPress: doUnshare },
      ]
    );
  }

  async function doUnshare() {
    if (!userId) return;
    try {
      setUnsharing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await supabase
        .from("team_workouts")
        .delete()
        .eq("team_id", teamId)
        .eq("workout_id", workout.id)
        .eq("user_id", userId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUnshared();
    } catch {
      Alert.alert("Error", "No se pudo dejar de compartir. Intentá de nuevo.");
    } finally {
      setUnsharing(false);
    }
  }

  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 12, borderRadius: 14,
      backgroundColor: "rgba(34,197,94,0.05)",
      borderWidth: 1, borderColor: "rgba(34,197,94,0.18)",
    }}>
      <View style={{
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: "rgba(34,197,94,0.10)",
        borderWidth: 1, borderColor: "rgba(34,197,94,0.22)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="checkmark-circle-outline" size={18} color="rgba(34,197,94,0.70)" />
      </View>
      <Text style={{ flex: 1, color: "white", fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
        {workout.title}
      </Text>
      <View style={{
        paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999,
        backgroundColor: "rgba(34,197,94,0.10)",
        borderWidth: 1, borderColor: "rgba(34,197,94,0.22)",
      }}>
        <Text style={{ color: "rgba(34,197,94,0.80)", fontWeight: "800", fontSize: 11 }}>Compartida</Text>
      </View>
      <Pressable
        onPress={confirmUnshare}
        disabled={unsharing}
        style={{
          width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(239,68,68,0.08)",
          borderWidth: 1, borderColor: "rgba(239,68,68,0.22)",
          marginLeft: 4,
        }}
      >
        {unsharing
          ? <ActivityIndicator size="small" color="rgba(239,68,68,0.70)" />
          : <Ionicons name="trash-outline" size={15} color="rgba(239,68,68,0.70)" />
        }
      </Pressable>
    </View>
  );
}

function SharePickerModal({
  team, userId, alreadyShared, onClose, onShared,
}: {
  team: Team;
  userId: string | null;
  alreadyShared: string[];
  onClose: () => void;
  onShared: () => void;
}) {
  const [workouts, setWorkouts] = useState<{ id: string; title: string; status: string; shot_type: string; sessions_goal: number; created_at: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [sharing, setSharing]   = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!userId) return;
      try {
        const { data } = await supabase
          .from("workouts")
          .select("id, title, status, shot_type, sessions_goal, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        setWorkouts((data ?? []) as any[]);
      } catch {
        setWorkouts([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  async function share(w: { id: string; title: string; status: string; shot_type: string; sessions_goal: number }) {
    if (!userId) return;
    try {
      setSharing(w.id);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await supabase.from("team_workouts").upsert({
        team_id: team.id,
        workout_id: w.id,
        user_id: userId,
        workout_title: w.title,
        workout_status: w.status,
        shot_type: w.shot_type,
        sessions_goal: w.sessions_goal,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Compartida ✓", `"${w.title}" ya es visible para tu entrenador/a.`);
      onShared();
      onClose();
    } catch {
      Alert.alert("Error", "No se pudo compartir. Intentá de nuevo.");
    } finally {
      setSharing(null);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
        <View style={{
          backgroundColor: "#111827",
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
          paddingTop: 12, paddingBottom: 40, maxHeight: "80%",
        }}>
          {/* Handle */}
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: "rgba(255,255,255,0.18)",
            alignSelf: "center", marginBottom: 18,
          }} />

          {/* Title row */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 22, marginBottom: 18 }}>
            <Text style={{ flex: 1, color: "white", fontWeight: "900", fontSize: 18, letterSpacing: -0.3 }}>
              Seleccioná una planilla
            </Text>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="close-outline" size={24} color="rgba(255,255,255,0.50)" />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color="#F59E0B" style={{ alignSelf: "center", marginTop: 30 }} />
          ) : workouts.length === 0 ? (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 32 }}>
              <Ionicons name="clipboard-outline" size={32} color="rgba(255,255,255,0.18)" />
              <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 14 }}>No tenés planillas creadas.</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {workouts.map((w) => {
                const isShared = alreadyShared.includes(w.id);
                return (
                  <View
                    key={w.id}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      padding: 14, borderRadius: 16,
                      backgroundColor: isShared ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.04)",
                      borderWidth: 1, borderColor: isShared ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: isShared ? "rgba(34,197,94,0.12)" : "rgba(99,179,237,0.10)",
                      borderWidth: 1, borderColor: isShared ? "rgba(34,197,94,0.25)" : "rgba(99,179,237,0.22)",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Ionicons
                        name={isShared ? "checkmark-outline" : "clipboard-outline"}
                        size={18}
                        color={isShared ? "rgba(34,197,94,0.80)" : "rgba(99,179,237,0.70)"}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
                        {w.title}
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                        {isShared ? "Ya compartida con el equipo" : fmtDate(w.created_at)}
                      </Text>
                    </View>
                    {!isShared ? (
                      <Pressable
                        onPress={() => share(w)}
                        disabled={sharing === w.id}
                        style={{
                          paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10,
                          backgroundColor: "rgba(99,179,237,0.15)",
                          borderWidth: 1, borderColor: "rgba(99,179,237,0.30)",
                          minWidth: 84, alignItems: "center",
                        }}
                      >
                        {sharing === w.id ? (
                          <ActivityIndicator size="small" color="rgba(99,179,237,1)" />
                        ) : (
                          <Text style={{ color: "rgba(99,179,237,0.90)", fontWeight: "800", fontSize: 12 }}>
                            Compartir
                          </Text>
                        )}
                      </Pressable>
                    ) : (
                      <View style={{
                        paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10,
                        backgroundColor: "rgba(34,197,94,0.10)",
                        borderWidth: 1, borderColor: "rgba(34,197,94,0.22)",
                        minWidth: 84, alignItems: "center",
                      }}>
                        <Text style={{ color: "rgba(34,197,94,0.80)", fontWeight: "800", fontSize: 12 }}>
                          Enviada ✓
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function LeaveBtn({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={{
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        height: 50, borderRadius: 16,
        backgroundColor: "rgba(239,68,68,0.08)",
        borderWidth: 1, borderColor: "rgba(239,68,68,0.22)",
      }}
    >
      {loading ? (
        <ActivityIndicator color="rgba(239,68,68,0.80)" />
      ) : (
        <>
          <Ionicons name="exit-outline" size={18} color="rgba(239,68,68,0.80)" />
          <Text style={{ color: "rgba(239,68,68,0.80)", fontWeight: "800", fontSize: 14 }}>
            Salir del equipo
          </Text>
        </>
      )}
    </Pressable>
  );
}
