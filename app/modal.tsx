// This route exists for Expo Router but is never navigated to.
// Redirect immediately to the root to avoid any accidental dead-end.
import { Redirect } from "expo-router";
export default function Modal() {
  return <Redirect href="/" />;
}

