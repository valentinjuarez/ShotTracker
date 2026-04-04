// app/(trainer)/index.tsx  — Coach dashboard
import { useCoachDashboardController } from "@/src/features/team/hooks/useCoachDashboardController";
import type { PlayerStat } from "@/src/features/team/services/team.service";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Animated,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Share,
    Text,
    View,
} from "react-native";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

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
  }, [anim, delay]);
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
  const {
    avatarUrl,
    displayName,
    initials,
    isNameLoading,
    loading,
    onLogout,
    onRefresh,
    players,
    refreshing,
    team,
    teamPct,
    totalAttempts,
    totalSessions,
  } = useCoachDashboardController();

  const headerAnim = useFadeSlide(0);
  const teamAnim   = useFadeSlide(80);
  const statsAnim  = useFadeSlide(160);
  const listAnim   = useFadeSlide(240);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* Ambient glow */}
      <View style={{
        position: "absolute", top: -80, left: -60,
        width: 280, height: 280, borderRadius: 140,
        backgroundColor: "rgba(99,179,237,0.06)",
      }} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 44, gap: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" colors={["#F59E0B"]} />
        }
      >
        {/* Header */}
        <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 14 }, headerAnim]}>
          {/* Avatar */}
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: "rgba(99,179,237,0.15)",
            borderWidth: 1.5, borderColor: "rgba(99,179,237,0.40)",
            alignItems: "center", justifyContent: "center",
            shadowColor: "#63B3ED", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
            overflow: "hidden",
          }}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : initials ? (
              <Text style={{ color: "rgba(99,179,237,1)", fontWeight: "900", fontSize: 17 }}>
                {initials}
              </Text>
            ) : (
              <Ionicons name="person-outline" size={22} color="rgba(99,179,237,0.70)" />
            )}
          </View>

          {/* Greeting + name */}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 12, fontWeight: "600" }}>
              {greeting()} 👋
            </Text>
            {isNameLoading ? (
              <View style={{
                height: 22, width: 140, borderRadius: 6,
                backgroundColor: "rgba(255,255,255,0.08)",
              }} />
            ) : (
              <Text
                style={{ color: "white", fontSize: 20, fontWeight: "900", letterSpacing: -0.4 }}
                numberOfLines={1}
              >
                {displayName ?? "Entrenador/a"}
              </Text>
            )}
          </View>

          {/* Logout */}
          <Pressable
            onPress={onLogout}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="log-out-outline" size={19} color="rgba(255,255,255,0.50)" />
          </Pressable>
        </Animated.View>

        {/* Role badge */}
        <Animated.View style={[{ flexDirection: "row" }, headerAnim]}>
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 6,
            paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20,
            backgroundColor: "rgba(99,179,237,0.10)",
            borderWidth: 1, borderColor: "rgba(99,179,237,0.22)",
            alignSelf: "flex-start",
          }}>
            <Ionicons name="megaphone-outline" size={12} color="rgba(99,179,237,0.80)" />
            <Text style={{ color: "rgba(99,179,237,0.80)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
              Entrenador/a
            </Text>
          </View>
        </Animated.View>

        {loading && !refreshing ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator color="#F59E0B" size="large" />
          </View>
        ) : !team ? (
          <NoTeamState onCreateTeam={() => router.push("/(trainer)/create-team" as any)} />
        ) : (
          <>
            {/* Team banner */}
            <Animated.View style={teamAnim}>
              <TeamBanner team={team} />
            </Animated.View>

            {/* Global team stats */}
            <Animated.View style={[{ flexDirection: "row", gap: 10 }, statsAnim]}>
              <StatTile icon="people-outline"      label="Jugadores"     value={String(players.length)} />
              <StatTile icon="basketball-outline"  label="Tiros totales" value={String(totalAttempts)} />
              <StatTile
                icon="trending-up-outline"
                label="% Equipo"
                value={teamPct !== null ? `${Math.round(teamPct * 100)}%` : "–"}
                valueColor={teamPct !== null ? pctColor(teamPct) : undefined}
              />
            </Animated.View>

            {/* Sesiones totales */}
            <Animated.View style={[statsAnim, {
              flexDirection: "row", alignItems: "center", gap: 10,
              padding: 14, borderRadius: 16,
              backgroundColor: "rgba(245,158,11,0.07)",
              borderWidth: 1, borderColor: "rgba(245,158,11,0.18)",
            }]}>
              <View style={{
                width: 36, height: 36, borderRadius: 11,
                backgroundColor: "rgba(245,158,11,0.15)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="calendar-outline" size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>Sesiones registradas</Text>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 17 }}>{totalSessions}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={16} color="rgba(255,255,255,0.20)" />
            </Animated.View>

            {/* Player ranking */}
            <Animated.View style={[card, listAnim, { gap: 14 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="trophy-outline" size={16} color="#F59E0B" />
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
                    Ranking de jugadores
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push("/(trainer)/players" as any)}
                  style={{
                    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.07)",
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
                  }}
                >
                  <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 12, fontWeight: "700" }}>Ver todos</Text>
                </Pressable>
              </View>

              {players.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                  <Ionicons name="people-outline" size={30} color="rgba(255,255,255,0.15)" />
                  <Text style={{ color: "rgba(255,255,255,0.30)", textAlign: "center", fontSize: 13, lineHeight: 20 }}>
                    Aún no hay jugadores en el equipo.{"\n"}Compartí el código de invitación.
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

function NoTeamState({ onCreateTeam }: { onCreateTeam: () => void }) {
  return (
    <View style={[card, { alignItems: "center", gap: 16, paddingVertical: 44 }]}>
      <View style={{
        width: 68, height: 68, borderRadius: 34,
        backgroundColor: "rgba(99,179,237,0.10)",
        borderWidth: 1.5, borderColor: "rgba(99,179,237,0.25)",
        alignItems: "center", justifyContent: "center",
        shadowColor: "#63B3ED", shadowOpacity: 0.20, shadowRadius: 12, shadowOffset: { width: 0, height: 2 },
      }}>
        <Ionicons name="shield-half-outline" size={30} color="rgba(99,179,237,0.70)" />
      </View>
      <View style={{ alignItems: "center", gap: 6 }}>
        <Text style={{ color: "white", fontWeight: "900", fontSize: 19, letterSpacing: -0.3 }}>Sin equipo</Text>
        <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
          Todavía no tenés un equipo.{"\n"}Creá uno y compartí el código con tus jugadores.
        </Text>
      </View>
      <Pressable
        onPress={onCreateTeam}
        style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          paddingVertical: 13, paddingHorizontal: 28,
          borderRadius: 14, backgroundColor: "rgba(99,179,237,1)",
          marginTop: 4,
        }}
      >
        <Ionicons name="add-circle-outline" size={18} color="#0B1220" />
        <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 14 }}>Crear mi equipo</Text>
      </Pressable>
    </View>
  );
}

function TeamBanner({ team }: { team: { id: string; name: string; invite_code: string; avatar_url?: string | null } }) {
  const [copied, setCopied] = React.useState(false);

  async function onCopy() {
    await Clipboard.setStringAsync(team.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onShare() {
    await Share.share({
      message: `Unite al equipo "${team.name}" en ShotTracker 🏀\nCódigo de invitación: ${team.invite_code}`,
    });
  }

  return (
    <View style={{
      borderRadius: 22, overflow: "hidden",
      borderWidth: 1.5, borderColor: "rgba(99,179,237,0.28)",
    }}>
      <View style={{
        backgroundColor: "rgba(99,179,237,0.10)",
        paddingHorizontal: 20, paddingVertical: 18, gap: 14,
      }}>
        {/* Team name row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{
            width: 50, height: 50, borderRadius: 16,
            backgroundColor: "rgba(99,179,237,0.18)",
            borderWidth: 1.5, borderColor: "rgba(99,179,237,0.35)",
            alignItems: "center", justifyContent: "center",
          }}>
            {team.avatar_url ? (
              <Image
                source={{ uri: team.avatar_url }}
                style={{ width: 46, height: 46, borderRadius: 14 }}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="shield-half-outline" size={24} color="rgba(99,179,237,0.90)" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, fontWeight: "600", letterSpacing: 0.4 }}>
              Tu equipo
            </Text>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 18, letterSpacing: -0.4 }}>
              {team.name}
            </Text>
          </View>
        </View>

        {/* Invite code row */}
        <View style={{
          borderRadius: 14, padding: 12, gap: 10,
          backgroundColor: "rgba(0,0,0,0.20)",
          borderWidth: 1, borderColor: "rgba(99,179,237,0.15)",
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="key-outline" size={13} color="rgba(99,179,237,0.65)" />
              <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, fontWeight: "600", letterSpacing: 0.4 }}>
                Código de invitación
              </Text>
            </View>
          </View>
          <Text style={{
            color: "rgba(99,179,237,1)", fontWeight: "900",
            fontSize: 26, letterSpacing: 8, textAlign: "center",
          }}>
            {team.invite_code}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={onCopy}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 5, paddingVertical: 9, borderRadius: 10,
                backgroundColor: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                borderWidth: 1,
                borderColor: copied ? "rgba(34,197,94,0.30)" : "rgba(255,255,255,0.10)",
              }}
            >
              <Ionicons
                name={copied ? "checkmark-outline" : "copy-outline"}
                size={14}
                color={copied ? "rgba(34,197,94,0.90)" : "rgba(255,255,255,0.55)"}
              />
              <Text style={{
                color: copied ? "rgba(34,197,94,0.90)" : "rgba(255,255,255,0.55)",
                fontWeight: "700", fontSize: 12,
              }}>
                {copied ? "¡Copiado!" : "Copiar"}
              </Text>
            </Pressable>
            <Pressable
              onPress={onShare}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 5, paddingVertical: 9, borderRadius: 10,
                backgroundColor: "rgba(99,179,237,0.12)",
                borderWidth: 1, borderColor: "rgba(99,179,237,0.25)",
              }}
            >
              <Ionicons name="share-outline" size={14} color="rgba(99,179,237,0.90)" />
              <Text style={{ color: "rgba(99,179,237,0.90)", fontWeight: "700", fontSize: 12 }}>
                Compartir
              </Text>
            </Pressable>
          </View>
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
        {player.avatar_url ? (
          <Image
            source={{ uri: player.avatar_url }}
            style={{ width: 34, height: 34, borderRadius: 17 }}
            contentFit="cover"
          />
        ) : (
          <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.45)" />
        )}
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
