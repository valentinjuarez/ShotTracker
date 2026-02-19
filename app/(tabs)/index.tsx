import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

export default function Home() {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const [name, setName] = useState<string>("");
  const initials = useMemo(() => {
    const n = (name || "").trim();
    if (!n) return "🏀";
    const parts = n.split(" ").filter(Boolean);
    const a = parts[0]?.[0]?.toUpperCase() ?? "";
    const b = parts[1]?.[0]?.toUpperCase() ?? "";
    return (a + b) || a || "🏀";
  }, [name]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const md: any = data.user?.user_metadata ?? {};
      setName(md.display_name ?? md.username ?? "");
    });
  }, []);

  async function onLogout() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Error", error.message);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: isSmall ? 16 : 20,
          paddingTop: isSmall ? 10 : 14,
          gap: 14,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: isSmall ? 44 : 52,
              height: isSmall ? 44 : 52,
              borderRadius: 999,
              backgroundColor: "rgba(245,158,11,0.18)",
              borderWidth: 1,
              borderColor: "rgba(245,158,11,0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#F59E0B", fontWeight: "900", fontSize: 16 }}>
              {initials}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.70)",
                fontSize: isSmall ? 12 : 13,
              }}
            >
              Bienvenida de vuelta
            </Text>
            <Text
              style={{
                color: "white",
                fontSize: isSmall ? 20 : 24,
                fontWeight: "900",
              }}
              numberOfLines={1}
            >
              {name || "Jugador/a"}
            </Text>
          </View>

          <Pressable
            onPress={onLogout}
            hitSlop={10}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>

        {/* Hero card */}
        <View
          style={{
            borderRadius: 18,
            padding: isSmall ? 14 : 16,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: "rgba(34,197,94,0.15)",
                borderWidth: 1,
                borderColor: "rgba(34,197,94,0.35)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="flash" size={20} color="rgba(34,197,94,0.95)" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
                ¿Listo/a para tirar?
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                Empezá una sesión y registrá metidos por posición.
              </Text>
            </View>
          </View>

          {/* Botón principal: sesión libre */}
          <Link href="/session/create" asChild>
            <Pressable
              onPress={async () =>
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }
              style={{
                height: isSmall ? 46 : 50,
                borderRadius: 14,
                backgroundColor: "#F59E0B",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 4,
              }}
            >
              <Text style={{ fontWeight: "900", color: "#0B1220", fontSize: 15 }}>
                + Nueva sesión (libre)
              </Text>
            </Pressable>
          </Link>

          {/* Botón secundario: crear planilla */}
          <Link href="./workout/create" asChild>
            <Pressable
              onPress={async () =>
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }
              style={{
                height: isSmall ? 44 : 48,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontWeight: "900", color: "white", fontSize: 14 }}>
                Crear planilla de entrenamiento
              </Text>
            </Pressable>
          </Link>
        </View>

        {/* Stats row (placeholder por ahora) */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatCard
            title="Tiros semanales"
            value="—"
            icon="bar-chart-outline"
            isSmall={isSmall}
          />
          <StatCard
            title="% Promedio"
            value="—"
            icon="trending-up-outline"
            isSmall={isSmall}
          />
        </View>

        {/* Last session (placeholder) */}
        <View
          style={{
            borderRadius: 18,
            padding: isSmall ? 14 : 16,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            gap: 10,
            flex: 1,
          }}
        >
          <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
            Última sesión
          </Text>

          <View
            style={{
              borderRadius: 14,
              padding: 14,
              backgroundColor: "rgba(0,0,0,0.25)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              gap: 6,
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.75)" }}>
              Todavía no hay sesiones.
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.50)" }}>
              Creá una para ver tus estadísticas acá.
            </Text>

            <Link href="/session/create" asChild>
              <Pressable
                style={{
                  marginTop: 8,
                  alignSelf: "flex-start",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.10)",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>
                  Crear sesión
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function StatCard({
  title,
  value,
  icon,
  isSmall,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  isSmall: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        padding: isSmall ? 12 : 14,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        gap: 8,
      }}
    >
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.75)" />
      <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
        {title}
      </Text>
      <Text style={{ color: "white", fontWeight: "900", fontSize: isSmall ? 18 : 20 }}>
        {value}
      </Text>
    </View>
  );
}
