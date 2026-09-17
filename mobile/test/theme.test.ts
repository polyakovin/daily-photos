import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  darkPalette,
  lightPalette,
  normalizeTheme,
  resolveTheme,
  THEME_STORAGE_KEY
} from '../src/theme.ts';

test('mobile palettes use the desktop Photo Day theme tokens', async () => {
  const desktopStyles = await readFile(
    new URL('../../src/renderer/styles.css', import.meta.url),
    'utf8'
  );
  for (const token of [
    '--forest: #163a30',
    '--cream: #f3efe5',
    '--paper: #fffdf7',
    '--ink: #17332b',
    '--muted: #6d776f',
    '--photo-green: #73967b',
    '--today: #d6423a',
    '--paper: #18211d',
    '--ink: #edf3ef',
    '--photo-green: #78b38e',
    '--today: #df5d54'
  ]) assert.ok(desktopStyles.includes(token), `desktop token not found: ${token}`);

  assert.deepEqual({
    accent: lightPalette.accent,
    background: lightPalette.background,
    card: lightPalette.card,
    muted: lightPalette.muted,
    photoGreen: lightPalette.photoGreen,
    text: lightPalette.text,
    today: lightPalette.today
  }, {
    accent: '#163a30',
    background: '#f3efe5',
    card: '#fffdf7',
    muted: '#6d776f',
    photoGreen: '#73967b',
    text: '#17332b',
    today: '#d6423a'
  });
  assert.deepEqual({
    accent: darkPalette.accent,
    background: darkPalette.background,
    card: darkPalette.card,
    muted: darkPalette.muted,
    photoGreen: darkPalette.photoGreen,
    text: darkPalette.text,
    today: darkPalette.today
  }, {
    accent: '#356e58',
    background: '#0e1512',
    card: '#18211d',
    muted: '#9daaa2',
    photoGreen: '#78b38e',
    text: '#edf3ef',
    today: '#df5d54'
  });
});

test('theme selection matches desktop storage and system fallback behavior', () => {
  assert.equal(THEME_STORAGE_KEY, 'photo-day:color-theme');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('sepia'), null);
  assert.equal(resolveTheme(null, false), 'light');
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme('light', true), 'light');
});
