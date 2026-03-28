'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';
type ThemeMode = Theme | 'system';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'punchlist:theme-mode';
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {}
    return 'system';
  });
  const [theme, setTheme] = useState<Theme>(() => getSystemTheme());

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme() {
      setTheme(themeMode === 'system' ? (media.matches ? 'dark' : 'light') : themeMode);
    }

    applyTheme();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', applyTheme);
    } else {
      media.addListener(applyTheme);
    }

    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', applyTheme);
      } else {
        media.removeListener(applyTheme);
      }
    };
  }, [themeMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, themeMode);
    } catch {}
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.themeMode = themeMode;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, themeMode]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      themeMode,
      setThemeMode,
      toggleTheme: () => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme, themeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
