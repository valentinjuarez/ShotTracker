import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { queryClient } from "@/src/lib/queryClient";
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Text, View } from "react-native";

export default function RootLayout() {
  const [session, setSession]     = useState<Session | null>(null);
  const [ready, setReady]         = useState(false);
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    async function init() {
      // Si el usuario desmarcó "Recordarme", cerrar sesión al abrir la app
      try {
        const flag = await AsyncStorage.getItem("@st_remember_me");
        if (flag === "false") {
          await AsyncStorage.removeItem("@st_remember_me");
          await supabase.auth.signOut();
        }
      } catch {}

      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session ?? null);
        setReady(true);
      });
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Re-raise the shield on any actual auth transition so the
      // role DB query can complete before the correct layout is shown
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setRoleReady(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // True when both session and role are resolved — nothing renders until then
  const fullyReady = ready && roleReady;

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

      {ready ? <AuthGate session={session} onRoleReady={() => setRoleReady(true)} /> : null}

      <OfflineBanner />

      {/* Opaque shield — blocks any flash of the wrong layout until role is known */}
      {!fullyReady && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "#0B1220",
          alignItems: "center", justifyContent: "center",
        }}>
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
      // Se perdió la conexión → mostrar banner rojo
      setReconnected(false);
      setVisible(true);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 120 }).start();
    } else if (wasOnline === false && isOnline) {
      // Se recuperó la conexión → mostrar banner verde brevemente
      setReconnected(true);
      setVisible(true);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 120 }).start();
      setTimeout(() => {
        Animated.timing(translateY, { toValue: -60, duration: 300, useNativeDriver: true }).start(
          () => setVisible(false),
        );
      }, 2200);
    }
  }, [isOnline]);

  if (!visible) return null;

  return (
    <Animated.View style={{
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 9999,
      transform: [{ translateY }],
      backgroundColor: reconnected ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
    }}>
      <Ionicons
        name={reconnected ? "checkmark-circle-outline" : "cloud-offline-outline"}
        size={16}
        color="white"
      />
      <Text style={{ color: "white", fontWeight: "800", fontSize: 13, flex: 1 }}>
        {reconnected ? "Conexión restaurada — sincronizando datos…" : "Sin conexión a internet"}
      </Text>
    </Animated.View>
  );
}

import { supabase as _supabase } from "@/src/lib/supabase";
import { useRouter, useSegments } from "expo-router";
import { useEffect as useEffect2, useState as useState2 } from "react";

function AuthGate({ session, onRoleReady }: { session: Session | null; onRoleReady: () => void }) {
  const router   = useRouter();
  const segments = useSegments();
  const [role, setRole] = useState2<"player" | "coach" | null>(null);
  const [roleReady, setRoleReady] = useState2(false);

  // Fetch role whenever session changes
  useEffect2(() => {
    if (!session) {
      setRole(null);
      setRoleReady(true);
      onRoleReady();
      return;
    }
    // Fallback chain: profiles.role → user_metadata.role → "player"
    const metaRole =
      session.user.user_metadata?.role === "coach" ? "coach" : "player";

    _supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        const resolved: "player" | "coach" =
          (data?.role as "player" | "coach") ?? metaRole;
        setRole(resolved);
        setRoleReady(true);
        onRoleReady();
      });
  }, [session]);

  useEffect2(() => {
    if (!roleReady) return;

    const inAuth    = segments[0] === "(auth)";
    const inTabs    = segments[0] === "(tabs)";
    const inTrainer = segments[0] === "(trainer)";
    const inPrivacy = segments[0] === "privacy";
    const inResetPw = segments[0] === "reset-password";
    const inConfirm = segments[0] === "confirm";

    // Public routes — never redirect away
    if (inPrivacy || inResetPw || inConfirm) return;

    if (!session && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }

    if (session && inAuth) {
      role === "coach"
        ? router.replace("/(trainer)")
        : router.replace("/(tabs)");
      return;
    }

    // Prevent coach from accessing player tabs and vice-versa
    if (session && role === "coach" && inTabs) {
      router.replace("/(trainer)");
      return;
    }
    if (session && role === "player" && inTrainer) {
      router.replace("/(tabs)");
      return;
    }
  }, [session, role, roleReady, segments, router]);

  return null;
}
