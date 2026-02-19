import { supabase } from "@/src/lib/supabase";
import { AuthInput } from "@/src/ui/AuthInput";
import { AuthShell } from "@/src/ui/AuthShell";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Logueate y registrá tus sesiones de tiro."
    >
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
        textContentType="password"
      />

      <PrimaryButton
        title="Entrar a la cancha"
        loading={loading}
        onPress={onLogin}
        disabled={!canSubmit}
      />

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
        <Text style={{ color: "rgba(255,255,255,0.65)" }}>¿No tenés cuenta?</Text>
        <Link href="/(auth)/signup">
          <Text style={{ color: "#F59E0B", fontWeight: "800" }}>Crear</Text>
        </Link>
      </View>

      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textAlign: "center" }}>
        Tip: usá un email real si más adelante activás verificación.
      </Text>
    </AuthShell>
  );
}
