import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef, useState } from "react";

/**
 * Devuelve el estado de conexión a internet en tiempo real.
 * - `isOnline = true`  → con conexión
 * - `isOnline = false` → sin conexión
 * - `isOnline = null`  → aún verificando (estado inicial)
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Estado inmediato
    NetInfo.fetch().then((s) => {
      if (mounted.current) {
        setIsOnline((s.isConnected ?? false) && s.isInternetReachable !== false);
      }
    });

    // Escuchar cambios
    const unsub = NetInfo.addEventListener((s) => {
      if (mounted.current) {
        setIsOnline((s.isConnected ?? false) && s.isInternetReachable !== false);
      }
    });

    return () => {
      mounted.current = false;
      unsub();
    };
  }, []);

  return { isOnline };
}
