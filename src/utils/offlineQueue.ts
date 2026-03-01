/**
 * Cola de operaciones offline.
 * Las operaciones se guardan en AsyncStorage y se procesan cuando
 * se recupera la conexión a internet.
 */
import { supabase } from "@/src/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteLocalSession } from "./localStore";

const QUEUE_KEY = "@st_sync_queue";

export type QueuedOp =
  | {
      type: "CREATE_SESSION";
      session: {
        id: string;
        user_id: string;
        kind: string;
        title: string;
        default_target_attempts: number;
        status: string;
        started_at: string;
        workout_id?: string | null;
      };
      spots: {
        id: string;
        session_id: string;
        user_id: string;
        spot_key: string;
        shot_type: string;
        target_attempts: number;
        attempts: number;
        makes: number;
        order_index: number;
      }[];
    }
  | { type: "UPDATE_SPOT"; spotId: string; makes: number }
  | { type: "FINISH_SESSION"; sessionId: string; finishedAt: string }
  | { type: "FINISH_WORKOUT"; workoutId: string };

async function readQueue(): Promise<QueuedOp[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue: QueuedOp[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Encola una operación. UPDATE_SPOT se deduplica por spotId (último gana). */
export async function enqueueOp(op: QueuedOp): Promise<void> {
  const queue = await readQueue();
  if (op.type === "UPDATE_SPOT") {
    const idx = queue.findIndex(
      (q) => q.type === "UPDATE_SPOT" && (q as any).spotId === op.spotId,
    );
    if (idx >= 0) {
      queue[idx] = op;
    } else {
      queue.push(op);
    }
  } else {
    // Evitar duplicados de FINISH_SESSION / FINISH_WORKOUT
    const isDuplicate = queue.some(
      (q) =>
        q.type === op.type &&
        (q as any).sessionId === (op as any).sessionId &&
        (q as any).workoutId === (op as any).workoutId,
    );
    if (!isDuplicate) queue.push(op);
  }
  await writeQueue(queue);
}

/** Cuántas operaciones están pendientes. */
export async function getPendingCount(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

/** Procesa la cola: envía operaciones a Supabase en orden. */
export async function processQueue(): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  const failed: QueuedOp[] = [];
  let processed = 0;

  for (const op of queue) {
    try {
      if (op.type === "CREATE_SESSION") {
        const { error: sErr } = await supabase.from("sessions").upsert(op.session);
        if (sErr) throw sErr;
        const { error: spErr } = await supabase
          .from("session_spots")
          .upsert(op.spots);
        if (spErr) throw spErr;
        // Limpiar almacenamiento local al sincronizar
        await deleteLocalSession(op.session.id).catch(() => {});
      } else if (op.type === "UPDATE_SPOT") {
        await supabase
          .from("session_spots")
          .update({ makes: op.makes })
          .eq("id", op.spotId);
      } else if (op.type === "FINISH_SESSION") {
        await supabase
          .from("sessions")
          .update({ status: "DONE", finished_at: op.finishedAt })
          .eq("id", op.sessionId);
      } else if (op.type === "FINISH_WORKOUT") {
        await supabase
          .from("workouts")
          .update({ status: "DONE" })
          .eq("id", op.workoutId);
      }
      processed++;
    } catch {
      failed.push(op);
    }
  }

  await writeQueue(failed);
  return processed;
}
