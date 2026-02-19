import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    Platform,
    Pressable,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";

export function AuthInput({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  error,
  textContentType,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: string | null;
  textContentType?: any;
}) {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);

  const isPassword = !!secureTextEntry;
  const actualSecure = isPassword ? !show : false;

  const borderColor = useMemo(() => {
    if (error) return "rgba(239,68,68,0.65)";
    if (focused) return "rgba(245,158,11,0.65)";
    return "rgba(255,255,255,0.14)";
  }, [error, focused]);

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12 }}>
        {label}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor,
          backgroundColor: "rgba(0,0,0,0.25)",
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: Platform.OS === "ios" ? 12 : 10,
        }}
      >
        <Ionicons name={icon} size={isSmall ? 18 : 20} color="rgba(255,255,255,0.75)" />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={{
            flex: 1,
            color: "white",
            fontSize: isSmall ? 14 : 15,
            paddingVertical: 0,
          }}
          secureTextEntry={actualSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "none"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textContentType={textContentType}
        />

        {isPassword && (
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
            <Ionicons
              name={show ? "eye-off" : "eye"}
              size={isSmall ? 18 : 20}
              color="rgba(255,255,255,0.70)"
            />
          </Pressable>
        )}
      </View>

      {!!error && (
        <Text style={{ color: "rgba(239,68,68,0.85)", fontSize: 12 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
