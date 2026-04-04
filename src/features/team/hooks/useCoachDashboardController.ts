import { useCallback, useEffect, useMemo, useState } from "react";

import * as Haptics from "expo-haptics";

import { getCurrentUserId, signOut } from "@/src/features/auth/services/auth.service";
import { getCoachDashboard, type PlayerStat, type Team } from "@/src/features/team/services/team.service";
import { useProfile } from "@/src/hooks/useProfile";

export function useCoachDashboardController() {
  const { profile, loading: profileLoading } = useProfile();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;

      const dashboard = await getCoachDashboard(userId);
      if (!dashboard) {
        setTeam(null);
        setPlayers([]);
        return;
      }

      setTeam(dashboard.team);
      setPlayers(dashboard.players);
    } catch {
      // keep screen stable on transient network errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const onLogout = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
  }, []);

  const totalAttempts = useMemo(
    () => players.reduce((acc, player) => acc + player.attempts, 0),
    [players]
  );
  const totalMakes = useMemo(
    () => players.reduce((acc, player) => acc + player.makes, 0),
    [players]
  );
  const totalSessions = useMemo(
    () => players.reduce((acc, player) => acc + player.sessions, 0),
    [players]
  );
  const teamPct = totalAttempts > 0 ? totalMakes / totalAttempts : null;

  const displayName = profile?.display_name ?? null;
  const isNameLoading = profileLoading && !displayName;
  const initials = displayName
    ? displayName
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("")
    : "";
  const avatarUrl = profile?.avatar_url ?? null;

  return {
    avatarUrl,
    displayName,
    initials,
    isNameLoading,
    loading,
    onLogout,
    onRefresh,
    players,
    refreshing,
    team,
    teamPct,
    totalAttempts,
    totalSessions,
  };
}
