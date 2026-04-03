// app/(tabs)/index.tsx
import { usePlayerHomeController } from "@/src/features/home/hooks/usePlayerHomeController";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Link, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

//  Shared styles 


//  Animation hooks 

function useFadeSlide(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, [anim, delay]);
  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
  };
}

function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  return { scale, onIn, onOut };
}

//  Main screen 

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const {
    initials,
    inProgressWorkout,
    lastDate,
    lastLabel,
    lastPct,
    lastPctStr,
    lastSession,
    lastSpots,
    loadingStats,
    name,
    onContinueWorkout,
    onLogout,
    onRefresh,
    refreshing,
    startingSession,
    weeklyAttempts,
    weeklyPct,
  } = usePlayerHomeController();

  const headerAnim  = useFadeSlide(0);
  const heroAnim    = useFadeSlide(80);
  const statsAnim   = useFadeSlide(160);
  const lastAnim    = useFadeSlide(240);
  const workoutAnim = useFadeSlide(320);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: isSmall ? 16 : 20,
          paddingTop: isSmall ? 12 : 18,
          paddingBottom: 44,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F59E0B"
            colors={["#F59E0B"]}
          />
        }
      >
        {/*  Header  */}
        <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, headerAnim]}>
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: "rgba(245,158,11,0.15)",
            borderWidth: 1.5, borderColor: "rgba(245,158,11,0.35)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: "#F59E0B", fontWeight: "900", fontSize: 16 }}>
              {initials || "🏀"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, letterSpacing: 0.2 }}>
              Bienvenida,
            </Text>
            <Text style={{ color: "white", fontSize: isSmall ? 19 : 22, fontWeight: "900", letterSpacing: -0.4 }} numberOfLines={1}>
              {name || "Jugador/a"}
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
            <Ionicons name="log-out-outline" size={19} color="rgba(255,255,255,0.60)" />
          </Pressable>
        </Animated.View>

        {/*  Quick actions  */}
        <Animated.View style={[{ flexDirection: "row", gap: 12 }, heroAnim]}>
          <Link href="/session/create" asChild>
            <Pressable
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={{
                flex: 1, borderRadius: 22, backgroundColor: "#F59E0B",
                padding: 18, gap: 26, minHeight: 140,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: "rgba(0,0,0,0.14)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="basketball" size={22} color="#0B1220" />
              </View>
              <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 17, letterSpacing: -0.4 }}>
                {"Nueva\nsesión"}
              </Text>
            </Pressable>
          </Link>

          <Link href="./workout/create" asChild>
            <Pressable
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={{
                flex: 1, borderRadius: 22,
                backgroundColor: "rgba(99,179,237,0.10)",
                borderWidth: 1.5, borderColor: "rgba(99,179,237,0.28)",
                padding: 18, gap: 26, minHeight: 140,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: "rgba(99,179,237,0.15)",
                borderWidth: 1, borderColor: "rgba(99,179,237,0.28)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="clipboard-outline" size={20} color="rgba(99,179,237,1)" />
              </View>
              <Text style={{ color: "rgba(99,179,237,1)", fontWeight: "900", fontSize: 17, letterSpacing: -0.4 }}>
                {"Crear\nplanilla"}
              </Text>
            </Pressable>
          </Link>
        </Animated.View>

        {/*  Weekly stats  */}
        <Animated.View style={[{ flexDirection: "row", gap: 12 }, statsAnim]}>
          <StatCard title="Esta semana" icon="bar-chart-outline" loading={loadingStats} isSmall={isSmall}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text style={{ color: "white", fontWeight: "900", fontSize: isSmall ? 26 : 30, letterSpacing: -1 }}>
                {weeklyAttempts ?? "–"}
              </Text>
              {weeklyAttempts !== null && weeklyAttempts > 0 && (
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>tiros</Text>
              )}
            </View>
          </StatCard>

          <StatCard title="% semanal" icon="trending-up-outline" loading={loadingStats} isSmall={isSmall}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
              <Text style={{
                color: weeklyPct !== null ? pctColor(weeklyPct) : "rgba(255,255,255,0.30)",
                fontWeight: "900", fontSize: isSmall ? 26 : 30, letterSpacing: -1,
              }}>
                {weeklyPct !== null ? Math.round(weeklyPct * 100) : "–"}
              </Text>
              {weeklyPct !== null && (
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 15, fontWeight: "700" }}>%</Text>
              )}
            </View>
          </StatCard>
        </Animated.View>

        {/*  Last session  */}
        <Animated.View style={[card, lastAnim]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>Última sesión</Text>
            <PillBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/history" as any); }}>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 12 }}>Historial</Text>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.35)" />
            </PillBtn>
          </View>

          {loadingStats ? (
            <ActivityIndicator color="#F59E0B" style={{ alignSelf: "center", marginVertical: 16 }} />
          ) : lastSession ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/session/summary", params: { sessionId: lastSession.id } });
              }}
              style={{ gap: 14 }}
            >
              {/* Title row + badge */}
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 16, letterSpacing: -0.3 }} numberOfLines={2}>
                    {lastLabel}
                  </Text>
                  {lastDate && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.28)" />
                      <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{lastDate}</Text>
                    </View>
                  )}
                </View>
                <View style={{
                  width: 64, height: 64, borderRadius: 18,
                  backgroundColor: lastPct !== null
                    ? pctColor(lastPct).replace("1)", "0.12)")
                    : "rgba(255,255,255,0.05)",
                  borderWidth: 1.5,
                  borderColor: lastPct !== null
                    ? pctColor(lastPct).replace("1)", "0.35)")
                    : "rgba(255,255,255,0.10)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{
                    color: lastPct !== null ? pctColor(lastPct) : "rgba(255,255,255,0.30)",
                    fontWeight: "900", fontSize: 20, letterSpacing: -0.5,
                  }}>
                    {lastPctStr || "–"}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={{
                height: 5, borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.07)",
                overflow: "hidden",
              }}>
                {lastPct !== null && (
                  <View style={{
                    width: `${Math.round(lastPct * 100)}%`,
                    height: "100%", borderRadius: 999,
                    backgroundColor: pctColor(lastPct),
                  }} />
                )}
              </View>

              {/* Bottom stats */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                  <Text style={{ color: "rgba(255,255,255,0.70)", fontWeight: "800" }}>{lastSpots.makes}</Text>
                  {" metidos · "}
                  <Text style={{ color: "rgba(255,255,255,0.70)", fontWeight: "800" }}>{lastSpots.attempts}</Text>
                  {" tiros"}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "800" }}>Ver resumen</Text>
                  <Ionicons name="arrow-forward" size={12} color="#F59E0B" />
                </View>
              </View>
            </Pressable>
          ) : (
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 20 }}>
              <View style={{
                width: 54, height: 54, borderRadius: 27,
                backgroundColor: "rgba(255,255,255,0.05)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="basketball-outline" size={26} color="rgba(255,255,255,0.20)" />
              </View>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 14 }}>Sin sesiones aún</Text>
              <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center" }}>
                Completá una sesión para ver tus stats acá.
              </Text>
            </View>
          )}
        </Animated.View>

        {/*  Planilla activa  */}
        <Animated.View style={[card, workoutAnim]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>Planilla activa</Text>
            <PillBtn onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/workout/" as any);
            }}>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 12 }}>Ver todas</Text>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.35)" />
            </PillBtn>
          </View>

          {inProgressWorkout && (inProgressWorkout.status === "DONE" || (!inProgressWorkout.currentSessionId &&
           inProgressWorkout.completedSessions >= inProgressWorkout.sessionsGoal)) ? (
            /* ── Planilla completada ── */
            <View style={{
              padding: 14, borderRadius: 14, gap: 8,
              backgroundColor: "rgba(34,197,94,0.08)",
              borderWidth: 1, borderColor: "rgba(34,197,94,0.28)",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: "rgba(34,197,94,0.15)",
                  borderWidth: 1, borderColor: "rgba(34,197,94,0.28)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name="trophy" size={18} color="rgba(34,197,94,1)" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 14 }} numberOfLines={1}>
                    {inProgressWorkout.title}
                  </Text>
                  <Text style={{ color: "rgba(34,197,94,0.80)", fontSize: 12 }}>
                    ¡Completada! · {inProgressWorkout.sessionsGoal} sesiones
                  </Text>
                </View>
              </View>
              <View style={{ height: 3, borderRadius: 99, backgroundColor: "rgba(34,197,94,0.15)", overflow: "hidden" }}>
                <View style={{ height: 3, borderRadius: 99, backgroundColor: "rgba(34,197,94,0.70)", width: "100%" }} />
              </View>
            </View>
          ) : inProgressWorkout ? (
            /* ── Planilla en progreso ── */
            <Pressable
              onPress={onContinueWorkout}
              disabled={startingSession}
              style={{
                flexDirection: "row", alignItems: "center", gap: 12,
                padding: 14, borderRadius: 14,
                backgroundColor: "rgba(99,179,237,0.08)",
                borderWidth: 1, borderColor: "rgba(99,179,237,0.22)",
                opacity: startingSession ? 0.7 : 1,
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: "rgba(99,179,237,0.15)",
                borderWidth: 1, borderColor: "rgba(99,179,237,0.28)",
                alignItems: "center", justifyContent: "center",
              }}>
                {startingSession
                  ? <ActivityIndicator size="small" color="rgba(99,179,237,1)" />
                  : <Ionicons name={inProgressWorkout.currentSessionId ? "play" : "add-circle"} size={16} color="rgba(99,179,237,1)" />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 14 }} numberOfLines={1}>
                  {inProgressWorkout.title}
                </Text>
                <View style={{ gap: 5 }}>
                  <Text style={{ color: "rgba(99,179,237,0.70)", fontSize: 12 }}>
                    {inProgressWorkout.currentSessionId
                      ? `Sesión ${inProgressWorkout.completedSessions + 1} en progreso…`
                      : `Sesión ${inProgressWorkout.completedSessions + 1} de ${inProgressWorkout.sessionsGoal}`}
                  </Text>
                  {inProgressWorkout.sessionsGoal > 0 && (
                    <View style={{ height: 3, borderRadius: 99, backgroundColor: "rgba(99,179,237,0.12)", overflow: "hidden" }}>
                      <View style={{
                        height: 3, borderRadius: 99,
                        backgroundColor: "rgba(99,179,237,0.70)",
                        width: `${Math.min(100, Math.round((inProgressWorkout.completedSessions / inProgressWorkout.sessionsGoal) * 100))}%`,
                      }} />
                    </View>
                  )}
                </View>
              </View>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10,
                backgroundColor: "rgba(99,179,237,0.15)",
              }}>
                <Text style={{ color: "rgba(99,179,237,1)", fontWeight: "900", fontSize: 12 }}>
                  {inProgressWorkout.currentSessionId ? "Continuar" : "Empezar"}
                </Text>
                <Ionicons name="arrow-forward" size={12} color="rgba(99,179,237,1)" />
              </View>
            </Pressable>
          ) : (
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 20 }}>
              <View style={{
                width: 54, height: 54, borderRadius: 27,
                backgroundColor: "rgba(255,255,255,0.05)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="clipboard-outline" size={26} color="rgba(255,255,255,0.20)" />
              </View>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 14 }}>Sin planilla activa</Text>
              <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center" }}>
                Creá una planilla para estructurar tu entrenamiento.
              </Text>
              <Link href="./workout/create" asChild>
                <Pressable
                  onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  style={{
                    marginTop: 4, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.07)",
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                    flexDirection: "row", alignItems: "center", gap: 6,
                  }}
                >
                  <Ionicons name="add" size={15} color="rgba(255,255,255,0.65)" />
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontWeight: "800", fontSize: 13 }}>Crear planilla</Text>
                </Pressable>
              </Link>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

//  Helpers 

function pctColor(p: number) {
  if (p >= 0.65) return "rgba(34,197,94,1)";
  if (p >= 0.4)  return "rgba(245,158,11,1)";
  return "rgba(239,68,68,1)";
}

//  Sub-components 

function PillBtn({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  const { scale, onIn, onOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={onIn} onPressOut={onOut} onPress={onPress}
        style={{
          paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10,
          backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
          flexDirection: "row", alignItems: "center", gap: 5,
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function StatCard({
  title, icon, loading, isSmall, children,
}: {
  title: string; icon: keyof typeof Ionicons.glyphMap;
  loading?: boolean; isSmall: boolean; children?: React.ReactNode;
}) {
  return (
    <View style={{
      flex: 1, borderRadius: 18, padding: isSmall ? 12 : 14,
      backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", gap: 8,
    }}>
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.55)" />
      <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 12 }}>{title}</Text>
      {loading
        ? <ActivityIndicator color="#F59E0B" size="small" style={{ alignSelf: "flex-start" }} />
        : children}
    </View>
  );
}
const card = {
  padding: 16, borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.055)",
  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
} as const;
