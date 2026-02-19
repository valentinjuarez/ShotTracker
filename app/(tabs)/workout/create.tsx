// app/workout/create.tsx
import { DOBLE_SPOTS, TRIPLE_SPOTS } from "@/src/data/spots";
import { Court } from "@/src/ui/Court";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

type PlanTipo = "3PT" | "2PT";

export default function CreateWorkout() {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const courtW = Math.min(width - (isSmall ? 32 : 40), 420);
  const courtH = Math.round(courtW * 1.2);

  const [name, setName] = useState("Planilla de tiro");
  const [tipo, setTipo] = useState<PlanTipo>("3PT");
  const [sessionsGoal, setSessionsGoal] = useState(14);
  const [defaultTarget, setDefaultTarget] = useState(10);

  const spots = useMemo(
    () => (tipo === "3PT" ? TRIPLE_SPOTS : DOBLE_SPOTS),
    [tipo]
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(TRIPLE_SPOTS.map((s) => s.id))
  );

  const [saving, setSaving] = useState(false);

  const syncSelection = (newTipo: PlanTipo) => {
    const newSpots = newTipo === "3PT" ? TRIPLE_SPOTS : DOBLE_SPOTS;
    setSelected(new Set(newSpots.map((s) => s.id)));
  };

  function toggleSpot(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCount = selected.size;

  const canCreate =
    name.trim().length > 0 &&
    selectedCount > 0 &&
    sessionsGoal > 0 &&
    defaultTarget > 0;

  function setAll(on: boolean) {
    if (on) setSelected(new Set(spots.map((s) => s.id)));
    else setSelected(new Set());
  }

  async function onCreateWorkout() {
    if (!canCreate) {
      Alert.alert("Falta info", "Completá el nombre y elegí al menos una posición.");
      return;
    }

    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const resumen =
        `Nombre: ${name.trim()}\n` +
        `Tipo: ${tipo === "3PT" ? "Triples" : "Dobles"}\n` +
        `Objetivo de sesiones: ${sessionsGoal}\n` +
        `Intentos por posición: ${defaultTarget}\n` +
        `Posiciones seleccionadas: ${selected.size}`;

      Alert.alert("Planilla lista (preview)", resumen);
    } finally {
      setSaving(false);
    }
  }

  const reset = useCallback(() => {
    setName("Planilla de tiro");
    setTipo("3PT");
    setSessionsGoal(14);
    setDefaultTarget(10);
    setSelected(new Set(TRIPLE_SPOTS.map((s) => s.id)));
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: isSmall ? 16 : 20,
          paddingTop: 10,
          paddingBottom: 24,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>
          Crear planilla
        </Text>

        <Text style={{ color: "rgba(255,255,255,0.65)" }}>
          Configurá un ciclo de entrenamiento (ej: 14 sesiones). Luego vas completando
          sesión por sesión.
        </Text>

        {/* Nombre */}
        <View style={card}>
          <Text style={label}>Nombre de la planilla</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej: Triples pretemporada"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={input}
          />
        </View>

        {/* Tipo */}
        <View style={card}>
          <Text style={label}>Tipo de tiros</Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <ToggleButton
              active={tipo === "3PT"}
              text="Triples"
              icon="basketball"
              onPress={() => {
                setTipo("3PT");
                syncSelection("3PT");
              }}
            />
            <ToggleButton
              active={tipo === "2PT"}
              text="Dobles"
              icon="basketball-outline"
              onPress={() => {
                setTipo("2PT");
                syncSelection("2PT");
              }}
            />
          </View>

          <Text style={{ color: "rgba(255,255,255,0.55)", marginTop: 8, fontSize: 12 }}>
            {tipo === "3PT"
              ? "Se mostrarán solo las posiciones de triple (incluye X del eje)."
              : "Se mostrarán solo las posiciones de doble (incluye TL en el eje)."}
          </Text>
        </View>

        {/* Spots */}
        <View style={card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ gap: 2 }}>
              <Text style={label}>Posiciones</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                Seleccionadas:{" "}
                <Text style={{ color: "white", fontWeight: "900" }}>
                  {selectedCount}
                </Text>
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <MiniButton text="Todas" onPress={() => setAll(true)} />
              <MiniButton text="Ninguna" onPress={() => setAll(false)} />
            </View>
          </View>

          <View style={{ marginTop: 12, alignItems: "center" }}>
            <Court
              width={courtW}
              height={courtH}
              spots={spots}
              selectedIds={selected}
              onToggleSpot={toggleSpot}
            />
          </View>
        </View>

        {/* Config */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <CounterCard
            title="Objetivo de sesiones"
            value={`${sessionsGoal}`}
            onDec={() => setSessionsGoal((v) => Math.max(1, v - 1))}
            onInc={() => setSessionsGoal((v) => v + 1)}
          />
          <CounterCard
            title="Intentos por posición"
            value={`${defaultTarget}`}
            onDec={() => setDefaultTarget((v) => Math.max(1, v - 1))}
            onInc={() => setDefaultTarget((v) => v + 1)}
          />
        </View>

        {/* Crear */}
        <Pressable
          disabled={!canCreate || saving}
          onPress={onCreateWorkout}
          style={{
            height: 52,
            borderRadius: 16,
            backgroundColor: canCreate && !saving ? "#F59E0B" : "rgba(245,158,11,0.30)",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
            marginTop: 4,
          }}
        >
          {saving ? (
            <ActivityIndicator />
          ) : (
            <Ionicons name="clipboard" size={18} color="#0B1220" />
          )}

          <Text style={{ color: "#0B1220", fontWeight: "900", fontSize: 15 }}>
            {saving ? "Creando..." : "Crear planilla"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const card = {
  padding: 14,
  borderRadius: 16,
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
} as const;

const label = {
  color: "rgba(255,255,255,0.70)",
  fontSize: 12,
} as const;

const input = {
  marginTop: 8,
  borderRadius: 14,
  paddingHorizontal: 12,
  paddingVertical: 12,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
  backgroundColor: "rgba(0,0,0,0.25)",
  color: "white",
  fontSize: 15,
} as const;

function ToggleButton({
  active,
  text,
  icon,
  onPress,
}: {
  active: boolean;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        backgroundColor: active ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: active ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.12)",
      }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? "#F59E0B" : "rgba(255,255,255,0.70)"}
      />
      <Text style={{ color: "white", fontWeight: "900" }}>{text}</Text>
    </Pressable>
  );
}

function MiniButton({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
      }}
    >
      <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>
        {text}
      </Text>
    </Pressable>
  );
}

function CounterCard({
  title,
  value,
  onDec,
  onInc,
}: {
  title: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        gap: 10,
      }}
    >
      <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 12 }}>
        {title}
      </Text>
      <Text style={{ color: "white", fontWeight: "900", fontSize: 22 }}>
        {value}
      </Text>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={onDec}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>
            -
          </Text>
        </Pressable>
        <Pressable
          onPress={onInc}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
