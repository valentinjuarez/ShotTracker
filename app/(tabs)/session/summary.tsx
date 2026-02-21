// app/session/summary.tsx
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
    ScrollView,
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

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

// Interpola entre rojo -> amarillo -> verde (sin librerías)
function heatColor(p: number) {
  const t = clamp01(p);
  // 0..0.5: rojo -> amarillo
  // 0.5..1: amarillo -> verde
  const toHex = (n: number) => n.toString(16).padStart(2, "0");

  let r = 0,
    g = 0,
    b = 0;
  if (t <= 0.5) {
    const k = t / 0.5; // 0..1
    r = 255;
    g = Math.round(40 + (215 - 40) * k); // 40 -> 215
    b = 60;
  } else {
    const k = (t - 0.5) / 0.5; // 0..1
    r = Math.round(255 + (34 - 255) * k); // 255 -> 34
    g = 215;
    b = Math.round(60 + (94 - 60) * k); // 60 -> 94
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function SessionSummary() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const courtW = Math.min(width - (isSmall ? 32 : 40), 520);
  const courtH = Math.round(courtW * 1.08);

  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SessionSpotRow[]>([]);
  const [mode, setMode] = useState<"HEAT" | "LIST">("HEAT");
  const [selectedSpotKey, setSelectedSpotKey] = useState<string | null>(null);

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

        const r = (data ?? []) as SessionSpotRow[];
        if (!r.length) {
          Alert.alert("Sin datos", "No hay tiros registrados para esta sesión.");
          router.back();
          return;
        }

        if (!cancelled) {
          setRows(r);
          setSelectedSpotKey(r[0]?.spot_key ?? null);
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo cargar el resumen.");
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

  const selectedIds = useMemo(() => new Set(rows.map((r) => r.spot_key)), [rows]);

  const stats = useMemo(() => {
    const totalAttempts = rows.reduce((acc, r) => acc + (r.attempts ?? 0), 0);
    const totalMakes = rows.reduce((acc, r) => acc + (r.makes ?? 0), 0);
    const pct = totalAttempts > 0 ? totalMakes / totalAttempts : 0;

    const perSpot = rows.map((r) => {
      const p = r.attempts > 0 ? r.makes / r.attempts : 0;
      return { ...r, pct: p };
    });

    const sorted = [...perSpot].sort((a, b) => b.pct - a.pct);

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    // consistencia: qué tan dispersos fueron tus % (desvío simple)
    const mean = perSpot.reduce((acc, r) => acc + r.pct, 0) / Math.max(1, perSpot.length);
    const variance =
      perSpot.reduce((acc, r) => acc + Math.pow(r.pct - mean, 2), 0) / Math.max(1, perSpot.length);
    const std = Math.sqrt(variance);

    return { totalAttempts, totalMakes, pct, perSpot, best, worst, mean, std };
  }, [rows]);

  const spotMetaByKey = useMemo(() => {
    const map = new Map<string, (typeof ALL_SPOTS)[number]>();
    ALL_SPOTS.forEach((s) => map.set(s.id, s));
    return map;
  }, []);

  const heatSpots = useMemo(() => {
    // construimos spots para el Court (misma estructura que ALL_SPOTS),
    // pero inyectamos "heat" en label para debug/tooltip visual (opcional)
    // El color lo vamos a pintar con un overlay abajo.
    return ALL_SPOTS;
  }, []);

  const selectedRow = useMemo(() => {
    if (!selectedSpotKey) return null;
    return stats.perSpot.find((r) => r.spot_key === selectedSpotKey) ?? null;
  }, [selectedSpotKey, stats.perSpot]);

  const selectedMeta = selectedSpotKey ? spotMetaByKey.get(selectedSpotKey) : null;

  // Para pintar “heat” sin tocar tu Court.tsx:
  // hacemos una leyenda + y usamos highlightedSpotId para foco,
  // y mostramos chips de color + lista interactiva.
  // Si querés que la cancha pinte cada spot con color real,
  // te paso después una versión de Court que acepte spotColorMap.

  function pctLabel(p: number) {
    return `${Math.round(p * 100)}%`;
  }

  async function onHaptic() {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 10 }}>
          Cargando resumen…
        </Text>
      </SafeAreaView>
    );
  }

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
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 2, flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
              Resumen de sesión
            </Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }} numberOfLines={1}>
              Mapa de calor + stats
            </Text>
          </View>

          <Pressable
            onPress={() => router.replace("/")}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Ionicons name="home" size={18} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </View>

        {/* Mode toggle */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <SegBtn
            active={mode === "HEAT"}
            text="Mapa de calor"
            icon="flame"
            onPress={async () => {
              await onHaptic();
              setMode("HEAT");
            }}
          />
          <SegBtn
            active={mode === "LIST"}
            text="Lista"
            icon="list"
            onPress={async () => {
              await onHaptic();
              setMode("LIST");
            }}
          />
        </View>

        {/* Top stats */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatPill title="Metidos" value={`${stats.totalMakes}`} />
          <StatPill title="Intentos" value={`${stats.totalAttempts}`} />
          <StatPill title="Promedio" value={pctLabel(stats.pct)} />
        </View>

        {/* Insights */}
        <View style={card}>
          <Text style={label}>Insights</Text>

          <View style={{ marginTop: 8, gap: 10 }}>
            <InsightRow
              title="Mejor spot"
              value={`${spotMetaByKey.get(stats.best?.spot_key ?? "")?.label ?? stats.best?.spot_key ?? "—"} · ${pctLabel(stats.best?.pct ?? 0)}`}
              color={heatColor(stats.best?.pct ?? 0)}
              icon="trending-up"
            />
            <InsightRow
              title="Peor spot"
              value={`${spotMetaByKey.get(stats.worst?.spot_key ?? "")?.label ?? stats.worst?.spot_key ?? "—"} · ${pctLabel(stats.worst?.pct ?? 0)}`}
              color={heatColor(stats.worst?.pct ?? 0)}
              icon="trending-down"
            />
            <InsightRow
              title="Consistencia"
              value={`${Math.max(0, Math.round((1 - stats.std) * 100))}%`}
              color="rgba(255,255,255,0.7)"
              icon="analytics"
              hint="Mientras más alto, más parejos tus % entre spots."
            />
          </View>
        </View>

        {/* Heat / List */}
        {mode === "HEAT" ? (
          <>
            <View style={card}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ gap: 2 }}>
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
                    Mapa de calor
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 12 }}>
                    Tocá un spot desde la lista para enfocarlo.
                  </Text>
                </View>

                {/* Leyenda */}
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <LegendDot color={heatColor(0)} text="Bajo" />
                  <LegendDot color={heatColor(0.5)} text="Medio" />
                  <LegendDot color={heatColor(1)} text="Alto" />
                </View>
              </View>

              <View style={{ marginTop: 12, alignItems: "center" }}>
                <Court
                  width={courtW}
                  height={courtH}
                  spots={heatSpots}
                  selectedIds={selectedIds}
                  onToggleSpot={() => {}}
                  highlightedSpotId={selectedSpotKey ?? undefined}
                />
              </View>

              {/* Selector rápido tipo carrusel */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ marginTop: 12, gap: 10 }}
              >
                {stats.perSpot
                  .slice()
                  .sort((a, b) => b.pct - a.pct)
                  .map((r) => {
                    const meta = spotMetaByKey.get(r.spot_key);
                    const isSel = selectedSpotKey === r.spot_key;
                    const c = heatColor(r.pct);

                    return (
                      <Pressable
                        key={r.id}
                        onPress={async () => {
                          await onHaptic();
                          setSelectedSpotKey(r.spot_key);
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 14,
                          backgroundColor: isSel ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
                          borderWidth: 1,
                          borderColor: isSel ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)",
                          minWidth: 130,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 999,
                              backgroundColor: c,
                            }}
                          />
                          <Text style={{ color: "white", fontWeight: "900" }} numberOfLines={1}>
                            {meta?.label ?? r.spot_key}
                          </Text>
                        </View>
                        <Text style={{ color: "rgba(255,255,255,0.65)", marginTop: 6 }}>
                          {r.makes}/{r.attempts} · {pctLabel(r.pct)}
                        </Text>
                      </Pressable>
                    );
                  })}
              </ScrollView>
            </View>

            {/* Spot detail */}
            <View style={card}>
              <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
                Detalle del spot
              </Text>

              {selectedRow ? (
                <View style={{ marginTop: 10, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={{ color: "rgba(255,255,255,0.65)" }}>
                        {selectedRow.shot_type === "3PT" ? "Triple" : "Doble"}
                      </Text>
                      <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }} numberOfLines={1}>
                        {selectedMeta?.label ?? selectedRow.spot_key}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>
                        {pctLabel(selectedRow.pct)}
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.60)" }}>
                        {selectedRow.makes}/{selectedRow.attempts}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      height: 12,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.10)",
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.round(selectedRow.pct * 100)}%`,
                        height: "100%",
                        backgroundColor: heatColor(selectedRow.pct),
                      }}
                    />
                  </View>

                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                    Sugerencia: si este spot es “bajo”, agregá 1–2 sesiones extra enfocadas ahí.
                  </Text>
                </View>
              ) : (
                <Text style={{ color: "rgba(255,255,255,0.65)", marginTop: 10 }}>
                  Elegí un spot para ver el detalle.
                </Text>
              )}
            </View>
          </>
        ) : (
          <View style={card}>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
              Lista (ordenada por rendimiento)
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.60)", marginTop: 6, fontSize: 12 }}>
              Tocá un item para enfocarlo en el mapa.
            </Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              {stats.perSpot
                .slice()
                .sort((a, b) => b.pct - a.pct)
                .map((r, i) => {
                  const meta = spotMetaByKey.get(r.spot_key);
                  const c = heatColor(r.pct);
                  const isSel = selectedSpotKey === r.spot_key;

                  return (
                    <Pressable
                      key={r.id}
                      onPress={async () => {
                        await onHaptic();
                        setSelectedSpotKey(r.spot_key);
                        setMode("HEAT");
                      }}
                      style={{
                        padding: 12,
                        borderRadius: 16,
                        backgroundColor: isSel ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
                        borderWidth: 1,
                        borderColor: isSel ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 999,
                              backgroundColor: c,
                            }}
                          />
                          <Text style={{ color: "white", fontWeight: "900" }} numberOfLines={1}>
                            #{i + 1} · {meta?.label ?? r.spot_key}
                          </Text>
                        </View>
                        <Text style={{ color: "white", fontWeight: "900" }}>
                          {pctLabel(r.pct)}
                        </Text>
                      </View>

                      <Text style={{ color: "rgba(255,255,255,0.60)", marginTop: 6 }}>
                        {r.makes}/{r.attempts} · {r.shot_type}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        )}

        {/* Bottom actions */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={async () => {
              await onHaptic();
              router.replace("/");
            }}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
            }}
          >
            <Ionicons name="home" size={18} color="rgba(255,255,255,0.9)" />
            <Text style={{ color: "white", fontWeight: "900" }}>Home</Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              await onHaptic();
              // Ideal: crear una nueva sesión igual a esta.
              // Por ahora, te llevo a crear sesión.
              router.push("/session/create");
            }}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 16,
              backgroundColor: "#F59E0B",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
            }}
          >
            <Ionicons name="refresh" size={18} color="#0B1220" />
            <Text style={{ color: "#0B1220", fontWeight: "900" }}>Nueva sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- UI bits ---------------- */

function SegBtn({
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

function StatPill({ title, value }: { title: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        gap: 6,
      }}
    >
      <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>{title}</Text>
      <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>{value}</Text>
    </View>
  );
}

function LegendDot({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color }} />
      <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>{text}</Text>
    </View>
  );
}

function InsightRow({
  title,
  value,
  color,
  icon,
  hint,
}: {
  title: string;
  value: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint?: string;
}) {
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 16,
        backgroundColor: "rgba(0,0,0,0.22)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <Ionicons name={icon} size={18} color="rgba(255,255,255,0.85)" />
          <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 12 }}>{title}</Text>
        </View>

        <View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: color }} />
      </View>

      <Text style={{ color: "white", fontWeight: "900" }} numberOfLines={2}>
        {value}
      </Text>

      {hint ? (
        <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 11 }}>{hint}</Text>
      ) : null}
    </View>
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