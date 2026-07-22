const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DARK_THEME_COLOR,
  LIGHT_THEME_COLOR,
  STORAGE_KEY,
  applyTheme,
  normalizeTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme
} = require('../src/renderer/theme');

test('theme normalization accepts only supported values', () => {
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('auto'), null);
  assert.equal(normalizeTheme(null), null);
});

test('stored theme wins over the system preference', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(null, false), 'light');
});

test('theme storage gracefully handles unavailable storage', () => {
  const unavailableStorage = {
    getItem() { throw new Error('unavailable'); },
    setItem() { throw new Error('unavailable'); }
  };
  assert.equal(readStoredTheme(unavailableStorage), null);
  assert.doesNotThrow(() => storeTheme(unavailableStorage, 'dark'));
});

test('theme storage uses a stable key', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); }
  };
  storeTheme(storage, 'dark');
  assert.equal(values.get(STORAGE_KEY), 'dark');
  assert.equal(readStoredTheme(storage), 'dark');
});

test('applying a theme updates the root and browser chrome color', () => {
  const attributes = new Map();
  const themeColor = {
    setAttribute(name, value) { attributes.set(name, value); }
  };
  const document = {
    documentElement: { dataset: {} },
    querySelector(selector) {
      return selector === 'meta[name="theme-color"]' ? themeColor : null;
    }
  };

  assert.equal(applyTheme(document, 'dark'), 'dark');
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(attributes.get('content'), DARK_THEME_COLOR);

  assert.equal(applyTheme(document, 'light'), 'light');
  assert.equal(attributes.get('content'), LIGHT_THEME_COLOR);
});
