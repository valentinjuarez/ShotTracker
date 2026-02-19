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
        {/* Creamos stacks SIEMPRE (router content) */}
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      {/* Gate por sesión en una pantalla aparte */}
      {ready ? <AuthGate session={session} /> : null}
    </QueryClientProvider>
  );
}

import { useRouter, useSegments } from "expo-router";
import { useEffect as useEffect2 } from "react";

function AuthGate({ session }: { session: Session | null }) {
  const router = useRouter();
  const segments = useSegments(); // ["(tabs)", "index"] etc.

  useEffect2(() => {
    const inAuthGroup = segments[0] === "(auth)";

    // Si NO hay sesión y estoy fuera de auth => mandar a login
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    }

    // Si hay sesión y estoy en auth => mandar a tabs
    if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, segments, router]);

  return null;
}
