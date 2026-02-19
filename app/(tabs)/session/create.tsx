// app/session/create.tsx
import { ALL_SPOTS } from "@/src/data/spots";
import { Court } from "@/src/ui/Court";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

export default function CreateSession() {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const courtW = 340;
  const courtH = 380;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultTarget, setDefaultTarget] = useState(10);
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [currentSpotIndex, setCurrentSpotIndex] = useState(0);

  const selectedCount = selected.size;
  const currentSpot = ALL_SPOTS[currentSpotIndex];

  function toggleSpot(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canContinue = selectedCount > 0;

  const reset = useCallback(() => {
    setSelected(new Set());
    setDefaultTarget(10);
    setShowCourtModal(false);
    setCurrentSpotIndex(0);
  }, []);

  // ✅ Reset cuando salís de la pantalla
  useFocusEffect(
    useCallback(() => {
      return () => {
        reset();
      };
    }, [reset])
  );

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
                Tocar para elegir spots
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
                  onPress={() => setShowCourtModal(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    alignItems: "center",
                    justifyContent: "center",
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
                  onToggleSpot={toggleSpot}
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
                    }}
                  >
                    <Ionicons name="chevron-back" size={20} color="white" />
                    <Text style={{ color: "white", fontWeight: "700" }}>Anterior</Text>
                  </Pressable>

                  <Pressable
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
            <Chip onPress={() => setDefaultTarget((v) => Math.max(1, v - 1))} label="-" />
            <Chip onPress={() => setDefaultTarget((v) => v + 1)} label="+" />
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
            }}
            onPress={() => {
              console.log("Selected:", Array.from(selected), "defaultTarget:", defaultTarget);
            }}
          >
            <Text style={{ color: "#0B1220", fontWeight: "900" }}>Listo</Text>
            <Ionicons name="chevron-forward" size={18} color="#0B1220" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
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
      }}
    >
      <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}
