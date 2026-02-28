// app/reset-password.tsx
// Landing screen for the "reset password" deep link.
// Supabase redirects here with tokens in the URL hash fragment:
//   shottracker://reset-password#access_token=...&refresh_token=...&type=recovery
// We use Linking.getInitialURL() to read the full URL (Expo Router only
// exposes query params, not the hash fragment).
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

function useInputAnim(focused: boolean, hasError: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [focused]);
  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      hasError ? "rgba(239,68,68,0.50)" : "rgba(255,255,255,0.11)",
      hasError ? "rgba(239,68,68,0.80)" : "rgba(245,158,11,0.70)",
    ],
  });
  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.04)", "rgba(245,158,11,0.06)"],
  });
  return { borderColor, bg };
}

export default function ResetPassword() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [exchanging, setExchanging] = useState(true);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [focusPw, setFocusPw]   = useState(false);
  const [focusCf, setFocusCf]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, []);

  // Step 1: exchange the PKCE code for a session.
  // With flowType:"pkce", Supabase redirects to shottracker://reset-password?code=XXX
  // Expo Router parses it and gives us `code` via useLocalSearchParams.
  // Fallback: if the app was in background, read full URL from Linking.
  useEffect(() => {
    let cancelled = false;

    async function tryCode(c: string) {
      const { error } = await supabase.auth.exchangeCodeForSession(c);
      if (!cancelled) {
        if (error) setExchangeError("El enlace expiró o ya fue usado. Solicitá uno nuevo.");
        setExchanging(false);
      }
    }

    // Primary: Expo Router already parsed the ?code= query param
    if (code) {
      tryCode(code);
      return;
    }

    // Fallback: app was in background — read full URL from Linking
    let sub: ReturnType<typeof Linking.addEventListener> | null = null;

    Linking.getInitialURL().then((url) => {
      if (cancelled) return;
      const fullUrl = url ?? "";
      const queryCode = new URLSearchParams(fullUrl.split("?")[1] ?? "").get("code");
      if (queryCode) { tryCode(queryCode); return; }

      // Still no code — listen for incoming URL (foreground case)
      sub = Linking.addEventListener("url", ({ url: u }) => {
        if (cancelled) return;
        const c2 = new URLSearchParams(u.split("?")[1] ?? "").get("code");
        if (c2) tryCode(c2);
      });

      // Give it 10 s then give up
      setTimeout(() => {
        if (!cancelled && exchanging) {
          setExchangeError("El enlace es inválido o ya fue usado. Solicitá uno nuevo.");
          setExchanging(false);
        }
      }, 10000);
    });

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [code]);

  const pwError   = password.length > 0 && password.length < 6 ? "Mínimo 6 caracteres" : null;
  const cfError   = confirm.length > 0 && confirm !== password ? "Las contraseñas no coinciden" : null;
  const canSave   = password.length >= 6 && confirm === password && !saving;

  const pwAnim = useInputAnim(focusPw, !!pwError);
  const cfAnim = useInputAnim(focusCf, !!cfError);

  async function onSave() {
    if (!canSave) return;
    try {
      setSaving(true);
      setSaveError(null);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setSaveError(error.message); return; }
      setDone(true);
      // Sign out so user logs in fresh with the new password
      await supabase.auth.signOut();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
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
                <Ionicons name="key-outline" size={34} color="#F59E0B" />
              </View>
            </View>

            {/* Title */}
            <View style={{ marginBottom: 28 }}>
              <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.6, marginBottom: 6 }}>
                Nueva contraseña
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, lineHeight: 21 }}>
                Elegí una contraseña segura para tu cuenta.
              </Text>
            </View>

            {/* Loading state */}
            {exchanging ? (
              <View style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
                <Animated.View style={{
                  width: 40, height: 40, borderRadius: 20,
                  borderWidth: 3, borderColor: "#F59E0B",
                  borderTopColor: "transparent",
                }} />
                <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 14 }}>
                  Validando enlace…
                </Text>
              </View>
            ) : exchangeError ? (
              /* Error state */
              <View style={{ gap: 16 }}>
                <View style={{
                  padding: 18, borderRadius: 18, gap: 10,
                  backgroundColor: "rgba(239,68,68,0.09)",
                  borderWidth: 1.5, borderColor: "rgba(239,68,68,0.28)",
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="alert-circle" size={22} color="rgba(239,68,68,0.90)" />
                    <Text style={{ color: "rgba(239,68,68,0.90)", fontWeight: "900", fontSize: 15, flex: 1 }}>
                      Enlace inválido
                    </Text>
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 13, lineHeight: 19 }}>
                    {exchangeError}
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.replace("/(auth)/forgot-password")}
                  style={{
                    height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center",
                    backgroundColor: "#F59E0B",
                  }}
                >
                  <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 15 }}>
                    Solicitar nuevo enlace
                  </Text>
                </Pressable>
              </View>
            ) : done ? (
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
                  <Text style={{ color: "rgba(34,197,94,1)", fontWeight: "900", fontSize: 15, flex: 1 }}>
                    ¡Contraseña actualizada!
                  </Text>
                </View>
                <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 13, lineHeight: 19 }}>
                  Ya podés iniciar sesión con tu nueva contraseña.
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
                    Iniciar sesión
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Form */
              <View style={{ gap: 18 }}>

                {/* Password field */}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" }}>
                    Nueva contraseña
                  </Text>
                  <Animated.View style={{
                    flexDirection: "row", alignItems: "center", gap: 10,
                    borderWidth: 1.5, borderColor: pwAnim.borderColor, borderRadius: 16,
                    backgroundColor: pwAnim.bg,
                    paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 14 : 11,
                  }}>
                    <Ionicons name="lock-closed-outline" size={18} color={focusPw ? "#F59E0B" : "rgba(255,255,255,0.30)"} />
                    <TextInput
                      value={password}
                      onChangeText={(t) => { setPassword(t); setSaveError(null); }}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.20)"
                      style={{ flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 }}
                      secureTextEntry={!showPw}
                      textContentType="newPassword"
                      autoFocus
                      onFocus={() => setFocusPw(true)}
                      onBlur={() => setFocusPw(false)}
                    />
                    <Pressable hitSlop={8} onPress={() => setShowPw((v) => !v)}>
                      <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color="rgba(255,255,255,0.30)" />
                    </Pressable>
                  </Animated.View>
                  {pwError ? (
                    <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 11, marginLeft: 2 }}>{pwError}</Text>
                  ) : null}
                </View>

                {/* Confirm field */}
                <View style={{ gap: 6 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" }}>
                    Confirmar contraseña
                  </Text>
                  <Animated.View style={{
                    flexDirection: "row", alignItems: "center", gap: 10,
                    borderWidth: 1.5, borderColor: cfAnim.borderColor, borderRadius: 16,
                    backgroundColor: cfAnim.bg,
                    paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 14 : 11,
                  }}>
                    <Ionicons name="lock-closed-outline" size={18} color={focusCf ? "#F59E0B" : "rgba(255,255,255,0.30)"} />
                    <TextInput
                      value={confirm}
                      onChangeText={(t) => { setConfirm(t); setSaveError(null); }}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.20)"
                      style={{ flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 }}
                      secureTextEntry={!showCf}
                      textContentType="newPassword"
                      onFocus={() => setFocusCf(true)}
                      onBlur={() => setFocusCf(false)}
                    />
                    <Pressable hitSlop={8} onPress={() => setShowCf((v) => !v)}>
                      <Ionicons name={showCf ? "eye-off-outline" : "eye-outline"} size={18} color="rgba(255,255,255,0.30)" />
                    </Pressable>
                  </Animated.View>
                  {cfError ? (
                    <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 11, marginLeft: 2 }}>{cfError}</Text>
                  ) : null}
                </View>

                {/* Server error */}
                {saveError ? (
                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 8,
                    padding: 12, borderRadius: 12,
                    backgroundColor: "rgba(239,68,68,0.10)",
                    borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
                  }}>
                    <Ionicons name="alert-circle-outline" size={16} color="rgba(239,68,68,0.80)" />
                    <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 13, flex: 1 }}>{saveError}</Text>
                  </View>
                ) : null}

                {/* Submit */}
                <Pressable
                  onPress={onSave}
                  disabled={!canSave}
                  style={{
                    height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center",
                    backgroundColor: !canSave ? "rgba(245,158,11,0.18)" : "#F59E0B",
                    borderWidth: !canSave ? 1.5 : 0,
                    borderColor: "rgba(245,158,11,0.25)",
                  }}
                >
                  <Text style={{
                    color: !canSave ? "rgba(255,255,255,0.25)" : "#0B1220",
                    fontWeight: "900", fontSize: 15,
                  }}>
                    {saving ? "Guardando…" : "Guardar contraseña"}
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
