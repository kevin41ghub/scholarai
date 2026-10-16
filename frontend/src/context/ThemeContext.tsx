"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "scholarai-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage and set up system theme listener
  useEffect(() => {
    let mql: MediaQueryList | null = null;
    let handler: ((e: MediaQueryListEvent) => void) | null = null;

    const timer = setTimeout(() => {
      setMounted(true);
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored && ["light", "dark", "system"].includes(stored)) {
        setThemeState(stored);
      }

      mql = window.matchMedia("(prefers-color-scheme: dark)");
      setSystemTheme(mql.matches ? "dark" : "light");

      handler = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? "dark" : "light");
      };

      mql.addEventListener("change", handler);
    }, 0);

    return () => {
      clearTimeout(timer);
      if (mql && handler) {
        mql.removeEventListener("change", handler);
      }
    };
  }, []);

  const resolvedTheme: "light" | "dark" = theme === "system" ? systemTheme : theme;

  // Apply .dark class to <html> element
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
  }, [resolvedTheme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Storage might be restricted
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
