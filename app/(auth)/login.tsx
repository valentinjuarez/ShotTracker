import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

// ─── Animated input field ─────────────────────────────────────────────────────

function Field({
  label, icon, value, onChangeText, placeholder,
  secureTextEntry, keyboardType, autoCapitalize,
  error, textContentType, enterAnim,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: string | null;
  textContentType?: any;
  enterAnim: Animated.Value;
}) {
  const [focused, setFocused] = useState(false);
  const [show, setShow]       = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const prevError = useRef<string | null | undefined>(null);

  useEffect(() => {
    Animated.timing(focusAnim, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused]);

  useEffect(() => {
    if (error && error !== prevError.current) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue:  7, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -7, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  4, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -4, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 35, useNativeDriver: true }),
      ]).start();
    }
    prevError.current = error;
  }, [error]);

  const borderColor = focusAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [
      error ? "rgba(239,68,68,0.50)" : "rgba(255,255,255,0.11)",
      error ? "rgba(239,68,68,0.80)" : "rgba(245,158,11,0.70)",
    ],
  });
  const bg = focusAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["rgba(255,255,255,0.04)", "rgba(245,158,11,0.06)"],
  });
  const translateY = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View style={{ gap: 6, opacity: enterAnim, transform: [{ translateY }, { translateX: shakeAnim }] }}>
      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Animated.View style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        borderWidth: 1.5, borderColor, borderRadius: 16,
        backgroundColor: bg, paddingHorizontal: 14,
        paddingVertical: Platform.OS === "ios" ? 14 : 11,
      }}>
        <Ionicons name={icon} size={18} color={focused ? "#F59E0B" : "rgba(255,255,255,0.30)"} />
        <TextInput
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.20)"
          style={{ flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 }}
          secureTextEntry={secureTextEntry && !show}
          keyboardType={keyboardType} autoCapitalize={autoCapitalize ?? "none"}
          textContentType={textContentType}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setShow((v) => !v)} hitSlop={10}>
            <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color="rgba(255,255,255,0.30)" />
          </Pressable>
        )}
      </Animated.View>
      {error ? (
        <Animated.Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 11, marginLeft: 2 }}>
          {error}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}

// ─── Press-animated button ────────────────────────────────────────────────────

