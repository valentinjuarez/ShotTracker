// app/(trainer)/_layout.tsx
import { IconSymbol } from "@/src/shared/components/ui/icon-symbol";
import { createTabOptions } from "@/src/shared/navigation/createTabOptions";
import { Tabs } from "expo-router";
import React from "react";

const tabOptions = createTabOptions();

export default function TrainerLayout() {
  return (
    <Tabs
      screenOptions={{
        ...tabOptions,
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
