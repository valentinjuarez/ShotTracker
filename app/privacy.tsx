// app/privacy.tsx  –  Privacy Policy (public, no auth required)
// Accessible at /privacy on the web build and as a modal inside the app.
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from "react-native";

const CONTACT_EMAIL = "shottracker.app@gmail.com"; // ← cambiá por tu e-mail real
const APP_NAME      = "Shot Tracker";
const LAST_UPDATED  = "Febrero 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text style={{ color: "white", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, lineHeight: 20 }}>
      {children}
    </Text>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <Text style={{ color: "rgba(245,158,11,0.80)", fontSize: 13, marginTop: 2 }}>•</Text>
      <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, lineHeight: 20, flex: 1 }}>{text}</Text>
    </View>
  );
}

export default function PrivacyPolicy() {
  const router = useRouter();
  const canGoBack = router.canGoBack();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 48, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
          {canGoBack && (
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={{
                width: 36, height: 36, borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.07)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-back" size={19} color="rgba(255,255,255,0.80)" />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, letterSpacing: 0.2 }}>
              {APP_NAME}
            </Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>
              Política de Privacidad
            </Text>
          </View>
        </View>

        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
          Última actualización: {LAST_UPDATED}
        </Text>

        {/* Card wrapper */}
        <View style={{
          borderRadius: 20, padding: 18, gap: 20,
          backgroundColor: "rgba(255,255,255,0.055)",
          borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
        }}>

          <Section title="1. Información que recopilamos">
            <Para>Al usar {APP_NAME} recopilamos únicamente los datos necesarios para que la app funcione:</Para>
            <Bullet text="Dirección de correo electrónico (para tu cuenta)" />
            <Bullet text="Nombre para mostrar (opcional, elegido por vos)" />
            <Bullet text="Estadísticas de tiro: posiciones, intentos, encestes por sesión" />
            <Bullet text="Planillas y sesiones de entrenamiento creadas por vos" />
            <Bullet text="Datos de equipo: código de invitación, rol (jugador/a o entrenador/a)" />
            <Para>No recopilamos datos de ubicación, contactos, fotos ni ningún otro dato del dispositivo.</Para>
          </Section>

          <Section title="2. Cómo usamos tus datos">
            <Para>Los datos se usan exclusivamente para:</Para>
            <Bullet text="Mostrar tus estadísticas de tiro y progreso" />
            <Bullet text="Permitir que tu entrenador/a vea tu rendimiento (solo si vos compartís la planilla)" />
            <Bullet text="Mantener tu historial de sesiones" />
            <Para>No vendemos, alquilamos ni compartimos tus datos con terceros con fines comerciales.</Para>
          </Section>

          <Section title="3. Almacenamiento y seguridad">
            <Para>
              Tus datos se almacenan en Supabase (supabase.com), una plataforma segura con cifrado en
              tránsito (HTTPS/TLS) y en reposo. Aplicamos Row Level Security (RLS) para que cada usuario
              acceda únicamente a sus propios datos.
            </Para>
          </Section>

          <Section title="4. Compartir datos con tu equipo">
            <Para>
              Si usás la función de equipo, tu entrenador/a podrá ver tus estadísticas de planillas que
              hayas compartido explícitamente. No compartimos datos entre usuarios sin tu acción directa.
            </Para>
          </Section>

          <Section title="5. Retención y eliminación de datos">
            <Para>
              Podés eliminar tu cuenta en cualquier momento desde{" "}
              <Text style={{ color: "#F59E0B", fontWeight: "700" }}>Perfil → Eliminar cuenta</Text>.
              Al hacerlo se borran permanentemente:
            </Para>
            <Bullet text="Todas tus sesiones y estadísticas de tiro" />
            <Bullet text="Todas tus planillas de entrenamiento" />
            <Bullet text="Tu perfil y membresías de equipo" />
            <Bullet text="Tu cuenta de autenticación" />
            <Para>Este proceso es irreversible. No guardamos copias de seguridad de datos eliminados.</Para>
          </Section>

          <Section title="6. Menores de edad">
            <Para>
              {APP_NAME} no está dirigida a menores de 13 años (o la edad mínima según tu jurisdicción).
              No recopilamos información de menores de forma intencional.
            </Para>
          </Section>

          <Section title="7. Cambios a esta política">
            <Para>
              Podemos actualizar esta política. Te notificaremos dentro de la app en caso de cambios
              significativos. El uso continuado de la app implica la aceptación de la política vigente.
            </Para>
          </Section>

          <Section title="8. Contacto">
            <Para>
              Para preguntas, solicitudes de eliminación de datos o cualquier consulta de privacidad,
              escribinos a:
            </Para>
            <View style={{
              marginTop: 4, padding: 12, borderRadius: 12,
              backgroundColor: "rgba(245,158,11,0.08)",
              borderWidth: 1, borderColor: "rgba(245,158,11,0.22)",
            }}>
              <Text style={{ color: "#F59E0B", fontWeight: "800", fontSize: 14 }}>
                {CONTACT_EMAIL}
              </Text>
            </View>
          </Section>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
