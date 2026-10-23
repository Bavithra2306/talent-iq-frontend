import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "talentiq.theme";

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storedTheme(): Theme {
  return read(THEME_KEY) === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
}

/** Applies the saved theme as soon as the app loads (index.html also does it earlier, to avoid a flash). */
export function initTheme() {
  applyTheme(storedTheme());
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
