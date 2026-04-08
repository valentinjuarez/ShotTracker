import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  const expoConfig = Constants.expoConfig;
  const release = `${expoConfig?.slug ?? "shottracker"}@${expoConfig?.version ?? "dev"}`;

  Sentry.init({
    dsn,
    enabled: !__DEV__,
    release,
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    attachStacktrace: true,
  });
}

export { Sentry };