function SubmitButton({ title, loading, disabled, onPress }: {
  title: string; loading: boolean; disabled: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 2 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress} onPressIn={() => press(0.96)} onPressOut={() => press(1)}
        disabled={disabled || loading}
        style={{
          height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center",
          backgroundColor: disabled ? "rgba(245,158,11,0.18)" : "#F59E0B",
          borderWidth: disabled ? 1.5 : 0, borderColor: "rgba(245,158,11,0.25)",
        }}
      >
        <Text style={{ color: disabled ? "rgba(255,255,255,0.25)" : "#0B1220", fontWeight: "900", fontSize: 15, letterSpacing: 0.1 }}>
          {loading ? "Cargando…" : title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const anims = {
    logo:   useRef(new Animated.Value(0)).current,
    title:  useRef(new Animated.Value(0)).current,
    f1:     useRef(new Animated.Value(0)).current,
    f2:     useRef(new Animated.Value(0)).current,
    btn:    useRef(new Animated.Value(0)).current,
    link:   useRef(new Animated.Value(0)).current,
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const entrance = Animated.stagger(80, [
      Animated.spring(anims.logo,  { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 90 }),
      Animated.spring(anims.title, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 90 }),
      Animated.spring(anims.f1,    { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.f2,    { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.btn,   { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.link,  { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
    ]);

    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.07, duration: 2000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.00, duration: 2000, useNativeDriver: true }),
    ]));

    entrance.start(() => pulse.start());
    return () => { entrance.stop(); pulse.stop(); };
  }, []);

  const emailError = useMemo(() => {
    if (!email) return null;
    return /\S+@\S+\.\S+/.test(email) ? null : "Email inválido";
  }, [email]);

  const passError = useMemo(() => {
    if (!password) return null;
    return password.length >= 6 ? null : "Mínimo 6 caracteres";
  }, [password]);

  const canSubmit = email.length > 0 && password.length > 0 && !emailError && !passError;

  async function onLogin() {
    try {
      setLoading(true);
      setAuthError(null);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  }

  const logoScale = anims.logo.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* Ambient glow */}
      <View style={{
        position: "absolute", top: -80, alignSelf: "center",
        width: 340, height: 340, borderRadius: 170,
        backgroundColor: "rgba(245,158,11,0.055)",
      }} pointerEvents="none" />
      <View style={{
        position: "absolute", bottom: -60, alignSelf: "center",
        width: 240, height: 240, borderRadius: 120,
        backgroundColor: "rgba(99,179,237,0.04)",
      }} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 26, paddingVertical: 32 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View style={{ alignItems: "center", marginBottom: 40, opacity: anims.logo, transform: [{ scale: Animated.multiply(logoScale, pulseAnim) }] }}>
            <View style={{
              width: 84, height: 84, borderRadius: 28,
              backgroundColor: "rgba(245,158,11,0.12)",
              borderWidth: 1.5, borderColor: "rgba(245,158,11,0.32)",
              alignItems: "center", justifyContent: "center",
              shadowColor: "#F59E0B", shadowOpacity: 0.40, shadowRadius: 28, shadowOffset: { width: 0, height: 4 },
              elevation: 14,
            }}>
              <Ionicons name="basketball" size={40} color="#F59E0B" />
            </View>
            <Text style={{ color: "rgba(245,158,11,0.70)", fontWeight: "900", fontSize: 13, letterSpacing: 3, marginTop: 10, textTransform: "uppercase" }}>
              ShotTracker
            </Text>
          </Animated.View>

          {/* Title */}
          <Animated.View style={{ marginBottom: 32, opacity: anims.title, transform: [{ translateY: anims.title.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
            <Text style={{ color: "white", fontSize: 28, fontWeight: "900", letterSpacing: -0.7, marginBottom: 6 }}>
              Bienvenido/a de vuelta
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 14 }}>
              Iniciá sesión para seguir trackeando 🏀
            </Text>
          </Animated.View>

          {/* Fields */}
          <View style={{ gap: 16, marginBottom: 10 }}>
            <Field label="Email" icon="mail-outline" value={email} onChangeText={(t) => { setEmail(t); setAuthError(null); }}
              placeholder="lucia@email.com" keyboardType="email-address" autoCapitalize="none"
              error={emailError} textContentType="emailAddress" enterAnim={anims.f1} />
            <Field label="Contraseña" icon="lock-closed-outline" value={password} onChangeText={(t) => { setPassword(t); setAuthError(null); }}
              placeholder="••••••••" secureTextEntry error={passError}
              textContentType="password" enterAnim={anims.f2} />
          </View>

          {/* Auth error banner */}
          {authError ? (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              padding: 12, borderRadius: 12, marginBottom: 16,
              backgroundColor: "rgba(239,68,68,0.10)",
              borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
            }}>
              <Ionicons name="alert-circle-outline" size={16} color="rgba(239,68,68,0.80)" />
              <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 13, flex: 1 }}>{authError}</Text>
            </View>
          ) : <View style={{ height: 16 }} />}

          {/* Button */}
          <Animated.View style={{ marginBottom: 24, opacity: anims.btn, transform: [{ translateY: anims.btn.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
            <SubmitButton title="Entrar a la cancha" loading={loading} disabled={!canSubmit} onPress={onLogin} />
          </Animated.View>

          {/* Link */}
          <Animated.View style={{ flexDirection: "row", justifyContent: "center", gap: 6, alignItems: "center", opacity: anims.link }}>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 14 }}>¿No tenés cuenta?</Text>
            <Link href="/(auth)/signup">
              <Text style={{ color: "#F59E0B", fontWeight: "900", fontSize: 14 }}>Registrate</Text>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
