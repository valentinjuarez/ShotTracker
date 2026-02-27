import { queryClient } from "@/src/lib/queryClient";
import { supabase } from "@/src/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const [session, setSession]     = useState<Session | null>(null);
  const [ready, setReady]         = useState(false);
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setReady(true);
    });

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
