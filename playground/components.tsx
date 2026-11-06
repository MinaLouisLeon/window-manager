import '@integr8-media/ui/fonts.css';
import './playground.css';
import { ThemeProvider, type ThemeStorage, useTheme } from '@integr8-media/ui';
import type { GlobalProvider } from '@ladle/react';
import { type JSX, useLayoutEffect } from 'react';

/**
 * Ladle writes its own `data-theme` ("light" or "dark") on <html> at startup, even with its
 * theme addon off, and its effect runs after ThemeProvider's. That replaced "integr8" with
 * "light". This puts our resolved theme back whenever anything else changes the attribute.
 * Layout effect, so the old observer is gone before ThemeProvider applies a new theme.
 */
function LadleThemeGuard(): null {
  const { resolvedTheme } = useTheme();
  useLayoutEffect(() => {
    const html = document.documentElement;
    const restore = (): void => {
      if (html.getAttribute('data-theme') !== resolvedTheme) {
        html.setAttribute('data-theme', resolvedTheme);
      }
    };
    restore();
    const observer = new MutationObserver(restore);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [resolvedTheme]);
  return null;
}

/** Query parameter that picks the theme, used by the smoke test: `?integr8Theme=dark`. */
const THEME_PARAM = 'integr8Theme';
/**
 * Query parameter set by the registry site's live preview (`?integr8Embed=1`): the site has its
 * own theme buttons, so the story renders without the toolbar.
 */
const EMBED_PARAM = 'integr8Embed';
const isEmbedded = new URLSearchParams(window.location.search).get(EMBED_PARAM) === '1';
const STORAGE_KEY = 'integr8-wm-playground-theme';

// The URL wins over the saved choice, so every story can be opened in a given theme.
const playgroundStorage: ThemeStorage = {
  get() {
    const fromUrl = new URLSearchParams(window.location.search).get(THEME_PARAM);
    return fromUrl ?? window.localStorage.getItem(STORAGE_KEY);
  },
  set(theme) {
    window.localStorage.setItem(STORAGE_KEY, theme);
  },
};

function ThemeToolbar(): JSX.Element {
  const { theme, resolvedTheme, themes, setTheme } = useTheme();
  const options = [
    { name: 'system', label: 'System' },
    ...themes.map(({ name, label }) => ({ name, label })),
  ];

  return (
    <div
      role="toolbar"
      aria-label="Theme"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)',
        color: 'var(--card-foreground)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
      }}
    >
      <strong style={{ marginRight: 8 }}>Theme</strong>
      {options.map((option) => (
        <button
          key={option.name}
          type="button"
          aria-pressed={theme === option.name}
          onClick={() => setTheme(option.name)}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            font: 'inherit',
            background: theme === option.name ? 'var(--primary)' : 'transparent',
            color: theme === option.name ? 'var(--primary-foreground)' : 'inherit',
          }}
        >
          {option.label}
        </button>
      ))}
      <span style={{ marginLeft: 'auto', color: 'var(--muted-foreground)' }}>
        resolved: {resolvedTheme}
      </span>
    </div>
  );
}

export const Provider: GlobalProvider = ({ children }) => (
  <ThemeProvider defaultTheme="system" storage={playgroundStorage}>
    <LadleThemeGuard />
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {isEmbedded ? null : <ThemeToolbar />}
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </ThemeProvider>
);
