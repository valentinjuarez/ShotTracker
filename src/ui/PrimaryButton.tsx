import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Pressable, Text, useWindowDimensions } from "react-native";

export function PrimaryButton({
  title,
  loading,
  onPress,
  disabled,
}: {
  title: string;
  loading?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const isDisabled = !!disabled || !!loading;

  return (
    <Pressable
      onPress={async () => {
        if (isDisabled) return;
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={{
        height: isSmall ? 46 : 50,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDisabled ? "rgba(245,158,11,0.35)" : "#F59E0B",
      }}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text style={{ fontWeight: "800", color: "#0B1220", fontSize: 15 }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
