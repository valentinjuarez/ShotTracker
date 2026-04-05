import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

type AutoRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

export function useAutoRefreshOnFocus(
  onRefresh: () => void | Promise<void>,
  { enabled = true, intervalMs = 30000 }: AutoRefreshOptions = {}
) {
  const refresh = useCallback(() => {
    if (!enabled) return;
    void onRefresh();
  }, [enabled, onRefresh]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      void onRefresh();
      const intervalId = setInterval(() => {
        void onRefresh();
      }, intervalMs);

      return () => clearInterval(intervalId);
    }, [enabled, intervalMs, onRefresh])
  );

  return refresh;
}