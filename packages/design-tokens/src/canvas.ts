export type ResolvedTheme = "light" | "dark";
export type ThemePreference = ResolvedTheme | "system";

export const canvasThemeTokens = {
  radius: { control: 2, container: 4, media: 4 },
  light: {
    editorSurface: "#eaeae8",
    nodeSurface: "#e8e8e5",
    placeholderSurface: "#e7e3ff",
    artboardSurface: "#ffffff",
    structural: "#cfcfcb",
    selection: "#6456e8",
    editorText: "#26272d",
    mutedText: "#8a8a90",
  },
  dark: {
    editorSurface: "#1d1d20",
    nodeSurface: "#303034",
    placeholderSurface: "#302d48",
    artboardSurface: "#ffffff",
    structural: "#46464c",
    selection: "#6456e8",
    editorText: "#f4f4f2",
    mutedText: "#aaaab0",
  },
} as const;

export type CanvasTheme = (typeof canvasThemeTokens)[ResolvedTheme] & {
  radius: typeof canvasThemeTokens.radius;
};

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return preference === "system"
    ? systemPrefersDark ? "dark" : "light"
    : preference;
}

export function canvasThemeFor(theme: ResolvedTheme): CanvasTheme {
  return { ...canvasThemeTokens[theme], radius: canvasThemeTokens.radius };
}
