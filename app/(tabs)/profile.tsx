// app/(tabs)/profile.tsx
import { deleteOwnAuthUser, getCurrentUserId, getCurrentUserIdentity, signOut } from "@/src/features/auth/services/auth.service";
import { deleteUserAccount, getCurrentUserProfile, getUserStats, updateUserAvatar } from "@/src/features/profile/services/profile.service";
import { useAutoRefreshOnFocus } from "@/src/hooks/useAutoRefreshOnFocus";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
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
      const [identity, profile] = await Promise.all([
        getCurrentUserIdentity(),
        getCurrentUserProfile(),
      ]);

      setName(identity.displayName);
      setEmail(identity.email);
      setAvatarUrl(profile?.avatar_url ?? null);

      const userId = identity.id;
      if (!userId) return;

      const stats = await getUserStats(userId);
      setTotalSessions(stats.totalSessions);
      setTotalAttempts(stats.totalAttempts);
      setTotalMakes(stats.totalMakes);
      setBestPct(stats.bestPct);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useAutoRefreshOnFocus(loadData, { intervalMs: 30000 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

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
      const url = await updateUserAvatar(userId, result.assets[0].uri);
      setAvatarUrl(url);
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
              const userId = await getCurrentUserId();
              if (!userId) return;

              await deleteUserAccount(userId);

              // Remove auth.users row through security-definer RPC.
              await deleteOwnAuthUser();

              // Session may already be invalid after auth-user deletion.
              await signOut().catch(() => {});
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
            overflow: "hidden",
          }}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <Text style={{ color: "#F59E0B", fontWeight: "900", fontSize: 26 }}>
                {initials || "🏀"}
              </Text>
            )}
          </View>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 20, letterSpacing: -0.4 }}>
              {name || "Jugador/a"}
            </Text>
            {email ? (
              <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 13 }}>{email}</Text>
            ) : null}
            <Pressable
              onPress={onPickAvatar}
              disabled={avatarUploading}
              style={{
                marginTop: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: "rgba(245,158,11,0.14)",
                borderWidth: 1,
                borderColor: "rgba(245,158,11,0.30)",
                opacity: avatarUploading ? 0.7 : 1,
              }}
            >
              <Ionicons name="camera-outline" size={13} color="#F59E0B" />
              <Text style={{ color: "#F59E0B", fontWeight: "800", fontSize: 12 }}>
                {avatarUploading ? "Subiendo..." : "Cambiar foto"}
              </Text>
            </Pressable>
            {avatarStatus ? (
              <Text style={{ color: "rgba(34,197,94,0.90)", fontSize: 12, marginTop: 2 }}>{avatarStatus}</Text>
            ) : null}
            {avatarError ? (
              <Text style={{ color: "rgba(239,68,68,0.90)", fontSize: 12, marginTop: 2, textAlign: "center" }}>{avatarError}</Text>
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
