import { queryClient } from "@/src/lib/queryClient";
import { supabase } from "@/src/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(trainer)" />
      </Stack>

      {ready ? <AuthGate session={session} /> : null}
    </QueryClientProvider>
  );
}

import { supabase as _supabase } from "@/src/lib/supabase";
import { useRouter, useSegments } from "expo-router";
import { useEffect as useEffect2, useState as useState2 } from "react";

function AuthGate({ session }: { session: Session | null }) {
  const router   = useRouter();
  const segments = useSegments();
  const [role, setRole] = useState2<"player" | "coach" | null>(null);
  const [roleReady, setRoleReady] = useState2(false);

  // Fetch role whenever session changes
  useEffect2(() => {
    if (!session) { setRole(null); setRoleReady(true); return; }
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
      });
  }, [session]);

  useEffect2(() => {
    if (!roleReady) return;

    const inAuth    = segments[0] === "(auth)";
    const inTabs    = segments[0] === "(tabs)";
    const inTrainer = segments[0] === "(trainer)";

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
