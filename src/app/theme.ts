import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "talentiq.theme";

function stored(): Theme {
  try { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; } catch { return "light"; }
}

function apply(theme: Theme) {
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
}

/** Applies the saved theme as soon as the app loads (index.html also does it earlier, to avoid a flash). */
export function initTheme() {
  apply(stored());
}

/** Light or dark appearance, remembered in this browser. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(stored);
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    apply(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
  }, []);
  return [theme, setTheme];
}
