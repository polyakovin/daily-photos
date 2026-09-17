export const PRESENTATION_MODE_STORAGE_KEY = 'photo-day:presentation-mode';

export function normalizeStoredPresentationMode(value: string | null): boolean {
  return value === 'true';
}

export function isPresentationPhotoBlurred(
  active: boolean,
  blurDates: ReadonlySet<string>,
  date: string
): boolean {
  return active && blurDates.has(date);
}
