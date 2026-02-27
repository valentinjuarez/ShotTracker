// app/(trainer)/_layout.tsx
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Tabs } from "expo-router";
import React from "react";

const AMBER = "#F59E0B";
const INACTIVE = "rgba(255,255,255,0.35)";
const BG = "#0F1A2E";

export default function TrainerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: AMBER,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: "rgba(255,255,255,0.07)",
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Equipo",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: "Jugadores",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Planillas",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="clipboard.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          title: "Comparar",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="create-team" options={{ href: null }} />
    </Tabs>
  );
}
