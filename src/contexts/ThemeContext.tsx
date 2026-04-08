'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  themeMode: 'system';
  setThemeMode: (_mode: 'system') => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'punchlist:theme-mode';
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = 'system';
  const [theme, setTheme] = useState<Theme>(() => getSystemTheme());

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme() {
      setTheme(media.matches ? 'dark' : 'light');
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
  }, []);

  useEffect(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

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
      setThemeMode: () => {},
      toggleTheme: () => {},
    }),
    [theme]
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
