import { supabase } from "@/src/lib/supabase";
import { AuthInput } from "@/src/ui/AuthInput";
import { AuthShell } from "@/src/ui/AuthShell";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";

function normalizeUsername(u: string) {
  return u.trim().toLowerCase();
}

export default function Signup() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

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
    displayName.trim().length > 0 &&
    username.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    !displayNameError &&
    !usernameError &&
    !emailError &&
    !passError;

  async function onSignup() {
    try {
      setLoading(true);

      const u = normalizeUsername(username);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            username: u,
          },
        },
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      Alert.alert("Listo", "Cuenta creada. Ahora podés iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create player"
      subtitle="Armá tu perfil y empezá a trackear tus tiros."
    >
      <AuthInput
        label="Display name"
        icon="person"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Lucía Juárez"
        autoCapitalize="words"
        error={displayNameError}
        textContentType="name"
      />

      <AuthInput
        label="Username"
        icon="at"
        value={username}
        onChangeText={setUsername}
        placeholder="lucia_hoops"
        autoCapitalize="none"
        error={usernameError}
      />

      <AuthInput
        label="Email"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        placeholder="lucia@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={emailError}
        textContentType="emailAddress"
      />

      <AuthInput
        label="Password"
        icon="lock-closed"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        error={passError}
        textContentType="newPassword"
      />

      <PrimaryButton
        title="Crear cuenta"
        loading={loading}
        onPress={onSignup}
        disabled={!canSubmit}
      />

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
        <Text style={{ color: "rgba(255,255,255,0.65)" }}>¿Ya tenés cuenta?</Text>
        <Link href="/(auth)/login">
          <Text style={{ color: "#F59E0B", fontWeight: "800" }}>Login</Text>
        </Link>
      </View>

      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textAlign: "center" }}>
        El username se guarda en tu perfil y lo vamos a usar para stats y rankings (si después querés).
      </Text>
    </AuthShell>
  );
}
