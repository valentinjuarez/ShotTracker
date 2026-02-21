// app/session/create.tsx
import { ALL_SPOTS } from "@/src/data/spots";
import { supabase } from "@/src/lib/supabase";
import { Court } from "@/src/ui/Court";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

export default function CreateSession() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const courtW = 340;
  const courtH = 380;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultTarget, setDefaultTarget] = useState(10);
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [currentSpotIndex, setCurrentSpotIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const selectedCount = selected.size;
  const currentSpot = ALL_SPOTS[currentSpotIndex];
  const canContinue = selectedCount > 0 && !saving;

  const selectedSpots = useMemo(() => {
    const ids = selected;
    return ALL_SPOTS.filter((s) => ids.has(s.id));
  }, [selected]);

  function toggleSpot(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const reset = useCallback(() => {
    setSelected(new Set());
    setDefaultTarget(10);
    setShowCourtModal(false);
    setCurrentSpotIndex(0);
    setSaving(false);
  }, []);

  // ✅ Reset cuando salís de la pantalla
  useFocusEffect(
    useCallback(() => {
      return () => {
        reset();
      };
    }, [reset])
  );

  async function createSessionAndGo() {
    if (saving) return;

    if (selectedCount === 0) {
      Alert.alert("Falta info", "Elegí al menos una posición.");
      return;
    }

    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 1) user
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = auth.user?.id;
      if (!userId) {
        Alert.alert("Error", "No hay usuario logueado.");
        return;
      }

      // 2) crear session
      const title = `Sesión libre · ${new Date().toLocaleDateString()}`;
      const { data: sessionRow, error: sErr } = await supabase
        .from("sessions")
        .insert({
          user_id: userId,
          kind: "FREE",
          title,
          default_target_attempts: defaultTarget,
          status: "IN_PROGRESS",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (sErr) throw sErr;
      const sessionId = sessionRow?.id as string | undefined;
      if (!sessionId) throw new Error("No se pudo crear la sesión (sin id).");

      // 3) insertar spots de la sesión
      const rows = selectedSpots.map((spot, idx) => ({
        session_id: sessionId,
        user_id: userId,
        spot_key: spot.id,
        shot_type: spot.shotType, // "2PT" | "3PT"
        target_attempts: defaultTarget,
        attempts: defaultTarget,
        makes: 0,
        order_index: idx,
      }));

      const { error: ssErr } = await supabase.from("session_spots").insert(rows);
      if (ssErr) {
        // Limpieza: si fallan los spots, borramos la sesión para no dejar basura
        await supabase.from("sessions").delete().eq("id", sessionId);
        throw ssErr;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 4) cerrar modal si estaba abierto y navegar a run
      setShowCourtModal(false);

      router.push({
        pathname: "/session/run",
        params: { sessionId },
      });
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e?.message ?? "Algo salió mal creando la sesión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: isSmall ? 16 : 20,
          paddingTop: 10,
          gap: 14,
        }}
      >
        <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>
          Crear sesión libre
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.65)" }}>
          Elegí posiciones (triples y dobles). Después cargás metidos por bloque.
        </Text>

        <Pressable
          disabled={saving}
          onPress={() => {
            setShowCourtModal(true);
            setCurrentSpotIndex(0);
          }}
        >
          <Court
            width={courtW}
            height={courtH}
            spots={ALL_SPOTS}
            selectedIds={selected}
            onToggleSpot={() => {}}
          />
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(11,18,32,0.95)",
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                {saving ? "Creando sesión..." : "Tocar para elegir spots"}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Modal con cancha grande */}
        <Modal
          visible={showCourtModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowCourtModal(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
            <View style={{ flex: 1 }}>
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.1)",
                }}
              >
                <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>
                  Elegir posiciones
                </Text>
                <Pressable
                  disabled={saving}
                  onPress={() => setShowCourtModal(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="close" size={24} color="white" />
                </Pressable>
              </View>

              {/* Cancha grande scrolleable */}
              <ScrollView
                contentContainerStyle={{
                  alignItems: "center",
                  paddingVertical: 20,
                }}
              >
                <Court
                  width={Math.min(width - 40, 600)}
                  height={Math.min(width - 40, 600) * 1.1}
                  spots={ALL_SPOTS}
                  selectedIds={selected}
                  onToggleSpot={saving ? () => {} : toggleSpot}
                  highlightedSpotId={currentSpot.id}
                />
              </ScrollView>

              {/* Navegador de spots */}
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.1)",
                  gap: 12,
                }}
              >
                {/* Info del spot actual */}
                <View style={{ alignItems: "center", gap: 4 }}>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                    Spot {currentSpotIndex + 1} de {ALL_SPOTS.length}
                  </Text>
                  <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>
                    {currentSpot.shotType === "3PT" ? "Triple" : "Doble"} -{" "}
                    {currentSpot.label}
                  </Text>
                </View>

                {/* Botón seleccionar/deseleccionar */}
                <Pressable
                  disabled={saving}
                  onPress={() => toggleSpot(currentSpot.id)}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: selected.has(currentSpot.id)
                      ? "rgba(34,197,94,0.2)"
                      : "rgba(245,158,11,0.2)",
                    borderWidth: 2,
                    borderColor: selected.has(currentSpot.id)
                      ? "rgba(34,197,94,0.8)"
                      : "rgba(245,158,11,0.8)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: selected.has(currentSpot.id)
                        ? "rgba(34,197,94,1)"
                        : "rgba(245,158,11,1)",
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    {selected.has(currentSpot.id) ? "✓ Seleccionado" : "Seleccionar"}
                  </Text>
                </Pressable>

                {/* Controles de navegación */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable
                    disabled={saving}
                    onPress={() =>
                      setCurrentSpotIndex((prev) =>
                        prev > 0 ? prev - 1 : ALL_SPOTS.length - 1
                      )
                    }
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8,
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    <Ionicons name="chevron-back" size={20} color="white" />
                    <Text style={{ color: "white", fontWeight: "700" }}>Anterior</Text>
                  </Pressable>

                  <Pressable
                    disabled={saving}
                    onPress={() =>
                      setCurrentSpotIndex((prev) =>
                        prev < ALL_SPOTS.length - 1 ? prev + 1 : 0
                      )
                    }
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8,
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>Siguiente</Text>
                    <Ionicons name="chevron-forward" size={20} color="white" />
                  </Pressable>
                </View>

                {/* Contador total */}
                <Text
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    textAlign: "center",
                    fontSize: 13,
                  }}
                >
                  Total seleccionadas:{" "}
                  <Text style={{ color: "white", fontWeight: "900" }}>
                    {selectedCount}
                  </Text>
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Target */}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            padding: 14,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
          }}
        >
          <View style={{ gap: 2 }}>
            <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 12 }}>
              Intentos por posición (default)
            </Text>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>
              {defaultTarget} tiros
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Chip
              disabled={saving}
              onPress={() => setDefaultTarget((v) => Math.max(1, v - 1))}
              label="-"
            />
            <Chip disabled={saving} onPress={() => setDefaultTarget((v) => v + 1)} label="+" />
          </View>
        </View>

        {/* Footer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.75)" }}>
            Seleccionadas:{" "}
            <Text style={{ color: "white", fontWeight: "900" }}>{selectedCount}</Text>
          </Text>

          <Pressable
            disabled={!canContinue}
            style={{
              height: 48,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: canContinue ? "#F59E0B" : "rgba(245,158,11,0.30)",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: saving ? 0.9 : 1,
            }}
            onPress={createSessionAndGo}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <>
                <Text style={{ color: "#0B1220", fontWeight: "900" }}>Listo</Text>
                <Ionicons name="chevron-forward" size={18} color="#0B1220" />
              </>
            )}
          </Pressable>
        </View>

        {/* Hint UX */}
        {!saving && selectedCount === 0 ? (
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
            Tip: tocá la cancha para elegir tus spots.
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Chip({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}