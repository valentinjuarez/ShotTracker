import { ALL_SPOTS } from "@/src/data/spots";
import { Court } from "@/src/features/session/components/Court";
import { useRunSessionController } from "@/src/features/session/hooks/useRunSessionController";
import { Ionicons } from "@expo/vector-icons";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

export default function RunSession() {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const courtW = Math.min(width - (isSmall ? 32 : 40), 520);
  const courtH = Math.round(courtW * 1.08);

  const {
    attempts,
    clampMakes,
    confirmExit,
    currentRow,
    idx,
    isOnline,
    loading,
    makesDraft,
    pendingSync,
    pct,
    progressText,
    saveCurrentAndNext,
    saving,
    selectedIdsForCourt,
    setMakesDraft,
    spotMeta,
    spotsRows,
  } = useRunSessionController();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 10 }}>
          Cargando sesión…
        </Text>
      </SafeAreaView>
    );
  }

  if (!currentRow) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "white", fontWeight: "900" }}>No hay spot actual</Text>
      </SafeAreaView>
    );
  }

  const titleType = currentRow.shot_type === "3PT" ? "Triple" : "Doble";
  const label = spotMeta?.label ?? currentRow.spot_key;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      {/* Banner offline / pendiente de sincronizar */}
      {(isOnline === false || pendingSync > 0) && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          paddingHorizontal: 16, paddingVertical: 9,
          backgroundColor: isOnline === false ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
          borderBottomWidth: 1,
          borderBottomColor: isOnline === false ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)",
        }}>
          <Ionicons
            name={isOnline === false ? "cloud-offline-outline" : "sync-outline"}
            size={15}
            color={isOnline === false ? "rgba(239,68,68,0.90)" : "rgba(245,158,11,0.90)"}
          />
          <Text style={{
            color: isOnline === false ? "rgba(239,68,68,0.90)" : "rgba(245,158,11,0.90)",
            fontSize: 12, fontWeight: "700", flex: 1,
          }}>
            {isOnline === false
              ? `Sin conexión — guardando localmente (${pendingSync} pendientes)`
              : `Sincronizando ${pendingSync} tiros al recuperar conexión…`}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, paddingHorizontal: isSmall ? 16 : 20, paddingTop: 10, gap: 14 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
              Spot {progressText}
            </Text>
            <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }} numberOfLines={1}>
              {titleType} · {label}
            </Text>
          </View>

          <Pressable
            onPress={confirmExit}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </View>

        {/* Court */}
        <View
          style={{
            borderRadius: 18,
            padding: 12,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            alignItems: "center",
          }}
        >
          <Court
            width={courtW}
            height={courtH}
            spots={ALL_SPOTS}
            selectedIds={selectedIdsForCourt}
            onToggleSpot={() => {}}
            highlightedSpotId={currentRow.spot_key}
          />
        </View>

        {/* Meter / attempts */}
        <View
          style={{
            borderRadius: 18,
            padding: 14,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            gap: 10,
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 12 }}>
            Metidos (sobre {attempts})
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 34 }}>
              {clampMakes(makesDraft)}/{attempts}
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <RoundBtn
                disabled={saving}
                label="-"
                onPress={() => setMakesDraft((v) => clampMakes(v - 1))}
              />
              <RoundBtn
                disabled={saving}
                label="+"
                onPress={() => setMakesDraft((v) => clampMakes(v + 1))}
              />
            </View>
          </View>

          <Text style={{ color: "rgba(255,255,255,0.65)" }}>
            Porcentaje: <Text style={{ color: "white", fontWeight: "900" }}>{pct}%</Text>
          </Text>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            disabled={saving}
            onPress={() => setMakesDraft(0)}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Reset</Text>
          </Pressable>

          <Pressable
            disabled={saving}
            onPress={saveCurrentAndNext}
            style={{
              flex: 2,
              height: 50,
              borderRadius: 16,
              backgroundColor: "#F59E0B",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
              opacity: saving ? 0.8 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <Ionicons
                name={idx >= spotsRows.length - 1 ? "checkmark" : "arrow-forward"}
                size={18}
                color="#0B1220"
              />
            )}
            <Text style={{ color: "#0B1220", fontWeight: "900" }}>
              {idx >= spotsRows.length - 1 ? "Finalizar" : "Guardar y siguiente"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function RoundBtn({
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
        width: 54,
        height: 54,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: "white", fontWeight: "900", fontSize: 22 }}>{label}</Text>
    </Pressable>
  );
}