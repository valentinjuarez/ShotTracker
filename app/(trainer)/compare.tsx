// app/(trainer)/compare.tsx — Head-to-head player comparison
import { supabase } from "@/src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerSummary = {
  user_id: string;
  display_name: string;
  sessions: number;
  attempts: number;
  makes: number;
  pct: number | null;
  tripleAtt: number;
  tripleMk: number;
  doubleAtt: number;
  doubleMk: number;
  spotBreakdown: SpotRow[];
};

type SpotRow = {
  spot_key: string;
  shot_type: string;
  attempts: number;
  makes: number;
  pct: number;
};

type PlayerStub = { user_id: string; display_name: string };

// ─── Color constants ──────────────────────────────────────────────────────────

const COL_A  = "#63B3ED"; // blue
const COL_B  = "#F59E0B"; // amber
const BG     = "#0B1220";
const CARD   = "rgba(255,255,255,0.055)";

const SPOT_LABEL: Record<string, string> = {
  "3pt_l1": "Triple Izq. · L1",  "3pt_l2": "Triple Izq. · L2",
  "3pt_l3": "Triple Izq. · L3",  "3pt_l4": "Triple Izq. · L4",
  "3pt_l5": "Triple Izq. · A5",  "3pt_l6": "Triple Izq. · A6",
  "3pt_l7": "Triple Izq. · A7",  "3pt_axis": "Triple Centro",
  "3pt_r7": "Triple Der. · A7",  "3pt_r6": "Triple Der. · A6",
  "3pt_r5": "Triple Der. · A5",  "3pt_r4": "Triple Der. · L4",
  "3pt_r3": "Triple Der. · L3",  "3pt_r2": "Triple Der. · L2",
  "3pt_r1": "Triple Der. · L1",
  "2pt_l3": "Doble Izq. · 3",    "2pt_l5": "Doble Izq. · 5",
  "2pt_l7": "Doble Izq. · 7",    "2pt_ft": "Tiro Libre",
  "2pt_r7": "Doble Der. · 7",    "2pt_r5": "Doble Der. · 5",
  "2pt_r3": "Doble Der. · 3",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(p: number | null) {
  return p !== null ? `${Math.round(p * 100)}%` : "—";
}

function pctColor(p: number | null) {
  if (p === null) return "rgba(255,255,255,0.35)";
  if (p >= 0.65) return "rgba(34,197,94,1)";
  if (p >= 0.40) return "rgba(245,158,11,1)";
  return "rgba(239,68,68,1)";
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CompareScreen() {
  const [teamId, setTeamId]     = useState<string | null>(null);
  const [roster, setRoster]     = useState<PlayerStub[]>([]);
  const [pickSlot, setPickSlot] = useState<"A" | "B" | null>(null);

  const [selA, setSelA] = useState<PlayerStub | null>(null);
  const [selB, setSelB] = useState<PlayerStub | null>(null);
  const [dataA, setDataA] = useState<PlayerSummary | null>(null);
  const [dataB, setDataB] = useState<PlayerSummary | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(true);

  // Load team roster once
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const { data: mem } = await supabase
        .from("team_members").select("team_id")
        .eq("user_id", uid).eq("role", "coach").maybeSingle();
      if (!mem) { setLoadingRoster(false); return; }

      const tid = (mem as any).team_id as string;
      setTeamId(tid);

      const { data: players } = await supabase
        .from("team_members").select("user_id")
        .eq("team_id", tid).eq("role", "player");

      const ids = (players ?? []).map((p: any) => p.user_id as string);
      if (!ids.length) { setLoadingRoster(false); return; }

      const { data: profiles } = await supabase
        .from("profiles").select("id, display_name").in("id", ids);

      setRoster(
        (profiles ?? []).map((p: any) => ({
          user_id: p.id,
          display_name: p.display_name ?? `#${p.id.slice(0, 6)}`,
        }))
      );
      setLoadingRoster(false);
    })();
  }, []);

  const loadPlayer = useCallback(async (stub: PlayerStub, slot: "A" | "B") => {
    const setter = slot === "A" ? setLoadingA : setLoadingB;
    const dataSetter = slot === "A" ? setDataA : setDataB;
    setter(true);
    try {
      // Collect all session IDs: free (user_id) + workout (workout_id in user's workouts)
      const { data: playerWorkouts } = await supabase
        .from("workouts").select("id").eq("user_id", stub.user_id);
      const wkIds = (playerWorkouts ?? []).map((w: any) => w.id as string);

      const [{ data: freeSess }, { data: wkSess }] = await Promise.all([
        supabase.from("sessions").select("id, started_at").eq("user_id", stub.user_id),
        wkIds.length > 0
          ? supabase.from("sessions").select("id, started_at").in("workout_id", wkIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const seenIds  = new Set((freeSess ?? []).map((s: any) => s.id as string));
      const combined = [...(freeSess ?? [])];
      (wkSess ?? []).forEach((s: any) => { if (!seenIds.has(s.id)) combined.push(s); });

      const sessionIds = combined.map((s: any) => s.id as string);

      let spots: any[] = [];
      if (sessionIds.length > 0) {
        const { data: sp } = await supabase
          .from("session_spots").select("spot_key, shot_type, attempts, makes")
          .in("session_id", sessionIds);
        spots = sp ?? [];
      }

      const spotMap: Record<string, { shot_type: string; att: number; mk: number }> = {};
      spots.forEach((s: any) => {
        if (!spotMap[s.spot_key]) spotMap[s.spot_key] = { shot_type: s.shot_type, att: 0, mk: 0 };
        spotMap[s.spot_key].att += s.attempts ?? 0;
        spotMap[s.spot_key].mk  += s.makes    ?? 0;
      });

      const breakdown: SpotRow[] = Object.entries(spotMap).map(([key, v]) => ({
        spot_key: key, shot_type: v.shot_type,
        attempts: v.att, makes: v.mk,
        pct: v.att > 0 ? v.mk / v.att : 0,
      })).sort((a, b) => b.pct - a.pct);

      const att = breakdown.reduce((a, s) => a + s.attempts, 0);
      const mk  = breakdown.reduce((a, s) => a + s.makes, 0);

      const triples = breakdown.filter((s) => s.shot_type === "3PT");
      const doubles = breakdown.filter((s) => s.shot_type !== "3PT");

      dataSetter({
        user_id: stub.user_id,
        display_name: stub.display_name,
        sessions: combined.length,
        attempts: att, makes: mk,
        pct: att > 0 ? mk / att : null,
        tripleAtt: triples.reduce((a, s) => a + s.attempts, 0),
        tripleMk:  triples.reduce((a, s) => a + s.makes, 0),
        doubleAtt: doubles.reduce((a, s) => a + s.attempts, 0),
        doubleMk:  doubles.reduce((a, s) => a + s.makes, 0),
        spotBreakdown: breakdown,
      });
    } finally {
      setter(false);
    }
  }, []);

  function pickPlayer(stub: PlayerStub) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (pickSlot === "A") { setSelA(stub); setDataA(null); loadPlayer(stub, "A"); }
    else                  { setSelB(stub); setDataB(null); loadPlayer(stub, "B"); }
    setPickSlot(null);
  }

  const bothLoaded = dataA !== null && dataB !== null;
  const loading    = loadingA || loadingB;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }}>
        <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, letterSpacing: 0.2 }}>Control</Text>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>Comparativa</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 14 }}
      >
        {/* ── Player pickers ──────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <PlayerPicker
            slot="A" color={COL_A}
            player={selA}
            loading={loadingA}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPickSlot("A"); }}
          />
          <View style={{ alignItems: "center", justifyContent: "center", width: 28 }}>
            <Text style={{ color: "rgba(255,255,255,0.25)", fontWeight: "900", fontSize: 16 }}>VS</Text>
          </View>
          <PlayerPicker
            slot="B" color={COL_B}
            player={selB}
            loading={loadingB}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPickSlot("B"); }}
          />
        </View>

        {/* ── Stats ──────────────────────────────────────────── */}
        {loading && (
          <ActivityIndicator color="#F59E0B" style={{ marginTop: 16 }} />
        )}

        {!loading && bothLoaded && (
          <>
            {/* General stats */}
            <SectionLabel>Estadísticas generales</SectionLabel>

            <StatDuel
              label="% Acierto general"
              a={{ value: dataA.pct, display: pct(dataA.pct), color: pctColor(dataA.pct) }}
              b={{ value: dataB.pct, display: pct(dataB.pct), color: pctColor(dataB.pct) }}
              higherIsBetter
            />
            <StatDuel
              label="Sesiones"
              a={{ value: dataA.sessions, display: `${dataA.sessions}` }}
              b={{ value: dataB.sessions, display: `${dataB.sessions}` }}
              higherIsBetter
            />
            <StatDuel
              label="Tiros totales"
              a={{ value: dataA.attempts, display: `${dataA.attempts}` }}
              b={{ value: dataB.attempts, display: `${dataB.attempts}` }}
              higherIsBetter
            />
            <StatDuel
              label="Metidos"
              a={{ value: dataA.makes, display: `${dataA.makes}` }}
              b={{ value: dataB.makes, display: `${dataB.makes}` }}
              higherIsBetter
            />

            {/* Triples */}
            <SectionLabel>Triples</SectionLabel>
            <StatDuel
              label="% Triples"
              a={{ value: dataA.tripleAtt > 0 ? dataA.tripleMk / dataA.tripleAtt : null,
                   display: dataA.tripleAtt > 0 ? pct(dataA.tripleMk / dataA.tripleAtt) : "—",
                   color: pctColor(dataA.tripleAtt > 0 ? dataA.tripleMk / dataA.tripleAtt : null) }}
              b={{ value: dataB.tripleAtt > 0 ? dataB.tripleMk / dataB.tripleAtt : null,
                   display: dataB.tripleAtt > 0 ? pct(dataB.tripleMk / dataB.tripleAtt) : "—",
                   color: pctColor(dataB.tripleAtt > 0 ? dataB.tripleMk / dataB.tripleAtt : null) }}
              higherIsBetter
            />
            <StatDuel
              label="Tiros triples"
              a={{ value: dataA.tripleAtt, display: `${dataA.tripleAtt}` }}
              b={{ value: dataB.tripleAtt, display: `${dataB.tripleAtt}` }}
              higherIsBetter
            />
            <StatDuel
              label="Triples metidos"
              a={{ value: dataA.tripleMk, display: `${dataA.tripleMk}` }}
              b={{ value: dataB.tripleMk, display: `${dataB.tripleMk}` }}
              higherIsBetter
            />

            {/* Dobles */}
            <SectionLabel>Dobles</SectionLabel>
            <StatDuel
              label="% Dobles"
              a={{ value: dataA.doubleAtt > 0 ? dataA.doubleMk / dataA.doubleAtt : null,
                   display: dataA.doubleAtt > 0 ? pct(dataA.doubleMk / dataA.doubleAtt) : "—",
                   color: pctColor(dataA.doubleAtt > 0 ? dataA.doubleMk / dataA.doubleAtt : null) }}
              b={{ value: dataB.doubleAtt > 0 ? dataB.doubleMk / dataB.doubleAtt : null,
                   display: dataB.doubleAtt > 0 ? pct(dataB.doubleMk / dataB.doubleAtt) : "—",
                   color: pctColor(dataB.doubleAtt > 0 ? dataB.doubleMk / dataB.doubleAtt : null) }}
              higherIsBetter
            />
            <StatDuel
              label="Tiros dobles"
              a={{ value: dataA.doubleAtt, display: `${dataA.doubleAtt}` }}
              b={{ value: dataB.doubleAtt, display: `${dataB.doubleAtt}` }}
              higherIsBetter
            />

            {/* Spot breakdown */}
            <SpotComparison dataA={dataA} dataB={dataB} />
          </>
        )}

        {!loading && !bothLoaded && (
          <View style={{
            marginTop: 12, padding: 24, borderRadius: 18,
            backgroundColor: CARD, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            alignItems: "center", gap: 10,
          }}>
            <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.15)" />
            <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 14, fontWeight: "700", textAlign: "center" }}>
              Seleccioná dos jugadoras{"\n"}para ver la comparativa
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Player picker modal ─────────────────────────────── */}
      <Modal visible={pickSlot !== null} transparent animationType="slide" onRequestClose={() => setPickSlot(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.60)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: "#0F1A2E", borderTopLeftRadius: 28, borderTopRightRadius: 28,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
            paddingTop: 12, paddingBottom: 40, maxHeight: "75%",
          }}>
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignSelf: "center", marginBottom: 14,
            }} />
            <Text style={{
              color: "white", fontWeight: "900", fontSize: 17, textAlign: "center", marginBottom: 16,
            }}>
              Elegir jugadora {pickSlot}
            </Text>

            {loadingRoster ? (
              <ActivityIndicator color="#F59E0B" style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {roster
                  .filter((r) => {
                    // Don't allow picking the same player for both slots
                    if (pickSlot === "A") return r.user_id !== selB?.user_id;
                    return r.user_id !== selA?.user_id;
                  })
                  .map((r) => (
                    <Pressable
                      key={r.user_id}
                      onPress={() => pickPlayer(r)}
                      style={({ pressed }) => ({
                        flexDirection: "row", alignItems: "center", gap: 12,
                        padding: 14, borderRadius: 14,
                        backgroundColor: pressed ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
                        borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
                      })}
                    >
                      <View style={{
                        width: 38, height: 38, borderRadius: 19,
                        backgroundColor: pickSlot === "A" ? "rgba(99,179,237,0.15)" : "rgba(245,158,11,0.15)",
                        borderWidth: 1.5,
                        borderColor: pickSlot === "A" ? "rgba(99,179,237,0.35)" : "rgba(245,158,11,0.35)",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Text style={{
                          color: pickSlot === "A" ? COL_A : COL_B,
                          fontWeight: "900", fontSize: 15,
                        }}>
                          {r.display_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, color: "white", fontWeight: "700", fontSize: 15 }}>
                        {r.display_name}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
                    </Pressable>
                  ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Player picker slot ───────────────────────────────────────────────────────

function PlayerPicker({ slot, color, player, loading, onPress }: {
  slot: "A" | "B"; color: string;
  player: PlayerStub | null;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, borderRadius: 16, padding: 14,
        backgroundColor: pressed ? "rgba(255,255,255,0.08)" : CARD,
        borderWidth: 1.5,
        borderColor: player ? `${color}55` : "rgba(255,255,255,0.10)",
        alignItems: "center", gap: 8,
        minHeight: 90,
        justifyContent: "center",
      })}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : player ? (
        <>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: `${color}20`,
            borderWidth: 2, borderColor: `${color}55`,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color, fontWeight: "900", fontSize: 18 }}>
              {player.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: "white", fontWeight: "800", fontSize: 13, textAlign: "center" }} numberOfLines={1}>
            {player.display_name}
          </Text>
          <Text style={{ color: `${color}99`, fontSize: 10, fontWeight: "700" }}>{slot} · Cambiar</Text>
        </>
      ) : (
        <>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)",
            borderStyle: "dashed",
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="add" size={22} color="rgba(255,255,255,0.25)" />
          </View>
          <Text style={{ color: "rgba(255,255,255,0.40)", fontWeight: "700", fontSize: 13 }}>
            Jugadora {slot}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{
      color: "rgba(255,255,255,0.35)", fontSize: 11,
      fontWeight: "700", letterSpacing: 1.0, textTransform: "uppercase",
      marginTop: 4,
    }}>
      {children}
    </Text>
  );
}

