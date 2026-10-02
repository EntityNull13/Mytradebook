import { useState, useEffect } from 'react';

export type AppTheme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'tradebook-theme';

export function getStoredTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore storage errors in private browsing/sandboxes
  }
  return 'dark'; // Default to sleek night mode
}

export function getEffectiveTheme(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }
  return theme;
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return;

  const effective = getEffectiveTheme(theme);
  const root = document.documentElement;
  const body = document.body;

  if (effective === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    if (body) {
      body.classList.add('dark');
      body.setAttribute('data-theme', 'dark');
    }
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    if (body) {
      body.classList.remove('dark');
      body.setAttribute('data-theme', 'light');
    }
  }

  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', effective === 'dark' ? '#09090b' : '#ffffff');
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore
  }

  window.dispatchEvent(new CustomEvent('tradebook-theme-changed', { detail: { theme, effective } }));
}

// Initial theme application before react mounts
export function initTheme() {
  const stored = getStoredTheme();
  applyTheme(stored);
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(getStoredTheme);
  const effectiveTheme = getEffectiveTheme(theme);
  const isDark = effectiveTheme === 'dark';

  useEffect(() => {
    // Apply current on mount
    applyTheme(theme);

    const handleThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme: AppTheme }>;
      if (custom.detail?.theme) {
        setThemeState(custom.detail.theme);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system')) {
        setThemeState(e.newValue);
        applyTheme(e.newValue);
      }
    };

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system');
        setThemeState('system');
      }
    };

    window.addEventListener('tradebook-theme-changed', handleThemeChange);
    window.addEventListener('storage', handleStorage);
    mediaQuery?.addEventListener?.('change', handleSystemChange);

    return () => {
      window.removeEventListener('tradebook-theme-changed', handleThemeChange);
      window.removeEventListener('storage', handleStorage);
      mediaQuery?.removeEventListener?.('change', handleSystemChange);
    };
  }, [theme]);

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    // Toggle between light and dark
    const next: AppTheme = isDark ? 'light' : 'dark';
    setTheme(next);
  };

  return {
    theme,
    isDark,
    effectiveTheme,
    setTheme,
    toggleTheme,
  };
}
