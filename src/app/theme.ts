import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "talentiq.theme";
const ACCENT_KEY = "talentiq.accent";

/** Colours a person can choose for buttons, links and highlights. "blue" is the default. */
export const ACCENTS = [
  { id: "blue", name: "Trust Blue", color: "#1D4ED8" },
  { id: "teal", name: "Teal", color: "#0F766E" },
  { id: "indigo", name: "Indigo", color: "#4338CA" },
  { id: "emerald", name: "Emerald", color: "#047857" },
  { id: "violet", name: "Violet", color: "#6D28D9" },
  { id: "sky", name: "Sky", color: "#0369A1" },
  { id: "orange", name: "Orange", color: "#EA580C" },
  { id: "rose", name: "Rose", color: "#BE123C" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storedTheme(): Theme {
  return read(THEME_KEY) === "dark" ? "dark" : "light";
}

function storedAccent(): AccentId {
  const value = read(ACCENT_KEY);
  return ACCENTS.some((a) => a.id === value) ? (value as AccentId) : "blue";
}

function applyTheme(theme: Theme) {
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
}

function applyAccent(accent: AccentId) {
  if (accent === "blue") delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
}

/** Applies the saved choices as soon as the app loads (index.html also does it earlier, to avoid a flash). */
export function initTheme() {
  applyTheme(storedTheme());
  applyAccent(storedAccent());
}

/** Light or dark appearance, remembered in this browser. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(storedTheme);
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
  }, []);
  return [theme, setTheme];
}

/** The chosen accent colour, remembered in this browser. */
export function useAccent(): [AccentId, (accent: AccentId) => void] {
  const [accent, setAccentState] = useState<AccentId>(storedAccent);
  const setAccent = useCallback((next: AccentId) => {
    setAccentState(next);
    applyAccent(next);
    try { localStorage.setItem(ACCENT_KEY, next); } catch { /* storage unavailable */ }
  }, []);
  return [accent, setAccent];
}
