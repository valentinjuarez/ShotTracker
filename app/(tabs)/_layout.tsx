import { Tabs } from 'expo-router';
import React from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/src/shared/components/ui/icon-symbol';
import { createTabOptions } from '@/src/shared/navigation/createTabOptions';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tabOptions = createTabOptions({
    isDark: colorScheme === 'dark',
  });

  return (
    <Tabs
      screenOptions={{
        ...tabOptions,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="clock.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Mi equipo',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
      {/* Hide session sub-screens from tab bar */}
      <Tabs.Screen name="session/create"  options={{ href: null }} />
      <Tabs.Screen name="session/run"     options={{ href: null }} />
      <Tabs.Screen name="session/summary" options={{ href: null }} />
      <Tabs.Screen name="workout/create"  options={{ href: null }} />
      <Tabs.Screen name="workout/index"   options={{ href: null }} />
    </Tabs>
  );
}
