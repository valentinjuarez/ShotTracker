import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { Animated, Modal, Pressable, Text } from "react-native";

type HelpHintProps = {
  title?: string;
  message: string;
  storageKey?: string;
  align?: "left" | "right";
};

export function HelpHint({
  title = "Ayuda rápida",
  message,
  storageKey,
  align = "right",
}: HelpHintProps) {
  const [open, setOpen] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(0.96)).current;

  function press(v: number) {
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 170, useNativeDriver: true }),
        Animated.spring(popScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 5 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 130, useNativeDriver: true }),
        Animated.timing(popScale, { toValue: 0.96, duration: 130, useNativeDriver: true }),
      ]).start();
    }
  }

  return (
    <>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={toggle}
          onPressIn={() => press(0.92)}
          onPressOut={() => press(1)}
          testID={storageKey}
          accessibilityLabel={storageKey ? `help-${storageKey}` : "help-hint"}
          hitSlop={8}
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "rgba(99,179,237,0.18)",
            borderWidth: 1,
            borderColor: "rgba(99,179,237,0.40)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="help" size={13} color="rgba(99,179,237,0.95)" />
        </Pressable>
      </Animated.View>

      <Modal
        transparent
        visible={open}
        animationType="none"
        onRequestClose={toggle}
      >
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.30)",
            alignItems: "center",
            justifyContent: "center",
            opacity: fade,
          }}
        >
          <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={toggle} />
          <Animated.View
            style={{
              width: "86%",
              maxWidth: 340,
              alignSelf: align === "left" ? "flex-start" : "flex-end",
              padding: 14,
              borderRadius: 14,
              backgroundColor: "rgba(11,18,32,0.98)",
              borderWidth: 1,
              borderColor: "rgba(99,179,237,0.35)",
              shadowColor: "#63B3ED",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 10,
              transform: [{ scale: popScale }],
            }}
          >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 13, marginBottom: 6 }}>
              {title}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 19 }}>
              {message}
            </Text>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}
