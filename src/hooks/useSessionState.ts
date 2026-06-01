import { useEffect, useRef, useState } from "react";

/**
 * useSessionState — drop-in replacement for useState that persists the value in
 * sessionStorage for the current browser session. Cleared on browser close or
 * explicit clearSessionNamespace() (called on logout).
 */
export function useSessionState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
      if (raw != null) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [value]);

  return [value, setValue] as const;
}

/** Remove all sessionStorage keys that start with `${namespace}:`. */
export function clearSessionNamespace(namespace: string) {
  try {
    const prefix = `${namespace}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
