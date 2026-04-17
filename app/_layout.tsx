import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { queryClient } from "@/src/lib/queryClient";
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Text, View } from "react-native";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const remember = await AsyncStorage.getItem("@st_remember_me");
        if (remember === "false") {
          await AsyncStorage.removeItem("@st_remember_me");
          await supabase.auth.signOut();
        }
      } catch {}

      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setReady(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setGateReady(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const fullyReady = ready && gateReady;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(trainer)" />
        <Stack.Screen name="privacy" options={{ presentation: "modal" }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="confirm" options={{ headerShown: false }} />
      </Stack>

      {ready ? <AuthGate session={session} onResolved={() => setGateReady(true)} /> : null}

      <OfflineBanner />

      {!fullyReady && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#0B1220",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color="#F59E0B" size="large" />
        </View>
      )}
    </QueryClientProvider>
  );
}

function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const translateY = useRef(new Animated.Value(-60)).current;
  const prevOnline = useRef<boolean | null>(null);
  const [visible, setVisible] = useState(false);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    if (isOnline === null) return;

    const wasOnline = prevOnline.current;
    prevOnline.current = isOnline;

    if (!isOnline) {
      setReconnected(false);
      setVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 120,
      }).start();
      return;
    }

    if (wasOnline === false && isOnline) {
      setReconnected(true);
      setVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 120,
      }).start();
      setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -60,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }, 2200);
    }
  }, [isOnline, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        transform: [{ translateY }],
        backgroundColor: reconnected ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingTop: 52,
        paddingBottom: 12,
        paddingHorizontal: 16,
      }}
    >
      <Ionicons
        name={reconnected ? "checkmark-circle-outline" : "cloud-offline-outline"}
        size={16}
        color="white"
      />
      <Text style={{ color: "white", fontWeight: "800", fontSize: 13, flex: 1 }}>
        {reconnected ? "Conexion restaurada - sincronizando datos..." : "Sin conexion a internet"}
      </Text>
    </Animated.View>
  );
}

function AuthGate({
  session,
  onResolved,
}: {
  session: Session | null;
  onResolved: () => void;
}) {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  const [role, setRole] = useState<"player" | "coach" | null>(null);
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    if (!session) {
      setRole(null);
      setRoleReady(true);
      return;
    }

    setRoleReady(false);

    const metaRole = session.user.user_metadata?.role === "coach" ? "coach" : "player";

    supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }: { data: { role: "player" | "coach" } | null }) => {
        const resolvedRole = (data?.role as "player" | "coach" | null) ?? metaRole;
        setRole(resolvedRole);
      })
      .catch(() => {
        setRole(metaRole);
      })
      .finally(() => {
        setRoleReady(true);
      });
  }, [session]);

  const resolveTarget = useCallback((): string | null => {
    const inAuth = segments[0] === "(auth)";
    const inTabs = segments[0] === "(tabs)";
    const inTrainer = segments[0] === "(trainer)";
    const inPrivacy = segments[0] === "privacy";
    const inResetPw = segments[0] === "reset-password";
    const inConfirm = segments[0] === "confirm";
    const inRoot = pathname === "/";

    if (inPrivacy || inResetPw || inConfirm) {
      return null;
    }

    if (!session) {
      return inAuth ? null : "/(auth)/login";
    }

    if (!role) {
      return null;
    }

    if (inRoot || inAuth) {
      return role === "coach" ? "/(trainer)" : "/(tabs)";
    }

    if (role === "coach" && inTabs) {
      return "/(trainer)";
    }

    if (role === "player" && inTrainer) {
      return "/(tabs)";
    }

    return null;
  }, [pathname, role, segments, session]);

  useEffect(() => {
    if (!roleReady) return;

    const target = resolveTarget();

    if (target) {
      onResolved();
      router.replace(target as any);
      return;
    }

    onResolved();
  }, [onResolved, resolveTarget, roleReady, router]);

  return null;
}
