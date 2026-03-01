/**
 * Almacenamiento local de sesiones y spots para uso offline.
 * Permite crear y completar sesiones sin conexión a internet.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@st_local_session_";

export interface LocalSessionSpot {
  id: string;
  session_id: string;
  spot_key: string;
  shot_type: "2PT" | "3PT";
  target_attempts: number;
  attempts: number;
  makes: number;
  order_index: number;
}

export interface LocalSession {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  default_target_attempts: number;
  status: string;
  started_at: string;
  workout_id?: string | null;
}

export async function saveLocalSession(
  session: LocalSession,
  spots: LocalSessionSpot[],
): Promise<void> {
  await AsyncStorage.setItem(PREFIX + session.id, JSON.stringify({ session, spots }));
}

export async function loadLocalSession(
  sessionId: string,
): Promise<{ session: LocalSession; spots: LocalSessionSpot[] } | null> {
  const raw = await AsyncStorage.getItem(PREFIX + sessionId);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function updateLocalSpotMakes(
  sessionId: string,
  spotId: string,
  makes: number,
): Promise<void> {
  const data = await loadLocalSession(sessionId);
  if (!data) return;
  data.spots = data.spots.map((s) => (s.id === spotId ? { ...s, makes } : s));
  await AsyncStorage.setItem(PREFIX + sessionId, JSON.stringify(data));
}

export async function finishLocalSession(sessionId: string): Promise<void> {
  const data = await loadLocalSession(sessionId);
  if (!data) return;
  data.session.status = "DONE";
  await AsyncStorage.setItem(PREFIX + sessionId, JSON.stringify(data));
}

export async function deleteLocalSession(sessionId: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + sessionId);
}

/** Genera un UUID v4 simple sin dependencias externas */
export function generateUUID(): string {
  let d = Date.now();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
