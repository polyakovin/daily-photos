import type { ArchivePhoto } from '../modules/photo-archive';

export type IndexedPhoto = ArchivePhoto & {
  date: string;
};

export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
};

export type PhotoIndex = {
  byDate: Map<string, IndexedPhoto[]>;
  dates: string[];
  photoCount: number;
};

export type ArchiveMonthSummary = {
  month: number;
  photo?: IndexedPhoto;
  photoCount: number;
};

export type ArchiveYearSummary = {
  months: ArchiveMonthSummary[];
  photo?: IndexedPhoto;
  photoCount: number;
  year: number;
};

const DATE_KEY_PATTERN = /(?:^|\/)((?:19|20)\d{2})[._-](1[0-2]|0?[1-9])[._-](3[01]|[12]\d|0?[1-9])(?:\D|$)/;
const NESTED_DATE_PATTERN = /(?:^|\/)((?:19|20)\d{2})\/(1[0-2]|0?[1-9])\/([^/]+)$/;

export function dateKey(year: number, month: number, day: number): string {
  return [String(year).padStart(4, '0'), String(month).padStart(2, '0'), String(day).padStart(2, '0')]
    .join('-');
}

export function validDateKey(value: string): string | null {
  const match = value.match(/^((?:19|20)\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) return null;
  return value;
}

export function dateFromPath(filePath: string): string | null {
  const value = filePath.replace(/\\/g, '/');
  let match = value.match(DATE_KEY_PATTERN);
  if (!match) {
    const nested = value.match(NESTED_DATE_PATTERN);
    if (!nested) return null;
    const day = nested[3].match(/^(?:.*?[._-])?(3[01]|[12]\d|0?[1-9])(?:\D|$)/);
    if (!day) return null;
    match = [nested[0], nested[1], nested[2], day[1]];
  }
  return validDateKey(dateKey(Number(match[1]), Number(match[2]), Number(match[3])));
}

export function dateFromTimestamp(value?: number): string | null {
  if (!Number.isFinite(value) || !value || value < 0) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateKey(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

export function photoDate(photo: ArchivePhoto): string | null {
  return dateFromPath(photo.relativePath) || dateFromTimestamp(photo.modifiedAt);
}

export function buildPhotoIndex(
  photos: ArchivePhoto[],
  preferredPaths: Record<string, string> = {}
): PhotoIndex {
  const byDate = new Map<string, IndexedPhoto[]>();
  for (const photo of photos) {
    const date = photoDate(photo);
    if (!date) continue;
    const indexed = { ...photo, date };
    const variants = byDate.get(date) || [];
    variants.push(indexed);
    byDate.set(date, variants);
  }
  for (const variants of byDate.values()) {
    variants.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'ru'));
    const preferredPath = preferredPaths[variants[0]?.date];
    const preferredIndex = variants.findIndex((photo) => photo.relativePath === preferredPath);
    if (preferredIndex > 0) variants.unshift(...variants.splice(preferredIndex, 1));
  }
  return {
    byDate,
    dates: [...byDate.keys()].sort(),
    photoCount: photos.length
  };
}

export function photosInChronologicalOrder(index: PhotoIndex): IndexedPhoto[] {
  return index.dates.flatMap((date) => index.byDate.get(date) || []);
}

export function buildCalendarMonth(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(first);
    current.setDate(first.getDate() + index);
    return {
      date: dateKey(current.getFullYear(), current.getMonth() + 1, current.getDate()),
      day: current.getDate(),
      inMonth: current.getMonth() === month
    };
  });
}

export function buildCalendarWeeks(cells: CalendarCell[]): CalendarCell[][] {
  if (cells.length % 7 !== 0) {
    throw new RangeError('calendar cells must contain complete weeks');
  }
  return Array.from({ length: cells.length / 7 }, (_, index) => (
    cells.slice(index * 7, index * 7 + 7)
  ));
}

export function buildCalendarWeek(value: Date): CalendarCell[] {
  const first = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(first);
    current.setDate(first.getDate() + index);
    return {
      date: dateKey(current.getFullYear(), current.getMonth() + 1, current.getDate()),
      day: current.getDate(),
      inMonth: current.getMonth() === value.getMonth()
    };
  });
}

export function buildArchiveYears(
  index: PhotoIndex,
  highlights: { months?: Record<string, string>; years?: Record<string, string> } = {}
): ArchiveYearSummary[] {
  const years = new Map<number, ArchiveYearSummary>();
  for (const date of index.dates) {
    const variants = index.byDate.get(date) || [];
    if (variants.length === 0) continue;
    const parsed = dateFromKey(date);
    if (!parsed) continue;
    const year = parsed.getFullYear();
    let summary = years.get(year);
    if (!summary) {
      summary = {
        months: Array.from({ length: 12 }, (_, month) => ({ month, photoCount: 0 })),
        photoCount: 0,
        year
      };
      years.set(year, summary);
    }
    const month = summary.months[parsed.getMonth()];
    month.photoCount += variants.length;
    month.photo = variants[0];
    summary.photoCount += variants.length;
    summary.photo = variants[0];
  }
  for (const summary of years.values()) {
    const yearDate = highlights.years?.[String(summary.year)];
    summary.photo = (yearDate && index.byDate.get(yearDate)?.[0]) || summary.photo;
    for (const month of summary.months) {
      const period = `${summary.year}-${String(month.month + 1).padStart(2, '0')}`;
      const monthDate = highlights.months?.[period];
      month.photo = (monthDate && index.byDate.get(monthDate)?.[0]) || month.photo;
    }
  }
  return [...years.values()].sort((left, right) => right.year - left.year);
}

export function addMonths(value: Date, amount: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

export function dateFromKey(value: string): Date | null {
  const normalized = validDateKey(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
}
