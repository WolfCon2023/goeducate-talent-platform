"use client";

import * as React from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem("goeducate:theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  // Default dark to match app styling
  return "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider(props: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => (typeof window === "undefined" ? "dark" : getInitialTheme()));

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      applyTheme(t);
      try {
        window.localStorage.setItem("goeducate:theme", t);
      } catch {}
    }
  }, []);

  const toggle = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{props.children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}


