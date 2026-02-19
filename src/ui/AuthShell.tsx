import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: isSmall ? 16 : 20,
            paddingTop: isSmall ? 18 : 26,
            paddingBottom: 24,
            gap: 18,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: isSmall ? 44 : 52,
                  height: isSmall ? 44 : 52,
                  borderRadius: 999,
                  backgroundColor: "rgba(245,158,11,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(245,158,11,0.35)",
                }}
              >
                <Ionicons name="basketball" size={isSmall ? 22 : 26} color="#F59E0B" />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "white",
                    fontSize: isSmall ? 22 : 26,
                    fontWeight: "800",
                  }}
                >
                  {title}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    marginTop: 2,
                    fontSize: isSmall ? 13 : 14,
                  }}
                >
                  {subtitle}
                </Text>
              </View>
            </View>

            {/* “Court line” */}
            <View
              style={{
                height: 1,
                backgroundColor: "rgba(255,255,255,0.10)",
                marginTop: 8,
              }}
            />
          </View>

          {/* Card */}
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              borderRadius: 18,
              padding: isSmall ? 14 : 16,
              gap: 14,
            }}
          >
            {children}
          </View>

          {/* Footer */}
          <Text
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.45)",
              fontSize: 12,
            }}
          >
            ShotTracker • Train smart, shoot better
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
