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

type UserRole = "player" | "coach";

function normalizeUsername(u: string) {
  return u.trim().toLowerCase();
}

// ─── Animated input field (shared with login) ─────────────────────────────────

function Field({
  label, icon, value, onChangeText, placeholder,
  secureTextEntry, keyboardType, autoCapitalize,
  error, textContentType, enterAnim, hint,
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
  hint?: string;
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
        <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 11, marginLeft: 2 }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, marginLeft: 2 }}>{hint}</Text>
      ) : null}
    </Animated.View>
  );
}

// ─── Password strength bar ────────────────────────────────────────────────────

function PasswordStrength({ password, enterAnim }: { password: string; enterAnim: Animated.Value }) {
  const strength = useMemo(() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6)  s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  }, [password]);

  const labels = ["", "Débil", "Regular", "Buena", "Fuerte"];
  const colors = ["", "rgba(239,68,68,1)", "rgba(245,158,11,1)", "rgba(99,179,237,1)", "rgba(34,197,94,1)"];

  if (!password) return null;

  const translateY = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Animated.View style={{ gap: 5, opacity: enterAnim, transform: [{ translateY }] }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={{
            flex: 1, height: 3, borderRadius: 99,
            backgroundColor: n <= strength ? colors[strength] : "rgba(255,255,255,0.09)",
          }} />
        ))}
      </View>
      <Text style={{ color: colors[strength], fontSize: 10, fontWeight: "700" }}>
        {labels[strength]}
      </Text>
    </Animated.View>
  );
}

// ─── Role picker ──────────────────────────────────────────────────────────────

