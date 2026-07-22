(function exposePhotoDayTheme(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  root.PhotoDayTheme = api;
  api.applyInitialTheme(root);
  root.document.addEventListener('DOMContentLoaded', () => api.bindThemeControls(root));
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const STORAGE_KEY = 'photo-day:color-theme';
  const DARK_THEME_COLOR = '#0e1512';
  const LIGHT_THEME_COLOR = '#f3efe5';

  function normalizeTheme(value) {
    return value === 'dark' || value === 'light' ? value : null;
  }

  function resolveTheme(storedTheme, prefersDark = false) {
    return normalizeTheme(storedTheme) || (prefersDark ? 'dark' : 'light');
  }

  function readStoredTheme(storage) {
    try {
      return normalizeTheme(storage?.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function storeTheme(storage, theme) {
    try {
      storage?.setItem(STORAGE_KEY, theme);
    } catch {
      // Тема всё равно применяется для текущего окна.
    }
  }

  function applyTheme(document, theme) {
    const nextTheme = normalizeTheme(theme) || 'light';
    document.documentElement.dataset.theme = nextTheme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute(
        'content',
        nextTheme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR
      );
    }
    return nextTheme;
  }

  function preferredTheme(root) {
    const prefersDark = Boolean(root.matchMedia?.('(prefers-color-scheme: dark)').matches);
    return resolveTheme(readStoredTheme(root.localStorage), prefersDark);
  }

  function applyInitialTheme(root) {
    return applyTheme(root.document, preferredTheme(root));
  }

  function bindThemeControls(root) {
    const button = root.document.querySelector('#themeButton');
    if (!button) return;
    const colorScheme = root.matchMedia?.('(prefers-color-scheme: dark)');

    function syncButton(theme = root.document.documentElement.dataset.theme) {
      const isDark = theme === 'dark';
      const action = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';
      button.setAttribute('aria-pressed', String(isDark));
      button.setAttribute('aria-label', action);
      button.title = action;
    }

    function setTheme(theme, { persist = true } = {}) {
      const nextTheme = applyTheme(root.document, theme);
      if (persist) storeTheme(root.localStorage, nextTheme);
      syncButton(nextTheme);
      root.dispatchEvent(new root.CustomEvent('photo-day-theme-change', {
        detail: { theme: nextTheme }
      }));
    }

    syncButton();
    button.addEventListener('click', () => {
      const currentTheme = root.document.documentElement.dataset.theme;
      setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    root.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      const nextTheme = resolveTheme(event.newValue, Boolean(colorScheme?.matches));
      setTheme(nextTheme, { persist: false });
    });

    colorScheme?.addEventListener('change', (event) => {
      if (readStoredTheme(root.localStorage)) return;
      setTheme(event.matches ? 'dark' : 'light', { persist: false });
    });
  }

  return {
    DARK_THEME_COLOR,
    LIGHT_THEME_COLOR,
    STORAGE_KEY,
    applyInitialTheme,
    applyTheme,
    bindThemeControls,
    normalizeTheme,
    readStoredTheme,
    resolveTheme,
    storeTheme
  };
}));