// ─── Stat duel row ────────────────────────────────────────────────────────────

type DuelSide = { value: number | null; display: string; color?: string };

function StatDuel({ label, a, b, higherIsBetter = true }: {
  label: string; a: DuelSide; b: DuelSide; higherIsBetter?: boolean;
}) {
  const av = a.value ?? 0;
  const bv = b.value ?? 0;
  const total = av + bv;

  // Winner highlight
  const aWins = higherIsBetter ? av > bv : av < bv;
  const bWins = higherIsBetter ? bv > av : bv < av;
  const tie   = av === bv;

  // Bar widths
  const aWidth = (total > 0 ? `${Math.round((av / total) * 100)}%` : "50%") as `${number}%`;
  const bWidth = (total > 0 ? `${Math.round((bv / total) * 100)}%` : "50%") as `${number}%`;

  return (
    <View style={{
      borderRadius: 16, padding: 14,
      backgroundColor: CARD,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
      gap: 10,
    }}>
      {/* Values row */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* A value */}
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          <Text style={{
            color: a.color ?? (aWins && !tie ? COL_A : "rgba(255,255,255,0.75)"),
            fontWeight: "900", fontSize: 22,
          }}>
            {a.display}
          </Text>
          {aWins && !tie && (
            <Ionicons name="trophy" size={12} color={COL_A} style={{ marginTop: 2 }} />
          )}
        </View>

        {/* Label */}
        <View style={{ alignItems: "center", paddingHorizontal: 8 }}>
          <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: "700", textAlign: "center" }}>
            {label}
          </Text>
        </View>

        {/* B value */}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={{
            color: b.color ?? (bWins && !tie ? COL_B : "rgba(255,255,255,0.75)"),
            fontWeight: "900", fontSize: 22,
          }}>
            {b.display}
          </Text>
          {bWins && !tie && (
            <View style={{ alignSelf: "flex-end", marginTop: 2 }}>
              <Ionicons name="trophy" size={12} color={COL_B} />
            </View>
          )}
        </View>
      </View>

      {/* Duel bar */}
      <View style={{ height: 6, borderRadius: 999, overflow: "hidden", flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)" }}>
        <View style={{ width: aWidth, height: "100%", backgroundColor: aWins && !tie ? COL_A : "rgba(99,179,237,0.55)", borderRadius: 999 }} />
        <View style={{ flex: 1, height: "100%", backgroundColor: bWins && !tie ? COL_B : "rgba(245,158,11,0.40)", borderRadius: 999 }} />
      </View>
    </View>
  );
}

