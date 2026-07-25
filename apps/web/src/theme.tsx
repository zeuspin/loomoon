import {
  canvasThemeFor,
  resolveTheme,
  type CanvasTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@loomoon/design-tokens";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const storageKey = "loomoon.theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  canvasTheme: CanvasTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function normalizeThemePreference(
  value: string | null,
): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "light";
}

export function initialThemePreference(
  storedPreference: string | null,
  allowStoredPreference: boolean,
): ThemePreference {
  return allowStoredPreference
    ? normalizeThemePreference(storedPreference)
    : "light";
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return resolveTheme(preference, systemPrefersDark);
}

export function createCanvasTheme(theme: ResolvedTheme): CanvasTheme {
  return canvasThemeFor(theme);
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({
  children,
  allowStoredPreference = false,
}: {
  children: ReactNode;
  allowStoredPreference?: boolean;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window === "undefined"
      ? "light"
      : initialThemePreference(
          window.localStorage.getItem(storageKey),
          allowStoredPreference,
        ),
  );
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
  const resolvedTheme = resolveThemePreference(preference, prefersDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setPrefersDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = preference;
    window.localStorage.setItem(storageKey, preference);
  }, [preference, resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      canvasTheme: createCanvasTheme(resolvedTheme),
      setPreference: setPreferenceState,
    }),
    [preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
