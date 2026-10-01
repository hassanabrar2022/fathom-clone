import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import './theme.css';

type Theme = 'light' | 'dark';
const key = 'fathom-clone-theme';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function storedTheme(): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#f6f4ef');
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  useEffect(() => {
    const update = () => setTheme(currentTheme());
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const onPreference = () => {
      if (!storedTheme()) {
        applyTheme(preference.matches ? 'dark' : 'light');
        update();
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      const selected = storedTheme();
      applyTheme(
        selected === 'dark' || (!selected && preference.matches)
          ? 'dark'
          : 'light',
      );
      update();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('fathom-clone-theme-change', update);
    preference.addEventListener('change', onPreference);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fathom-clone-theme-change', update);
      preference.removeEventListener('change', onPreference);
    };
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(key, next);
    } catch {
      // The toggle still works for this visit if storage is unavailable.
    }
    applyTheme(next);
    setTheme(next);
    window.dispatchEvent(new Event('fathom-clone-theme-change'));
  };
  return (
    <button
      className={`theme-toggle ${className}`.trim()}
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
