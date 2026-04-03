import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;

type ChunkMeta = {
  chunks: number;
};

function metaKey(key: string) {
  return `${key}::__meta`;
}

function chunkKey(key: string, index: number) {
  return `${key}::__${index}`;
}

async function getMeta(key: string): Promise<ChunkMeta | null> {
  const raw = await SecureStore.getItemAsync(metaKey(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChunkMeta;
  } catch {
    return null;
  }
}

async function clearKey(key: string) {
  const meta = await getMeta(key);

  if (meta?.chunks && meta.chunks > 0) {
    for (let i = 0; i < meta.chunks; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
  }

  await SecureStore.deleteItemAsync(metaKey(key));
  await SecureStore.deleteItemAsync(key);
}

async function setSecureString(key: string, value: string) {
  await clearKey(key);

  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const parts = Math.ceil(value.length / CHUNK_SIZE);
  for (let i = 0; i < parts; i++) {
    const start = i * CHUNK_SIZE;
    const end = start + CHUNK_SIZE;
    await SecureStore.setItemAsync(chunkKey(key, i), value.slice(start, end));
  }

  await SecureStore.setItemAsync(metaKey(key), JSON.stringify({ chunks: parts } satisfies ChunkMeta));
}

async function getSecureString(key: string): Promise<string | null> {
  const single = await SecureStore.getItemAsync(key);
  if (single != null) return single;

  const meta = await getMeta(key);
  if (!meta?.chunks || meta.chunks <= 0) return null;

  const chunks: string[] = [];
  for (let i = 0; i < meta.chunks; i++) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part == null) return null;
    chunks.push(part);
  }

  return chunks.join("");
}

export async function setSecureJson<T>(key: string, value: T): Promise<void> {
  await setSecureString(key, JSON.stringify(value));
}

export async function getSecureJson<T>(key: string): Promise<T | null> {
  const raw = await getSecureString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function removeSecureJson(key: string): Promise<void> {
  await clearKey(key);
}