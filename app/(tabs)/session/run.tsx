import { ALL_SPOTS } from "@/src/data/spots";
import { supabase } from "@/src/lib/supabase";
import { Court } from "@/src/ui/Court";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

type SessionSpotRow = {
  id: string;
  session_id: string;
  spot_key: string;
  shot_type: "2PT" | "3PT";
  target_attempts: number;
  attempts: number;
  makes: number;
  order_index: number;
};

export default function RunSession() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const courtW = Math.min(width - (isSmall ? 32 : 40), 520);
  const courtH = Math.round(courtW * 1.08);

  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [spotsRows, setSpotsRows] = useState<SessionSpotRow[]>([]);
  const [idx, setIdx] = useState(0);

  // "metidos" seleccionados para el spot actual (no persistido hasta guardar)
  const [makesDraft, setMakesDraft] = useState(0);

  const currentRow = spotsRows[idx];

  const spotMeta = useMemo(() => {
    if (!currentRow) return null;
    return ALL_SPOTS.find((s) => s.id === currentRow.spot_key) ?? null;
  }, [currentRow]);

  const selectedIdsForCourt = useMemo(() => {
    // para pintar "seleccionados" en cancha: todos los spots de la sesión
    return new Set(spotsRows.map((r) => r.spot_key));
  }, [spotsRows]);

  // Cargar datos de la sesión
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sessionId) {
        Alert.alert("Error", "Falta sessionId.");
        router.back();
        return;
      }

      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("session_spots")
          .select("id, session_id, spot_key, shot_type, target_attempts, attempts, makes, order_index")
          .eq("session_id", sessionId)
          .order("order_index", { ascending: true });

        if (error) throw error;

        const rows = (data ?? []) as SessionSpotRow[];
        if (!rows.length) {
          Alert.alert("Sin spots", "Esta sesión no tiene posiciones cargadas.");
          router.back();
          return;
        }

        if (!cancelled) {
          setSpotsRows(rows);
          setIdx(0);
          setMakesDraft(rows[0]?.makes ?? 0);
        }

        // opcional: marcar sesión IN_PROGRESS al entrar (si no lo hiciste antes)
        await supabase
          .from("sessions")
          .update({ status: "IN_PROGRESS" })
          .eq("id", sessionId);
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo cargar la sesión.");
        router.back();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  // cada vez que cambia de índice, precargar makesDraft del row actual
  useEffect(() => {
    if (!currentRow) return;
    setMakesDraft(currentRow.makes ?? 0);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const attempts = currentRow?.attempts ?? 10;
  const progressText = currentRow ? `${idx + 1} / ${spotsRows.length}` : "";

  function clampMakes(n: number) {
    if (!currentRow) return 0;
    return Math.max(0, Math.min(attempts, n));
  }

  async function saveCurrentAndNext() {
    if (!currentRow || !sessionId) return;
    if (saving) return;

    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const safeMakes = clampMakes(makesDraft);

      const { error } = await supabase
        .from("session_spots")
        .update({ makes: safeMakes })
        .eq("id", currentRow.id);

      if (error) throw error;

      // actualizar estado local
      setSpotsRows((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], makes: safeMakes };
        return next;
      });

      const isLast = idx >= spotsRows.length - 1;

      if (isLast) {
        await finishSession();
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIdx((v) => v + 1);
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e?.message ?? "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function finishSession() {
    if (!sessionId) return;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Try to mark as DONE — ignore errors (e.g. missing finished_at column)
      try {
        await supabase
          .from("sessions")
          .update({ status: "DONE" })
          .eq("id", sessionId);
      } catch {}

      try {
        await supabase
          .from("sessions")
          .update({ finished_at: new Date().toISOString() })
          .eq("id", sessionId);
      } catch {}

      router.replace({
        pathname: "/session/summary",
        params: { sessionId },
      });
    } catch (e: any) {
      Alert.alert(
        "Sesión guardada, pero…",
        e?.message ?? "No se pudo finalizar la sesión. Probá de nuevo."
      );
    }
  }

  async function confirmExit() {
    // UX: confirmación para no perder el flow
    Alert.alert(
      "Salir de la sesión",
      "Podés salir y volver después. ¿Querés salir ahora?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: () => router.back(),
        },
      ]
    );
  }

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

  const pct = attempts > 0 ? Math.round((clampMakes(makesDraft) / attempts) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
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

        {/* Mini hint */}
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
          Tip: guardá cada spot para avanzar en orden.
        </Text>
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