// app/(auth)/forgot-password.tsx
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, []);

  const emailError = useMemo(() => {
    if (!email) return null;
    return /\S+@\S+\.\S+/.test(email) ? null : "Email inválido";
  }, [email]);

  const canSubmit = email.length > 0 && !emailError;
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(focusAnim, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [focused]);
  const borderColor = focusAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [
      emailError ? "rgba(239,68,68,0.50)" : "rgba(255,255,255,0.11)",
      emailError ? "rgba(239,68,68,0.80)" : "rgba(245,158,11,0.70)",
    ],
  });
  const inputBg = focusAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["rgba(255,255,255,0.04)", "rgba(245,158,11,0.06)"],
  });

  async function onReset() {
    if (!canSubmit || loading) return;
    try {
      setLoading(true);
      setError(null);
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: "shottracker://reset-password" },
      );
      if (err) { setError(err.message); return; }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* Ambient glow */}
      <View style={{
        position: "absolute", top: -80, alignSelf: "center",
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: "rgba(245,158,11,0.05)",
      }} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 26, paddingVertical: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, gap: 0 }}>
            {/* Back button */}
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={{
                alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
                marginBottom: 32,
              }}
            >
              <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.50)" />
              <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 14, fontWeight: "700" }}>
                Volver
              </Text>
            </Pressable>

            {/* Icon */}
            <View style={{ alignItems: "center", marginBottom: 32 }}>
              <View style={{
                width: 76, height: 76, borderRadius: 26,
                backgroundColor: "rgba(245,158,11,0.12)",
                borderWidth: 1.5, borderColor: "rgba(245,158,11,0.30)",
                alignItems: "center", justifyContent: "center",
                shadowColor: "#F59E0B", shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 4 },
                elevation: 12,
              }}>
                <Ionicons name="lock-open-outline" size={34} color="#F59E0B" />
              </View>
            </View>

            {/* Title */}
            <View style={{ marginBottom: 28 }}>
              <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.6, marginBottom: 6 }}>
                Recuperar contraseña
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, lineHeight: 21 }}>
                Ingresá tu email y te vamos a enviar un enlace para restablecer tu contraseña.
              </Text>
            </View>

            {sent ? (
              /* Success state */
              <View style={{
                padding: 20, borderRadius: 18, gap: 12,
                backgroundColor: "rgba(34,197,94,0.09)",
                borderWidth: 1.5, borderColor: "rgba(34,197,94,0.28)",
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{
                    width: 42, height: 42, borderRadius: 13,
                    backgroundColor: "rgba(34,197,94,0.16)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name="checkmark-circle" size={24} color="rgba(34,197,94,1)" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "rgba(34,197,94,1)", fontWeight: "900", fontSize: 15 }}>
                      ¡Email enviado!
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
                      Revisá tu bandeja de entrada
                    </Text>
                  </View>
                </View>
                <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 13, lineHeight: 19 }}>
                  Si el email <Text style={{ color: "white", fontWeight: "700" }}>{email}</Text> está
                  registrado, vas a recibir un enlace para restablecer tu contraseña.
                  {"\n\n"}Revisá también la carpeta de spam.
                </Text>
                <Pressable
                  onPress={() => router.replace("/(auth)/login")}
                  style={{
                    height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center",
                    backgroundColor: "rgba(34,197,94,0.14)",
                    borderWidth: 1, borderColor: "rgba(34,197,94,0.30)",
                    marginTop: 4,
                  }}
                >
                  <Text style={{ color: "rgba(34,197,94,1)", fontWeight: "800", fontSize: 14 }}>
                    Volver al inicio de sesión
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Form */
              <View style={{ gap: 20 }}>
                {/* Email field */}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" }}>
                    Email
                  </Text>
                  <Animated.View style={{
                    flexDirection: "row", alignItems: "center", gap: 10,
                    borderWidth: 1.5, borderColor, borderRadius: 16,
                    backgroundColor: inputBg, paddingHorizontal: 14,
                    paddingVertical: Platform.OS === "ios" ? 14 : 11,
                  }}>
                    <Ionicons name="mail-outline" size={18} color={focused ? "#F59E0B" : "rgba(255,255,255,0.30)"} />
                    <TextInput
                      value={email}
                      onChangeText={(t) => { setEmail(t); setError(null); }}
                      placeholder="lucia@email.com"
                      placeholderTextColor="rgba(255,255,255,0.20)"
                      style={{ flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      textContentType="emailAddress"
                      autoFocus
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                    />
                  </Animated.View>
                  {emailError ? (
                    <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 11, marginLeft: 2 }}>
                      {emailError}
                    </Text>
                  ) : null}
                </View>

                {/* Server error */}
                {error ? (
                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 8,
                    padding: 12, borderRadius: 12,
                    backgroundColor: "rgba(239,68,68,0.10)",
                    borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
                  }}>
                    <Ionicons name="alert-circle-outline" size={16} color="rgba(239,68,68,0.80)" />
                    <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 13, flex: 1 }}>{error}</Text>
                  </View>
                ) : null}

                {/* Submit */}
                <Pressable
                  onPress={onReset}
                  disabled={!canSubmit || loading}
                  style={{
                    height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center",
                    backgroundColor: !canSubmit ? "rgba(245,158,11,0.18)" : "#F59E0B",
                    borderWidth: !canSubmit ? 1.5 : 0,
                    borderColor: "rgba(245,158,11,0.25)",
                  }}
                >
                  <Text style={{
                    color: !canSubmit ? "rgba(255,255,255,0.25)" : "#0B1220",
                    fontWeight: "900", fontSize: 15,
                  }}>
                    {loading ? "Enviando…" : "Enviar enlace"}
                  </Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
