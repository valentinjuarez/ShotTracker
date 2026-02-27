// app/confirm.tsx
// Landing screen for the email confirmation deep link:
//   shottracker://confirm?token_hash=XXXXX&type=signup
// Supabase sends this link after signup when email confirmation is ON.
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, SafeAreaView, Text, View } from "react-native";

export default function Confirm() {
  const router = useRouter();
  const { token_hash, type } = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
  }>();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!token_hash) {
      setErrorMsg("El enlace es inválido o ya fue usado.");
      setStatus("error");
      return;
    }

    const otpType = (type as any) ?? "signup";

    supabase.auth
      .verifyOtp({ token_hash, type: otpType })
      .then(({ error }) => {
        if (error) {
          setErrorMsg("El enlace expiró o ya fue usado. Creá la cuenta de nuevo.");
          setStatus("error");
        } else {
          setStatus("success");
        }
      });
  }, [token_hash, type]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* Ambient glow */}
      <View style={{
        position: "absolute", top: -60, alignSelf: "center",
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: "rgba(99,179,237,0.05)",
      }} pointerEvents="none" />

      <Animated.View style={{
        flex: 1, alignItems: "center", justifyContent: "center",
        paddingHorizontal: 32, opacity: fadeAnim,
      }}>
        {status === "loading" && (
          <>
            <View style={{
              width: 72, height: 72, borderRadius: 24,
              backgroundColor: "rgba(245,158,11,0.12)",
              borderWidth: 1.5, borderColor: "rgba(245,158,11,0.30)",
              alignItems: "center", justifyContent: "center",
              marginBottom: 24,
            }}>
              <Ionicons name="mail-open-outline" size={34} color="#F59E0B" />
            </View>
            <Text style={{
              color: "white", fontSize: 22, fontWeight: "900",
              letterSpacing: -0.5, textAlign: "center", marginBottom: 10,
            }}>
              Verificando cuenta…
            </Text>
            <Text style={{
              color: "rgba(255,255,255,0.40)", fontSize: 14, textAlign: "center",
            }}>
              Esto solo tarda un segundo.
            </Text>
          </>
        )}

        {status === "success" && (
          <>
            <View style={{
              width: 72, height: 72, borderRadius: 24,
              backgroundColor: "rgba(34,197,94,0.12)",
              borderWidth: 1.5, borderColor: "rgba(34,197,94,0.30)",
              alignItems: "center", justifyContent: "center",
              marginBottom: 24,
              shadowColor: "#22C55E", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 4 },
              elevation: 12,
            }}>
              <Ionicons name="checkmark-circle-outline" size={34} color="rgba(34,197,94,1)" />
            </View>
            <Text style={{
              color: "white", fontSize: 22, fontWeight: "900",
              letterSpacing: -0.5, textAlign: "center", marginBottom: 10,
            }}>
              ¡Email confirmado!
            </Text>
            <Text style={{
              color: "rgba(255,255,255,0.40)", fontSize: 14,
              textAlign: "center", marginBottom: 36,
            }}>
              Tu cuenta está activa. Ahora podés ingresar.
            </Text>
            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              style={{
                backgroundColor: "#F59E0B", paddingVertical: 15,
                paddingHorizontal: 40, borderRadius: 16,
                shadowColor: "#F59E0B", shadowOpacity: 0.40,
                shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }}
            >
              <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 16 }}>
                Iniciar sesión
              </Text>
            </Pressable>
          </>
        )}

        {status === "error" && (
          <>
            <View style={{
              width: 72, height: 72, borderRadius: 24,
              backgroundColor: "rgba(239,68,68,0.12)",
              borderWidth: 1.5, borderColor: "rgba(239,68,68,0.30)",
              alignItems: "center", justifyContent: "center",
              marginBottom: 24,
            }}>
              <Ionicons name="close-circle-outline" size={34} color="rgba(239,68,68,1)" />
            </View>
            <Text style={{
              color: "white", fontSize: 22, fontWeight: "900",
              letterSpacing: -0.5, textAlign: "center", marginBottom: 10,
            }}>
              Enlace inválido
            </Text>
            <Text style={{
              color: "rgba(255,255,255,0.40)", fontSize: 14,
              textAlign: "center", marginBottom: 36, lineHeight: 21,
            }}>
              {errorMsg}
            </Text>
            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                paddingVertical: 15, paddingHorizontal: 40,
                borderRadius: 16, borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}
            >
              <Text style={{ color: "rgba(255,255,255,0.75)", fontWeight: "700", fontSize: 16 }}>
                Volver al inicio
              </Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
