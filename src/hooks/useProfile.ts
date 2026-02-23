// src/hooks/useProfile.ts
import { supabase } from "@/src/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type UserRole = "player" | "coach";

export type Profile = {
  id: string;
  display_name: string | null;
  role: UserRole;
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) { setProfile(null); return; }

      const { data, error: dbErr } = await supabase
        .from("profiles")
        .select("id, display_name, role")
        .eq("id", userId)
        .maybeSingle();

      if (dbErr) throw dbErr;

      // Resolve role: prefer DB value, fall back to auth metadata
      const meta: any = auth.user?.user_metadata ?? {};
      const metaRole: UserRole =
        meta.role === "coach" ? "coach" : "player";

      if (data) {
        setProfile({
          id:           data.id,
          display_name: data.display_name ?? null,
          // If role column is null/missing (col not added yet) fall back to metadata
          role:         (data.role as UserRole) ?? metaRole,
        });
      } else {
        // Profile row doesn't exist yet — create it using metadata role
        const { data: created, error: insertErr } = await supabase
          .from("profiles")
          .insert({
            id:           userId,
            display_name: meta.display_name ?? meta.full_name ?? null,
            role:         metaRole,
          })
          .select("id, display_name, role")
          .single();
        if (insertErr) {
          console.warn("[useProfile] insert failed:", insertErr.message);
          // Still set a local profile from metadata so routing works
          setProfile({
            id:           userId,
            display_name: meta.display_name ?? meta.full_name ?? null,
            role:         metaRole,
          });
        } else {
          setProfile(created ? { ...created, role: (created.role as UserRole) ?? metaRole } : null);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Error cargando perfil");
      // Fallback — treat as player so the app doesn't break
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { profile, loading, error, refetch: load };
}
