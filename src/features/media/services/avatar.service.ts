import { supabase } from "@/src/lib/supabase";
import { decode as decodeBase64 } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";

const AVATAR_BUCKET = "avatars";

function inferMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

export async function uploadAvatarAtPath(path: string, fileUri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error("La imagen seleccionada no existe.");
  }
  if ((info.size ?? 0) <= 0) {
    throw new Error("La imagen seleccionada está vacía.");
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: "base64",
  });
  const fileData = decodeBase64(base64);

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, fileData, {
      upsert: true,
      contentType: inferMimeType(fileUri),
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const version = Date.now();
  return `${data.publicUrl}?v=${version}`;
}

export async function deleteAvatarAtPath(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .remove([path]);

  if (error) throw error;
}
