export type ColorTheme = 'dark' | 'light';

export type AppPalette = {
  accent: string;
  background: string;
  border: string;
  card: string;
  controlBackground: string;
  danger: string;
  dangerBackground: string;
  emptyCell: string;
  eyebrow: string;
  isDark: boolean;
  mapTileFilter: string;
  muted: string;
  onAccent: string;
  photoGreen: string;
  text: string;
  today: string;
};

export const THEME_STORAGE_KEY = 'photo-day:color-theme';

export const lightPalette: AppPalette = Object.freeze({
  accent: '#163a30',
  background: '#f3efe5',
  border: 'rgba(22, 58, 48, 0.14)',
  card: '#fffdf7',
  controlBackground: 'rgba(22, 58, 48, 0.08)',
  danger: '#a62f29',
  dangerBackground: 'rgba(181, 82, 75, 0.08)',
  emptyCell: 'rgba(169, 188, 158, 0.13)',
  eyebrow: '#688173',
  isDark: false,
  mapTileFilter: 'none',
  muted: '#6d776f',
  onAccent: '#f3efe5',
  photoGreen: '#73967b',
  text: '#17332b',
  today: '#d6423a'
});

export const darkPalette: AppPalette = Object.freeze({
  accent: '#356e58',
  background: '#0e1512',
  border: 'rgba(216, 232, 222, 0.14)',
  card: '#18211d',
  controlBackground: 'rgba(211, 231, 219, 0.08)',
  danger: '#ff9992',
  dangerBackground: 'rgba(181, 82, 75, 0.12)',
  emptyCell: '#141c18',
  eyebrow: '#92b49f',
  isDark: true,
  mapTileFilter: 'brightness(.72) saturate(.62) contrast(1.08)',
  muted: '#9daaa2',
  onAccent: '#f2efe6',
  photoGreen: '#78b38e',
  text: '#edf3ef',
  today: '#df5d54'
});

export function normalizeTheme(value: unknown): ColorTheme | null {
  return value === 'dark' || value === 'light' ? value : null;
}

export function resolveTheme(value: unknown, prefersDark = false): ColorTheme {
  return normalizeTheme(value) || (prefersDark ? 'dark' : 'light');
}