function RolePicker({ role, onSelect, enterAnim }: {
  role: UserRole; onSelect: (r: UserRole) => void; enterAnim: Animated.Value;
}) {
  const slideAnim = useRef(new Animated.Value(role === "player" ? 0 : 1)).current;

  function pick(r: UserRole) {
    Animated.spring(slideAnim, {
      toValue: r === "player" ? 0 : 1,
      useNativeDriver: true, speed: 22, bounciness: 6,
    }).start();
    onSelect(r);
  }

  const translateY = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  const options: { value: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
    { value: "player",  label: "Jugador/a",     icon: "basketball-outline", desc: "Trackeá tus tiros" },
    { value: "coach",   label: "Entrenador/a",  icon: "megaphone-outline",  desc: "Mirá a tu equipo"   },
  ];

  return (
    <Animated.View style={{ gap: 8, opacity: enterAnim, transform: [{ translateY }] }}>
      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" }}>
        Soy…
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {options.map((opt) => {
          const selected = role === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => pick(opt.value)}
              style={{
                flex: 1, gap: 6, paddingVertical: 16, paddingHorizontal: 12,
                borderRadius: 18, alignItems: "center",
                borderWidth: 2,
                borderColor: selected ? "#F59E0B" : "rgba(255,255,255,0.10)",
                backgroundColor: selected ? "rgba(245,158,11,0.11)" : "rgba(255,255,255,0.03)",
              }}
            >
              <View style={{
                width: 42, height: 42, borderRadius: 14,
                backgroundColor: selected ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: selected ? "rgba(245,158,11,0.40)" : "rgba(255,255,255,0.09)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name={opt.icon} size={20} color={selected ? "#F59E0B" : "rgba(255,255,255,0.35)"} />
              </View>
              <Text style={{
                color: selected ? "#F59E0B" : "rgba(255,255,255,0.55)",
                fontWeight: "900", fontSize: 13, letterSpacing: -0.1,
              }}>
                {opt.label}
              </Text>
              <Text style={{
                color: selected ? "rgba(245,158,11,0.65)" : "rgba(255,255,255,0.22)",
                fontSize: 11, textAlign: "center",
              }}>
                {opt.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ─── Submit button ────────────────────────────────────────────────────────────

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
        <Text style={{
          color: disabled ? "rgba(255,255,255,0.25)" : "#0B1220",
          fontWeight: "900", fontSize: 15, letterSpacing: 0.1,
        }}>
          {loading ? "Creando cuenta…" : title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Signup() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername]       = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [role, setRole]               = useState<UserRole>("player");
  const [loading, setLoading]         = useState(false);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  const anims = {
    logo:  useRef(new Animated.Value(0)).current,
    role:  useRef(new Animated.Value(0)).current,
    f1:    useRef(new Animated.Value(0)).current,
    f2:    useRef(new Animated.Value(0)).current,
    f3:    useRef(new Animated.Value(0)).current,
    f4:    useRef(new Animated.Value(0)).current,
    str:   useRef(new Animated.Value(0)).current,
    btn:   useRef(new Animated.Value(0)).current,
    link:  useRef(new Animated.Value(0)).current,
  };

  useEffect(() => {
    Animated.stagger(70, [
      Animated.spring(anims.logo, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 90 }),
      Animated.spring(anims.role, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.f1,   { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.f2,   { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.f3,   { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.f4,   { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.str,  { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.btn,  { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
      Animated.spring(anims.link, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 100 }),
    ]).start();
  }, []);

  const usernameError = useMemo(() => {
    if (!username) return null;
    const u = normalizeUsername(username);
    if (u.length < 3) return "Mínimo 3 caracteres";
    if (u.length > 16) return "Máximo 16 caracteres";
    if (!/^[a-z0-9_]+$/.test(u)) return "Solo letras, números y _";
    return null;
  }, [username]);

  const displayNameError = useMemo(() => {
    if (!displayName) return null;
    return displayName.trim().length >= 2 ? null : "Muy corto";
  }, [displayName]);

  const emailError = useMemo(() => {
    if (!email) return null;
    return /\S+@\S+\.\S+/.test(email) ? null : "Email inválido";
  }, [email]);

  const passError = useMemo(() => {
    if (!password) return null;
    return password.length >= 6 ? null : "Mínimo 6 caracteres";
  }, [password]);

  const canSubmit =
    displayName.trim().length >= 2 &&
    username.trim().length >= 3 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    !displayNameError && !usernameError && !emailError && !passError;

  async function onSignup() {
    try {
      setLoading(true);
      const u = normalizeUsername(username);

      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { display_name: displayName.trim(), username: u, role },
        },
      });

      if (error) {
        setSuccessMsg(null);
        // Show inline error (reuse successMsg area with red)
        setSuccessMsg("❌ " + error.message);
        return;
      }

      setSuccessMsg(
        data.session
          ? "✅ ¡Cuenta creada! Bienvenido/a."
          : "📬 Revisá tu email para confirmar la cuenta."
      );
    } finally {
      setLoading(false);
    }
  }

  const logoScale = anims.logo.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const isError = successMsg?.startsWith("❌");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* Ambient glows */}
      <View style={{
        position: "absolute", top: -60, alignSelf: "center",
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: "rgba(99,179,237,0.05)",
      }} pointerEvents="none" />
      <View style={{
        position: "absolute", bottom: -60, alignSelf: "center",
        width: 260, height: 260, borderRadius: 130,
        backgroundColor: "rgba(245,158,11,0.045)",
      }} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 28, paddingBottom: 36, gap: 0 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View style={{ alignItems: "center", marginBottom: 28, opacity: anims.logo, transform: [{ scale: logoScale }] }}>
            <View style={{
              width: 72, height: 72, borderRadius: 24,
              backgroundColor: "rgba(99,179,237,0.12)",
              borderWidth: 1.5, borderColor: "rgba(99,179,237,0.30)",
              alignItems: "center", justifyContent: "center",
              shadowColor: "#63B3ED", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 4 },
              elevation: 12,
            }}>
              <Ionicons name="basketball" size={34} color="rgba(99,179,237,1)" />
            </View>
            <Text style={{ color: "rgba(99,179,237,0.65)", fontWeight: "900", fontSize: 12, letterSpacing: 3, marginTop: 8, textTransform: "uppercase" }}>
              ShotTracker
            </Text>
          </Animated.View>

          {/* Title */}
          <Animated.View style={{
            marginBottom: 24,
            opacity: anims.logo,
            transform: [{ translateY: anims.logo.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}>
            <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.6, marginBottom: 4 }}>
              Crear cuenta
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
              Elegí tu rol y armá tu perfil 🏀
            </Text>
          </Animated.View>

          {/* Role picker */}
          <View style={{ marginBottom: 20 }}>
            <RolePicker role={role} onSelect={setRole} enterAnim={anims.role} />
          </View>

          {/* Fields */}
          <View style={{ gap: 14, marginBottom: 8 }}>
            <Field label="Nombre" icon="person-outline" value={displayName} onChangeText={setDisplayName}
              placeholder="Lucía Juárez" autoCapitalize="words" error={displayNameError}
              textContentType="name" enterAnim={anims.f1} />
            <Field label="Username" icon="at-outline" value={username} onChangeText={setUsername}
              placeholder="lucia_hoops" autoCapitalize="none" error={usernameError}
              hint="3-16 caracteres, solo letras, números y _"
              enterAnim={anims.f2} />
            <Field label="Email" icon="mail-outline" value={email} onChangeText={setEmail}
              placeholder="lucia@email.com" keyboardType="email-address" autoCapitalize="none"
              error={emailError} textContentType="emailAddress" enterAnim={anims.f3} />
            <Field label="Contraseña" icon="lock-closed-outline" value={password} onChangeText={setPassword}
              placeholder="••••••••" secureTextEntry error={passError}
              textContentType="newPassword" enterAnim={anims.f4} />
          </View>

          {/* Password strength */}
          <View style={{ marginBottom: 20 }}>
            <PasswordStrength password={password} enterAnim={anims.str} />
          </View>

          {/* Success / error banner */}
          {successMsg ? (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              padding: 12, borderRadius: 12, marginBottom: 16,
              backgroundColor: isError ? "rgba(239,68,68,0.10)" : "rgba(34,197,94,0.10)",
              borderWidth: 1, borderColor: isError ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)",
            }}>
              <Text style={{ color: isError ? "rgba(239,68,68,0.90)" : "rgba(34,197,94,0.90)", fontSize: 13, flex: 1 }}>
                {successMsg}
              </Text>
            </View>
          ) : null}

          {/* Button */}
          <Animated.View style={{ marginBottom: 22, opacity: anims.btn, transform: [{ translateY: anims.btn.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
            <SubmitButton title="Crear cuenta" loading={loading} disabled={!canSubmit} onPress={onSignup} />
          </Animated.View>

          {/* Link */}
          <Animated.View style={{ flexDirection: "row", justifyContent: "center", gap: 6, alignItems: "center", opacity: anims.link }}>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 14 }}>¿Ya tenés cuenta?</Text>
            <Link href="/(auth)/login">
              <Text style={{ color: "#F59E0B", fontWeight: "900", fontSize: 14 }}>Iniciar sesión</Text>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