// ─── Spot comparison ──────────────────────────────────────────────────────────

function SpotComparison({ dataA, dataB }: { dataA: PlayerSummary; dataB: PlayerSummary }) {
  // Only show spots that at least one player has data for
  const allKeys = new Set([
    ...dataA.spotBreakdown.map((s) => s.spot_key),
    ...dataB.spotBreakdown.map((s) => s.spot_key),
  ]);

  const spotMapA = new Map(dataA.spotBreakdown.map((s) => [s.spot_key, s]));
  const spotMapB = new Map(dataB.spotBreakdown.map((s) => [s.spot_key, s]));

  const triples = [...allKeys].filter((k) => k.startsWith("3pt"));
  const doubles = [...allKeys].filter((k) => k.startsWith("2pt"));

  function SpotGroup({ keys, groupLabel }: { keys: string[]; groupLabel: string }) {
    if (!keys.length) return null;
    return (
      <View style={{ gap: 8 }}>
        <SectionLabel>{groupLabel}</SectionLabel>
        {keys.map((key) => {
          const a = spotMapA.get(key);
          const b = spotMapB.get(key);
          const av = a?.pct ?? null;
          const bv = b?.pct ?? null;
          return (
            <View key={key} style={{
              borderRadius: 14, padding: 12,
              backgroundColor: CARD,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
              gap: 7,
            }}>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", textAlign: "center" }}>
                {SPOT_LABEL[key] ?? key}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {/* A bar */}
                <Text style={{ width: 38, color: av !== null ? pctColor(av) : "rgba(255,255,255,0.20)", fontWeight: "900", fontSize: 14, textAlign: "right" }}>
                  {av !== null ? `${Math.round(av * 100)}%` : "—"}
                </Text>
                <View style={{ flex: 1, height: 8, borderRadius: 999, overflow: "hidden", flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)" }}>
                  {/* Left (A) fill */}
                  <View style={{
                    width: av !== null ? `${Math.round(av * 100)}%` : "0%",
                    height: "100%",
                    backgroundColor: av !== null ? COL_A : "transparent",
                    borderRadius: 999,
                    opacity: 0.80,
                  }} />
                </View>
                <View style={{ flex: 1, height: 8, borderRadius: 999, overflow: "hidden", flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)" }}>
                  {/* Right (B) fill */}
                  <View style={{
                    width: bv !== null ? `${Math.round(bv * 100)}%` : "0%",
                    height: "100%",
                    backgroundColor: bv !== null ? COL_B : "transparent",
                    borderRadius: 999,
                    opacity: 0.80,
                  }} />
                </View>
                <Text style={{ width: 38, color: bv !== null ? pctColor(bv) : "rgba(255,255,255,0.20)", fontWeight: "900", fontSize: 14 }}>
                  {bv !== null ? `${Math.round(bv * 100)}%` : "—"}
                </Text>
              </View>

              {/* Sub-label: makes/attempts */}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                  {a ? `${a.makes}/${a.attempts}` : "0/0"}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                  {b ? `${b.makes}/${b.attempts}` : "0/0"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <SectionLabel>Comparativa por posición</SectionLabel>

      {/* Legend */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COL_A }} />
          <Text style={{ color: COL_A, fontWeight: "700", fontSize: 12 }}>{dataA.display_name}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: COL_B, fontWeight: "700", fontSize: 12 }}>{dataB.display_name}</Text>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COL_B }} />
        </View>
      </View>

      <SpotGroup keys={triples} groupLabel="Triples por posición" />
      <SpotGroup keys={doubles} groupLabel="Dobles por posición" />
    </View>
  );
}
