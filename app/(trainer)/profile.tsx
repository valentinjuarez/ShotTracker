// app/(trainer)/profile.tsx  — Coach profile
import { deleteOwnAuthUser, getCurrentUserId, signOut } from "@/src/features/auth/services/auth.service";
import { updateUserAvatar } from "@/src/features/profile/services/profile.service";
import { deleteCoachAccount, deleteTeam, getCoachTeamId, getTeamStats } from "@/src/features/team/services/team.service";
import { useAutoRefreshOnFocus } from "@/src/hooks/useAutoRefreshOnFocus";
import { useProfile } from "@/src/hooks/useProfile";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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
  const { profile, refetch } = useProfile();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [teamStats, setTeamStats]   = useState<{
    players: number; totalSessions: number; totalAttempts: number; teamPct: number | null;
  } | null>(null);
  const [teamId, setTeamId]         = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;

      const stats = await getTeamStats(userId);
      const coachTeamId = await getCoachTeamId(userId);
      setTeamId(coachTeamId);
      if (stats) {
        setTeamStats(stats);
      } else {
        setTeamStats(null);
      }
    } catch {
      setTeamStats(null);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, []);

  useAutoRefreshOnFocus(loadStats, { intervalMs: 30000 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), loadStats()]);
    setRefreshing(false);
  }, [refetch, loadStats]);

  async function onPickAvatar() {
    try {
      setAvatarError(null);
      setAvatarStatus(null);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        const msg = "Habilita acceso a fotos para cargar tu avatar.";
        setAvatarError(msg);
        Alert.alert("Permiso requerido", msg);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const userId = await getCurrentUserId();
      if (!userId) return;

      setAvatarUploading(true);
      setAvatarStatus("Subiendo foto...");
      await updateUserAvatar(userId, result.assets[0].uri);
      await Promise.all([refetch(), loadStats()]);
      setAvatarStatus("Foto actualizada correctamente.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo actualizar la foto de perfil.";
      setAvatarError(msg);
      setAvatarStatus(null);
      Alert.alert("Error", msg);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onLogout() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
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
              await deleteTeam(teamId);
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
              const userId = await getCurrentUserId();
              if (!userId) return;
              await deleteCoachAccount(userId, teamId);
              await deleteOwnAuthUser();
              // Session can already be invalid after deleting auth user.
              await signOut().catch(() => {});
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "No se pudo eliminar la cuenta.");
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
            overflow: "hidden",
          }}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <Text style={{ color: "rgba(99,179,237,1)", fontWeight: "900", fontSize: 26 }}>
                {initials || "🏅"}
              </Text>
            )}
          </View>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 20, letterSpacing: -0.4 }}>
              {displayName}
            </Text>
            <Pressable
              onPress={onPickAvatar}
              disabled={avatarUploading}
              style={{
                marginTop: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: "rgba(99,179,237,0.15)",
                borderWidth: 1,
                borderColor: "rgba(99,179,237,0.28)",
                opacity: avatarUploading ? 0.7 : 1,
              }}
            >
              <Ionicons name="camera-outline" size={13} color="rgba(99,179,237,0.95)" />
              <Text style={{ color: "rgba(99,179,237,0.95)", fontWeight: "800", fontSize: 12 }}>
                {avatarUploading ? "Subiendo..." : "Cambiar foto"}
              </Text>
            </Pressable>
            {avatarStatus ? (
              <Text style={{ color: "rgba(34,197,94,0.90)", fontSize: 12 }}>{avatarStatus}</Text>
            ) : null}
            {avatarError ? (
              <Text style={{ color: "rgba(239,68,68,0.90)", fontSize: 12, textAlign: "center" }}>{avatarError}</Text>
            ) : null}
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
        <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 12, textAlign: "center" }}>
          Cuenta y datos
        </Text>
        <Pressable
          onPress={onDeleteAccount}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
            height: 50, borderRadius: 16,
            backgroundColor: "rgba(239,68,68,0.12)",
            borderWidth: 1, borderColor: "rgba(239,68,68,0.45)",
          }}
        >
          <Ionicons name="trash-outline" size={16} color="rgba(239,68,68,0.95)" />
          <Text style={{ color: "rgba(239,68,68,0.95)", fontWeight: "800", fontSize: 13 }}>
            Eliminar cuenta permanentemente
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
