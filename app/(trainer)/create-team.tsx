// app/(trainer)/create-team.tsx — Create team screen
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    Share,
    Text,
    TextInput,
    View,
} from "react-native";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CreateTeam() {
  const router = useRouter();
  const [teamName, setTeamName]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [created, setCreated]     = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied]       = useState(false);
  const [focused, setFocused]     = useState(false);

  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const press = (v: number) =>
    Animated.spring(scaleAnim, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 2 }).start();

  async function onCreate() {
    const name = teamName.trim();
    if (!name) return;

    try {
      setLoading(true);
      setError(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) throw new Error("No autenticado");
      const userId = auth.user.id;

      // Check if coach already has a team
      const { data: existing } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .eq("role", "coach")
        .maybeSingle();

      if (existing) {
        setError("Ya sos entrenador/a de un equipo.");
        return;
      }

      const inviteCode = generateCode();

      // Create team via security definer function (bypasses RLS safely)
      const { data: team, error: teamErr } = await supabase
        .rpc("create_team", { team_name: name, invite_code: inviteCode });

      if (teamErr) throw teamErr;

      setCreated({ name: team.name, code: team.invite_code });
      Animated.spring(successAnim, {
        toValue: 1, useNativeDriver: true, damping: 12, stiffness: 90,
      }).start();
    } catch (e: any) {
      setError(e?.message ?? "Error al crear el equipo");
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    if (!created) return;
    await Clipboard.setStringAsync(created.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onShare() {
    if (!created) return;
    await Share.share({
      message: `Unite al equipo "${created.name}" en ShotTracker 🏀\nCódigo de invitación: ${created.code}`,
      title: `Unirse a ${created.name}`,
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* Ambient glow */}
      <View style={{
        position: "absolute", top: -80, right: -60,
        width: 260, height: 260, borderRadius: 130,
        backgroundColor: "rgba(99,179,237,0.06)",
      }} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, gap: 0 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              alignSelf: "flex-start", marginBottom: 28,
              paddingVertical: 6, paddingRight: 10,
            }}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.50)" />
            <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 14, fontWeight: "600" }}>Volver</Text>
          </Pressable>

          {/* Header */}
          <View style={{ marginBottom: 32 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 22,
              backgroundColor: "rgba(99,179,237,0.12)",
              borderWidth: 1.5, borderColor: "rgba(99,179,237,0.30)",
              alignItems: "center", justifyContent: "center",
              marginBottom: 16,
              shadowColor: "#63B3ED", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
            }}>
              <Ionicons name="shield-half-outline" size={30} color="rgba(99,179,237,0.90)" />
            </View>
            <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.6, marginBottom: 6 }}>
              Crear equipo
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, lineHeight: 20 }}>
              Elegí un nombre y compartí el código{"\n"}de invitación con tus jugadores.
            </Text>
          </View>

          {!created ? (
            <>
              {/* Team name input */}
              <View style={{ gap: 8, marginBottom: 24 }}>
                <Text style={{
                  color: "rgba(255,255,255,0.45)", fontSize: 11,
                  fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase",
                }}>
                  Nombre del equipo
                </Text>
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  borderWidth: 1.5,
                  borderColor: focused ? "rgba(99,179,237,0.70)" : "rgba(255,255,255,0.11)",
                  borderRadius: 16, paddingHorizontal: 14,
                  paddingVertical: Platform.OS === "ios" ? 14 : 11,
                  backgroundColor: focused ? "rgba(99,179,237,0.06)" : "rgba(255,255,255,0.04)",
                }}>
                  <Ionicons name="shield-half-outline" size={18} color={focused ? "rgba(99,179,237,0.80)" : "rgba(255,255,255,0.30)"} />
                  <TextInput
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="Ej: Las Panthers"
                    placeholderTextColor="rgba(255,255,255,0.20)"
                    style={{ flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 }}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={onCreate}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                  />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginLeft: 2 }}>
                  Se generará un código de invitación automáticamente
                </Text>
              </View>

              {/* Error */}
              {error && (
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 8,
                  padding: 12, borderRadius: 12, marginBottom: 16,
                  backgroundColor: "rgba(239,68,68,0.10)",
                  borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
                }}>
                  <Ionicons name="alert-circle-outline" size={16} color="rgba(239,68,68,0.85)" />
                  <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 13, flex: 1 }}>{error}</Text>
                </View>
              )}

              {/* Button */}
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Pressable
                  onPress={onCreate}
                  onPressIn={() => press(0.96)}
                  onPressOut={() => press(1)}
                  disabled={!teamName.trim() || loading}
                  style={{
                    height: 54, borderRadius: 17,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: teamName.trim() && !loading ? "rgba(99,179,237,1)" : "rgba(99,179,237,0.18)",
                    borderWidth: teamName.trim() && !loading ? 0 : 1.5,
                    borderColor: "rgba(99,179,237,0.25)",
                  }}
                >
                  <Text style={{
                    color: teamName.trim() && !loading ? "#0B1220" : "rgba(255,255,255,0.25)",
                    fontWeight: "900", fontSize: 15, letterSpacing: 0.1,
                  }}>
                    {loading ? "Creando equipo…" : "Crear equipo"}
                  </Text>
                </Pressable>
              </Animated.View>
            </>
          ) : (
            /* Success state */
            <Animated.View style={{
              gap: 20,
              opacity: successAnim,
              transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            }}>
              {/* Success banner */}
              <View style={{
                padding: 18, borderRadius: 20, gap: 4,
                backgroundColor: "rgba(34,197,94,0.08)",
                borderWidth: 1, borderColor: "rgba(34,197,94,0.22)",
                alignItems: "center",
              }}>
                <Ionicons name="checkmark-circle" size={36} color="rgba(34,197,94,0.90)" style={{ marginBottom: 4 }} />
                <Text style={{ color: "white", fontWeight: "900", fontSize: 18, letterSpacing: -0.3 }}>
                  ¡Equipo creado!
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 13 }}>
                  {created.name}
                </Text>
              </View>

              {/* Invite code */}
              <View style={{
                borderRadius: 20, overflow: "hidden",
                borderWidth: 1.5, borderColor: "rgba(99,179,237,0.28)",
                backgroundColor: "rgba(99,179,237,0.07)",
              }}>
                <View style={{ padding: 20, gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="key-outline" size={16} color="rgba(99,179,237,0.80)" />
                    <Text style={{
                      color: "rgba(255,255,255,0.45)", fontSize: 11,
                      fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase",
                    }}>
                      Código de invitación
                    </Text>
                  </View>

                  {/* Code display */}
                  <View style={{
                    alignItems: "center", justifyContent: "center",
                    paddingVertical: 18, borderRadius: 14,
                    backgroundColor: "rgba(99,179,237,0.10)",
                    borderWidth: 1, borderColor: "rgba(99,179,237,0.20)",
                  }}>
                    <Text style={{
                      color: "rgba(99,179,237,1)", fontWeight: "900",
                      fontSize: 36, letterSpacing: 10,
                    }}>
                      {created.code}
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={onCopy}
                      style={{
                        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                        gap: 6, paddingVertical: 12, borderRadius: 12,
                        backgroundColor: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                        borderWidth: 1,
                        borderColor: copied ? "rgba(34,197,94,0.30)" : "rgba(255,255,255,0.10)",
                      }}
                    >
                      <Ionicons
                        name={copied ? "checkmark-outline" : "copy-outline"}
                        size={16}
                        color={copied ? "rgba(34,197,94,0.90)" : "rgba(255,255,255,0.60)"}
                      />
                      <Text style={{
                        color: copied ? "rgba(34,197,94,0.90)" : "rgba(255,255,255,0.60)",
                        fontWeight: "700", fontSize: 13,
                      }}>
                        {copied ? "¡Copiado!" : "Copiar"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={onShare}
                      style={{
                        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                        gap: 6, paddingVertical: 12, borderRadius: 12,
                        backgroundColor: "rgba(99,179,237,0.12)",
                        borderWidth: 1, borderColor: "rgba(99,179,237,0.25)",
                      }}
                    >
                      <Ionicons name="share-outline" size={16} color="rgba(99,179,237,0.90)" />
                      <Text style={{ color: "rgba(99,179,237,0.90)", fontWeight: "700", fontSize: 13 }}>
                        Compartir
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Info */}
              <View style={{
                flexDirection: "row", gap: 10, padding: 14, borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
              }}>
                <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.35)" style={{ marginTop: 1 }} />
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 18, flex: 1 }}>
                  Los jugadores pueden unirse desde su perfil ingresando este código o usando el enlace compartido.
                </Text>
              </View>

              {/* Go to dashboard */}
              <Pressable
                onPress={() => router.replace("/(trainer)" as any)}
                style={{
                  height: 52, borderRadius: 16,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: "rgba(99,179,237,1)",
                }}
              >
                <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 15 }}>
                  Ir al panel
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
