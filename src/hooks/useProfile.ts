// src/hooks/useProfile.ts
import { getCurrentUserProfile, type Profile } from "@/src/features/profile/services/profile.service";
import { useCallback, useEffect, useState } from "react";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await getCurrentUserProfile();
      setProfile(profile);
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
