import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";

import { HapticTab } from "@/src/shared/components/navigation/haptic-tab";

const ACTIVE_COLOR = "#F59E0B";
const INACTIVE_DARK = "rgba(255,255,255,0.35)";
const INACTIVE_LIGHT = "rgba(0,0,0,0.30)";
const TAB_BAR_BG = "#0F1A2E";
const TAB_BAR_BORDER = "rgba(255,255,255,0.07)";

export function createTabOptions(params?: {
  isDark?: boolean;
  inactiveColor?: string;
}): BottomTabNavigationOptions {
  const isDark = params?.isDark ?? true;
  const inactiveColor =
    params?.inactiveColor ?? (isDark ? INACTIVE_DARK : INACTIVE_LIGHT);

  return {
    headerShown: false,
    tabBarButton: HapticTab,
    tabBarActiveTintColor: ACTIVE_COLOR,
    tabBarInactiveTintColor: inactiveColor,
    tabBarStyle: {
      backgroundColor: TAB_BAR_BG,
      borderTopColor: TAB_BAR_BORDER,
      borderTopWidth: 1,
    },
    tabBarLabelStyle: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
  };
}
