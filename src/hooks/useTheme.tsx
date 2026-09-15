import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";
export type ThemeMode = "dark" | "light" | "system";

interface ThemeContextType {
  /** Tema efetivamente aplicado */
  theme: Theme;
  /** Preferência escolhida (pode ser "system") */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "theme";

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "dark";
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  mode: "dark",
  setMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemPref, setSystemPref] = useState<Theme>(systemTheme);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemPref(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const theme: Theme = mode === "system" ? systemPref : mode;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(theme === "dark" ? "light" : "dark");
  }, [theme, setMode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
