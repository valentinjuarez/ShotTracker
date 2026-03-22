import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en el .env"
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: {
      getItem: async (key: string) => {
        return await SecureStore.getItemAsync(key);
      },
      setItem: async (key: string, value: string) => {
        await SecureStore.setItemAsync(key, value);
      },
      removeItem: async (key: string) => {
        await SecureStore.deleteItemAsync(key);
      },
    },
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // importante en RN
    flowType: "pkce",          // código llega como ?code= en vez de #fragment
  },
});
