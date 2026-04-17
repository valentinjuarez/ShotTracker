import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

const SUPPORT_EMAIL = "shottracker.app@gmail.com";
const DEMO_EMAIL = "demo.shottracker.review@gmail.com";
const DEMO_PASSWORD = "ShotTrackerDemo!2026";

function useFadeSlide(delay = 0) {
  const anim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      delay,
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  };
}

export default function Landing() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
  const isDesktop = width >= 980;
  const heroAnim = useFadeSlide(0);
  const infoAnim = useFadeSlide(120);
  const cardsAnim = useFadeSlide(220);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let active = true;

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!active) return;
      router.replace(data.session ? "/(tabs)" : "/(auth)/login");
    });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#06101E" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: isCompact ? 16 : 22, paddingBottom: 40, paddingTop: 8 }}
      >
        <View style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <View
            style={{
              position: "absolute",
              top: -80,
              right: -120,
              width: 260,
              height: 260,
              borderRadius: 260,
              backgroundColor: "rgba(245, 158, 11, 0.18)",
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 220,
              left: -100,
              width: 220,
              height: 220,
              borderRadius: 220,
              backgroundColor: "rgba(59, 130, 246, 0.16)",
            }}
          />
        </View>

        <View style={{ width: "100%", maxWidth: 1140, alignSelf: "center" }}>
          <Animated.View style={[{ paddingTop: 18, paddingBottom: 20, gap: 16 }, heroAnim]}>
            <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 18 }}>
              <View style={{ flex: 1, gap: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: "rgba(245, 158, 11, 0.14)",
                      borderWidth: 1,
                      borderColor: "rgba(245, 158, 11, 0.26)",
                    }}
                  >
                    <Text style={{ color: "#FBBF24", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 }}>
                      Beta para TestFlight
                    </Text>
                  </View>

                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 24,
                      backgroundColor: "rgba(245, 158, 11, 0.16)",
                      borderWidth: 1,
                      borderColor: "rgba(245, 158, 11, 0.32)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="basketball" size={34} color="#FBBF24" />
                  </View>
                </View>

                <Text
                  style={{
                    color: "white",
                    fontSize: isCompact ? 34 : isDesktop ? 58 : 44,
                    fontWeight: "900",
                    lineHeight: isCompact ? 38 : isDesktop ? 62 : 48,
                    letterSpacing: isDesktop ? -1.8 : -1.2,
                    maxWidth: isDesktop ? 700 : undefined,
                  }}
                >
                  Mejora tus tiros con datos reales.
                </Text>

                <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: isDesktop ? 18 : 16, lineHeight: 26, maxWidth: 680 }}>
                  Shot Tracker te permite registrar sesiones de basquet, ver porcentajes por zona y compartir progreso
                  de entrenamiento con una experiencia clara y rapida.
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {[
                    "Creacion de sesiones",
                    "Resumen y estadisticas",
                    "Historial de entrenamientos",
                  ].map((item) => (
                    <Chip key={item} label={item} />
                  ))}
                </View>
              </View>

              <View
                style={{
                  width: isDesktop ? 360 : "100%",
                  padding: 20,
                  borderRadius: 24,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                  gap: 12,
                }}
              >
                <Text style={{ color: "white", fontSize: 20, fontWeight: "900", letterSpacing: -0.3 }}>
                  Soporte rapido
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.66)", fontSize: 13, lineHeight: 20 }}>
                  Esta pagina cumple como soporte para App Store: incluye contacto, privacidad e instrucciones de beta.
                </Text>
                <InfoLine label="Correo" value={SUPPORT_EMAIL} />
                <InfoLine label="Demo" value={DEMO_EMAIL} />

                <View style={{ gap: 10, marginTop: 2 }}>
                  <Link href={`mailto:${SUPPORT_EMAIL}`} asChild>
                    <Pressable>
                      <SecondaryButton icon="mail-outline" label="Contactar soporte" />
                    </Pressable>
                  </Link>
                  <Link href="/privacy" asChild>
                    <Pressable>
                      <SecondaryButton icon="document-text-outline" label="Ver politica de privacidad" />
                    </Pressable>
                  </Link>
                </View>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              {
                marginTop: 6,
                padding: 18,
                borderRadius: 26,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
                gap: 18,
              },
              infoAnim,
            ]}
          >
          <SectionTitle title="Como probarla" subtitle="Este es el texto que le ayuda a Apple y a los testers." />

          <StepRow
            number="1"
            title="Inicia sesion"
            detail={`Usa la cuenta demo ${DEMO_EMAIL} con la clave ${DEMO_PASSWORD}.`}
          />
          <StepRow number="2" title="Crea una sesion" detail="Registra una sesion nueva y guarda tiros por zona." />
          <StepRow number="3" title="Revisa el resultado" detail="Verifica el resumen, los porcentajes y el historial." />
          </Animated.View>

          <Animated.View style={[{ marginTop: 16, gap: 12 }, cardsAnim]}>
          <SectionTitle title="Que incluye la beta" subtitle="Una landing simple que tambien funciona como pagina de soporte." />

          <View style={{ flexDirection: isCompact ? "column" : "row", gap: 12 }}>
            <FeatureCard
              icon="stats-chart-outline"
              title="Metricas claras"
              detail="Tiros, aciertos, porcentaje y progreso semanal en una sola vista."
            />
            <FeatureCard
              icon="albums-outline"
              title="Historial ordenado"
              detail="Encuentra sesiones anteriores y revisa tu avance sin perder contexto."
            />
          </View>

          <View style={{ flexDirection: isCompact ? "column" : "row", gap: 12 }}>
            <FeatureCard
              icon="shield-checkmark-outline"
              title="Soporte y privacidad"
              detail="Acceso a soporte, politica de privacidad y contacto directo desde Vercel."
            />
            <FeatureCard
              icon="phone-portrait-outline"
              title="Listo para TestFlight"
              detail="La pagina explica la beta y acompana el flujo de revision de Apple."
            />
          </View>
          </Animated.View>

          <View
            style={{
              marginTop: 16,
              padding: 18,
              borderRadius: 24,
              backgroundColor: "rgba(15, 23, 42, 0.92)",
              borderWidth: 1,
              borderColor: "rgba(245, 158, 11, 0.2)",
              gap: 12,
            }}
          >
            <Text style={{ color: "white", fontSize: 18, fontWeight: "900", letterSpacing: -0.3 }}>
              Datos utiles para la revision
            </Text>

            <InfoLine label="Correo de soporte" value={SUPPORT_EMAIL} />
            <InfoLine label="Cuenta demo" value={DEMO_EMAIL} />
            <InfoLine label="Contrasena demo" value={DEMO_PASSWORD} />

            <Pressable
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              style={{ marginTop: 6 }}
            >
              <SecondaryButton icon="chatbubble-ellipses-outline" label="Escribir soporte" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: "white", fontSize: 20, fontWeight: "900", letterSpacing: -0.4 }}>{title}</Text>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 19 }}>{subtitle}</Text>
    </View>
  );
}

function StepRow({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: "rgba(245, 158, 11, 0.18)",
          borderWidth: 1,
          borderColor: "rgba(245, 158, 11, 0.3)",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        <Text style={{ color: "#FBBF24", fontSize: 12, fontWeight: "900" }}>{number}</Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: "white", fontSize: 15, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 19 }}>{detail}</Text>
      </View>
    </View>
  );
}

function FeatureCard({ icon, title, detail }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 156,
        padding: 16,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: "rgba(245, 158, 11, 0.14)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={22} color="#FBBF24" />
      </View>

      <Text style={{ color: "white", fontSize: 16, fontWeight: "900", letterSpacing: -0.2 }}>{title}</Text>
      <Text style={{ color: "rgba(255,255,255,0.66)", fontSize: 13, lineHeight: 19 }}>{detail}</Text>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: "white", fontSize: 14, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

function SecondaryButton({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View
      style={{
        minHeight: 52,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 16,
      }}
    >
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.9)" />
      <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}