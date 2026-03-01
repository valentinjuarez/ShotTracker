// app/session/create.tsx
import { ALL_SPOTS, DOBLE_SPOTS, TRIPLE_SPOTS } from "@/src/data/spots";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { supabase } from "@/src/lib/supabase";
import { Court } from "@/src/ui/Court";
import { generateUUID, saveLocalSession } from "@/src/utils/localStore";
import { enqueueOp } from "@/src/utils/offlineQueue";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

//  Animation hooks 

function useFadeSlide(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 380, delay, useNativeDriver: true }).start();
  }, []);
  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
  };
}

function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  return { scale, onIn, onOut };
}

//  Types 

type SelectionMode = "FREE" | "3PT" | "2PT" | "ALL";

//  Main screen 

export default function CreateSession() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const courtPreviewW = Math.min(width - (isSmall ? 32 : 40), 420);
  const courtPreviewH = Math.round(courtPreviewW * 1.08);

  const [mode, setMode]                     = useState<SelectionMode>("FREE");
  const [selected, setSelected]             = useState<Set<string>>(new Set());
  const [defaultTarget, setDefaultTarget]   = useState(10);
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [currentSpotIndex, setCurrentSpotIndex] = useState(0);
  const [saving, setSaving]                 = useState(false);
  const { isOnline } = useNetworkStatus();

  const selectedCount = selected.size;
  const currentSpot   = ALL_SPOTS[currentSpotIndex];
  const canContinue   = selectedCount > 0 && !saving;

  const selectedSpots = useMemo(
    () => ALL_SPOTS.filter((s) => selected.has(s.id)),
    [selected]
  );

  // Entrance animations (staggered)
  const titleAnim   = useFadeSlide(0);
  const modeAnim    = useFadeSlide(80);
  const courtAnim   = useFadeSlide(160);
  const targetAnim  = useFadeSlide(240);
  const footerAnim  = useFadeSlide(320);

  //  Mode selection 
  function applyMode(m: SelectionMode) {
    setMode(m);
    switch (m) {
      case "3PT": setSelected(new Set(TRIPLE_SPOTS.map((s) => s.id))); break;
      case "2PT": setSelected(new Set(DOBLE_SPOTS.map((s)  => s.id))); break;
      case "ALL": setSelected(new Set(ALL_SPOTS.map((s)    => s.id))); break;
      case "FREE": setSelected(new Set()); break;
    }
  }

  function toggleSpot(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // If user manually edits a preset, transition to free mode
    if (mode !== "FREE") setMode("FREE");
  }

  const reset = useCallback(() => {
    setMode("FREE");
    setSelected(new Set());
    setDefaultTarget(10);
    setShowCourtModal(false);
    setCurrentSpotIndex(0);
    setSaving(false);
  }, []);

  useFocusEffect(
    useCallback(() => { return () => reset(); }, [reset])
  );

  //  Create session 
  async function createSessionAndGo() {
    if (saving) return;
    if (selectedCount === 0) {
      Alert.alert("Falta info", "Elegí al menos una posición.");
      return;
    }
    try {
      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = auth.user?.id;
      if (!userId) { Alert.alert("Error", "No hay usuario logueado."); return; }

      const modeLabel = mode === "3PT" ? "Triples" : mode === "2PT" ? "Dobles" : mode === "ALL" ? "Completo" : "Libre";
      const title = `Sesión ${modeLabel}  ${new Date().toLocaleDateString()}`;

      if (isOnline === false) {
        // ─ Modo offline: generar UUID local y guardar en AsyncStorage ─
        const sessionId = generateUUID();
        const now = new Date().toISOString();
        const sessionRow = {
          id: sessionId,
          user_id: userId,
          kind: "FREE",
          title,
          default_target_attempts: defaultTarget,
          status: "IN_PROGRESS",
          started_at: now,
          workout_id: null,
        };
        const spotRows = selectedSpots.map((spot, i) => ({
          id: generateUUID(),
          session_id: sessionId,
          user_id: userId,
          spot_key: spot.id,
          shot_type: spot.shotType as "2PT" | "3PT",
          target_attempts: defaultTarget,
          attempts: defaultTarget,
          makes: 0,
          order_index: i,
        }));
        await saveLocalSession(sessionRow, spotRows);
        await enqueueOp({ type: "CREATE_SESSION", session: sessionRow, spots: spotRows });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowCourtModal(false);
        router.push({ pathname: "/session/run", params: { sessionId } });
        return;
      }

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

      const rows = selectedSpots.map((spot, idx) => ({
        session_id: sessionId,
        user_id: userId,
        spot_key: spot.id,
        shot_type: spot.shotType,
        target_attempts: defaultTarget,
        attempts: defaultTarget,
        makes: 0,
        order_index: idx,
      }));

      const { error: ssErr } = await supabase.from("session_spots").insert(rows);
      if (ssErr) {
        await supabase.from("sessions").delete().eq("id", sessionId);
        throw ssErr;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCourtModal(false);
      router.push({ pathname: "/session/run", params: { sessionId } });
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e?.message ?? "Algo salió mal creando la sesión.");
    } finally {
      setSaving(false);
    }
  }

  // 
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: isSmall ? 16 : 20,
          paddingTop: 10,
          paddingBottom: 32,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/*  Title  */}
        <Animated.View style={titleAnim}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" }}>
            Nueva sesión
          </Text>
          <Text style={{ color: "white", fontSize: 24, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 }}>
            Elegí tu modo
          </Text>
        </Animated.View>

        {/*  Mode selector  */}
        <Animated.View style={modeAnim}>
          <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            Selección rápida
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <ModeBtn
              label="Triples"
              icon="radio-button-on"
              desc={`${TRIPLE_SPOTS.length} spots`}
              active={mode === "3PT"}
              accentColor="rgba(245,158,11,1)"
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                applyMode("3PT");
              }}
            />
            <ModeBtn
              label="Dobles"
              icon="radio-button-on"
              desc={`${DOBLE_SPOTS.length} spots`}
              active={mode === "2PT"}
              accentColor="rgba(34,197,94,1)"
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                applyMode("2PT");
              }}
            />
            <ModeBtn
              label="Completo"
              icon="globe"
              desc={`${ALL_SPOTS.length} spots`}
              active={mode === "ALL"}
              accentColor="rgba(99,179,237,1)"
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                applyMode("ALL");
              }}
            />
            <ModeBtn
              label="Libre"
              icon="create"
              desc="Elegí vos"
              active={mode === "FREE"}
              accentColor="rgba(167,139,250,1)"
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                applyMode("FREE");
              }}
            />
          </View>
        </Animated.View>

        {/*  Court preview  */}
        <Animated.View style={courtAnim}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
              Vista previa
            </Text>
            {mode === "FREE" && (
              <Pressable
                disabled={saving}
                onPress={() => { setShowCourtModal(true); setCurrentSpotIndex(0); }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10,
                  backgroundColor: "rgba(167,139,250,0.15)",
                  borderWidth: 1, borderColor: "rgba(167,139,250,0.35)",
                }}
              >
                <Ionicons name="pencil" size={13} color="rgba(167,139,250,1)" />
                <Text style={{ color: "rgba(167,139,250,1)", fontWeight: "800", fontSize: 12 }}>
                  {selectedCount > 0 ? "Editar selección" : "Elegir spots"}
                </Text>
              </Pressable>
            )}
            {mode !== "FREE" && selectedCount > 0 && (
              <Pressable
                disabled={saving}
                onPress={() => { setShowCourtModal(true); setCurrentSpotIndex(0); }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10,
                  backgroundColor: "rgba(255,255,255,0.07)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.13)",
                }}
              >
                <Ionicons name="options" size={13} color="rgba(255,255,255,0.70)" />
                <Text style={{ color: "rgba(255,255,255,0.70)", fontWeight: "700", fontSize: 12 }}>
                  Ajustar
                </Text>
              </Pressable>
            )}
          </View>

          <Pressable
            disabled={saving}
            onPress={() => {
              setShowCourtModal(true);
              setCurrentSpotIndex(0);
            }}
            style={{ alignItems: "center" }}
          >
            <Court
              width={courtPreviewW}
              height={courtPreviewH}
              spots={ALL_SPOTS}
              selectedIds={selected}
              onToggleSpot={() => {}}
            />
            {selectedCount === 0 && (
              <View style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(0,0,0,0.45)",
                alignItems: "center", justifyContent: "center", borderRadius: 18,
              }}>
                <View style={{
                  backgroundColor: "rgba(11,18,32,0.95)",
                  paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
                  flexDirection: "row", alignItems: "center", gap: 8,
                }}>
                  <Ionicons name="hand-left" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                    Elegí un modo o tocá para seleccionar
                  </Text>
                </View>
              </View>
            )}
          </Pressable>

          {/* Spot summary chips */}
          {selectedCount > 0 && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {(() => {
                const tripleCount = selectedSpots.filter((s) => s.shotType === "3PT").length;
                const dobleCount  = selectedSpots.filter((s) => s.shotType === "2PT").length;
                return (
                  <>
                    {tripleCount > 0 && (
                      <View style={{
                        flexDirection: "row", alignItems: "center", gap: 6,
                        paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
                        backgroundColor: "rgba(245,158,11,0.12)",
                        borderWidth: 1, borderColor: "rgba(245,158,11,0.30)",
                      }}>
                        <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: "rgba(245,158,11,1)" }} />
                        <Text style={{ color: "rgba(245,158,11,1)", fontWeight: "800", fontSize: 12 }}>
                          {tripleCount} triple{tripleCount !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                    {dobleCount > 0 && (
                      <View style={{
                        flexDirection: "row", alignItems: "center", gap: 6,
                        paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
                        backgroundColor: "rgba(34,197,94,0.12)",
                        borderWidth: 1, borderColor: "rgba(34,197,94,0.30)",
                      }}>
                        <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: "rgba(34,197,94,1)" }} />
                        <Text style={{ color: "rgba(34,197,94,1)", fontWeight: "800", fontSize: 12 }}>
                          {dobleCount} doble{dobleCount !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                    <View style={{
                      flexDirection: "row", alignItems: "center", gap: 6,
                      paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.07)",
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.13)",
                    }}>
                      <Ionicons name="basketball" size={12} color="rgba(255,255,255,0.65)" />
                      <Text style={{ color: "rgba(255,255,255,0.65)", fontWeight: "700", fontSize: 12 }}>
                        {selectedCount * defaultTarget} tiros total
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>
          )}
        </Animated.View>

        {/*  Target selector  */}
        <Animated.View style={[targetAnim, {
          flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "space-between",
          padding: 16, borderRadius: 18,
          backgroundColor: "rgba(255,255,255,0.06)",
          borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
        }]}>
          <Text style={{ color: "rgba(255,255,255,0.80)", fontSize: 14, fontWeight: "700" }}>
            Intentos por spot
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <StepperBtn
              icon="remove"
              disabled={defaultTarget <= 1}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDefaultTarget((v) => Math.max(1, v - 1));
              }}
            />
            <Text style={{
              color: "white", fontWeight: "900", fontSize: 22,
              minWidth: 44, textAlign: "center",
            }}>
              {defaultTarget}
            </Text>
            <StepperBtn
              icon="add"
              disabled={defaultTarget >= 50}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDefaultTarget((v) => Math.min(50, v + 1));
              }}
            />
          </View>
        </Animated.View>

        {/*  Footer  */}
        <Animated.View style={[footerAnim, { gap: 10 }]}>
          <StartBtn disabled={!canContinue} saving={saving} onPress={createSessionAndGo} />

          {!saving && selectedCount === 0 && (
            <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 12, textAlign: "center" }}>
              Seleccioná un modo o tocá la cancha para elegir posiciones manualmente.
            </Text>
          )}
        </Animated.View>
      </ScrollView>

      {/*  Court modal  */}
      <Modal
        visible={showCourtModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCourtModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
          <View style={{ flex: 1 }}>
            {/* Modal header */}
            <View style={{
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              paddingHorizontal: 20, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.09)",
            }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
                  Ajustar selección
                </Text>
                <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>Elegir posiciones</Text>
              </View>
              <Pressable
                disabled={saving}
                onPress={() => setShowCourtModal(false)}
                style={{
                  width: 38, height: 38, borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.09)",
                  alignItems: "center", justifyContent: "center",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                <Ionicons name="close" size={22} color="white" />
              </Pressable>
            </View>

            {/* Court */}
            <ScrollView contentContainerStyle={{ alignItems: "center", paddingVertical: 20 }}>
              <Court
                width={Math.min(width - 40, 600)}
                height={Math.min(width - 40, 600) * 1.1}
                spots={ALL_SPOTS}
                selectedIds={selected}
                onToggleSpot={saving ? () => {} : toggleSpot}
                highlightedSpotId={currentSpot.id}
              />
            </ScrollView>

            {/* Spot navigator */}
            <View style={{
              paddingHorizontal: 20, paddingVertical: 16,
              borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.09)",
              gap: 12,
            }}>
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ color: "rgba(255,255,255,0.50)", fontSize: 12 }}>
                  Spot {currentSpotIndex + 1} de {ALL_SPOTS.length}
                </Text>
                <Text style={{ color: "white", fontSize: 17, fontWeight: "900" }}>
                  {currentSpot.shotType === "3PT" ? "Triple" : "Doble"}  {currentSpot.label}
                </Text>
              </View>

              {/* Toggle button */}
              <Pressable
                disabled={saving}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleSpot(currentSpot.id);
                }}
                style={{
                  height: 52, borderRadius: 14,
                  backgroundColor: selected.has(currentSpot.id)
                    ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                  borderWidth: 1.5,
                  borderColor: selected.has(currentSpot.id)
                    ? "rgba(34,197,94,0.70)" : "rgba(245,158,11,0.70)",
                  alignItems: "center", justifyContent: "center",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text style={{
                  color: selected.has(currentSpot.id)
                    ? "rgba(34,197,94,1)" : "rgba(245,158,11,1)",
                  fontWeight: "900", fontSize: 16,
                }}>
                  {selected.has(currentSpot.id) ? " Seleccionado" : "Seleccionar"}
                </Text>
              </Pressable>

              {/* Prev / Next */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  disabled={saving}
                  onPress={() => setCurrentSpotIndex((p) => p > 0 ? p - 1 : ALL_SPOTS.length - 1)}
                  style={{
                    flex: 1, height: 46, borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    alignItems: "center", justifyContent: "center",
                    flexDirection: "row", gap: 8, opacity: saving ? 0.6 : 1,
                  }}
                >
                  <Ionicons name="chevron-back" size={18} color="white" />
                  <Text style={{ color: "white", fontWeight: "700" }}>Anterior</Text>
                </Pressable>
                <Pressable
                  disabled={saving}
                  onPress={() => setCurrentSpotIndex((p) => p < ALL_SPOTS.length - 1 ? p + 1 : 0)}
                  style={{
                    flex: 1, height: 46, borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    alignItems: "center", justifyContent: "center",
                    flexDirection: "row", gap: 8, opacity: saving ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>Siguiente</Text>
                  <Ionicons name="chevron-forward" size={18} color="white" />
                </Pressable>
              </View>

              <Text style={{ color: "rgba(255,255,255,0.50)", textAlign: "center", fontSize: 13 }}>
                Total:{" "}
                <Text style={{ color: "white", fontWeight: "900" }}>{selectedCount}</Text>
                {" "}posiciones
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

//  Sub-components 

function ModeBtn({
  label, icon, desc, active, accentColor, onPress,
}: {
  label: string; icon: any; desc: string; active: boolean;
  accentColor: string; onPress: () => void;
}) {
  const { scale, onIn, onOut } = usePressScale();
  // Derive a semi-transparent version of the accent for background/border
  const bgActive     = accentColor.replace("1)", "0.14)");
  const borderActive = accentColor.replace("1)", "0.50)");

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1, minWidth: "44%" }}>
      <Pressable
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        style={{
          padding: 14, borderRadius: 18, gap: 6,
          backgroundColor: active ? bgActive : "rgba(255,255,255,0.06)",
          borderWidth: 1.5,
          borderColor: active ? borderActive : "rgba(255,255,255,0.10)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons
            name={icon}
            size={16}
            color={active ? accentColor : "rgba(255,255,255,0.55)"}
          />
          <Text style={{
            color: active ? accentColor : "rgba(255,255,255,0.90)",
            fontWeight: "900", fontSize: 14,
          }}>
            {label}
          </Text>
          {active && (
            <View style={{ marginLeft: "auto" }}>
              <Ionicons name="checkmark-circle" size={16} color={accentColor} />
            </View>
          )}
        </View>
        <Text style={{
          color: active ? accentColor.replace("1)", "0.70)") : "rgba(255,255,255,0.40)",
          fontSize: 11,
        }}>
          {desc}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function StepperBtn({
  icon, disabled, onPress,
}: {
  icon: "add" | "remove"; disabled: boolean; onPress: () => void;
}) {
  const { scale, onIn, onOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        disabled={disabled}
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        style={{
          width: 44, height: 44, borderRadius: 13,
          backgroundColor: disabled ? "rgba(255,255,255,0.04)" : "rgba(245,158,11,0.15)",
          borderWidth: 1.5,
          borderColor: disabled ? "rgba(255,255,255,0.08)" : "rgba(245,158,11,0.50)",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons
          name={icon}
          size={22}
          color={disabled ? "rgba(255,255,255,0.25)" : "#F59E0B"}
        />
      </Pressable>
    </Animated.View>
  );
}

function StartBtn({
  disabled, saving, onPress,
}: {
  disabled: boolean; saving: boolean; onPress: () => void;
}) {
  const { scale, onIn, onOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        disabled={disabled}
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        style={{
          height: 56, borderRadius: 18,
          backgroundColor: disabled ? "rgba(245,158,11,0.25)" : "#F59E0B",
          alignItems: "center", justifyContent: "center",
          flexDirection: "row", gap: 10,
        }}
      >
        {saving ? (
          <ActivityIndicator color="#0B1220" />
        ) : (
          <>
            <Ionicons name="play" size={18} color={disabled ? "rgba(11,18,32,0.45)" : "#0B1220"} />
            <Text style={{
              color: disabled ? "rgba(11,18,32,0.45)" : "#0B1220",
              fontWeight: "900", fontSize: 16,
            }}>
              {disabled ? "Elegí al menos 1 spot" : "Empezar sesión"}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
