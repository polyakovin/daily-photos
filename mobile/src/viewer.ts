import type {
  ArchiveLocation,
  ArchiveViewerMetadata
} from '../modules/photo-archive';

export const EMPTY_VIEWER_METADATA: ArchiveViewerMetadata = {
  blurDates: [],
  diaries: {},
  highlights: { months: {}, years: {} },
  locations: {}
};

export type PlaceSearchResult = ArchiveLocation & {
  id: string;
  label: string;
};

const VIEWER_MONTH_NAMES = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря'
] as const;

export function formatViewerDate(value: string): string {
  const match = value.match(/^((?:19|20)\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const monthName = VIEWER_MONTH_NAMES[Number(match[2]) - 1];
  return monthName ? `${Number(match[3])} ${monthName} ${match[1]}г.` : value;
}

export function normalizeViewerMetadata(value: unknown): ArchiveViewerMetadata {
  const source = value && typeof value === 'object' ? value as Partial<ArchiveViewerMetadata> : {};
  const highlights = source.highlights && typeof source.highlights === 'object'
    ? source.highlights
    : EMPTY_VIEWER_METADATA.highlights;
  return {
    blurDates: Array.isArray(source.blurDates)
      ? source.blurDates.filter((date): date is string => validDate(date)).sort()
      : [],
    diaries: stringRecord(source.diaries, validDate),
    highlights: {
      months: stringRecord(highlights.months, (period) => /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/.test(period)),
      years: stringRecord(highlights.years, (period) => /^(?:19|20)\d{2}$/.test(period))
    },
    locations: locationRecord(source.locations)
  };
}

export function parseViewerDate(value: string): string | null {
  const match = value.trim().match(/^((?:19|20)\d{2})[-./](\d{1,2})[-./](\d{1,2})$/)
    || value.trim().match(/^(\d{1,2})[-./](\d{1,2})[-./]((?:19|20)\d{2})$/)?.map((part, index, all) => (
      index === 1 ? all[3] : index === 2 ? all[2] : index === 3 ? all[1] : part
    ));
  if (!match) return null;
  const date = `${match[1]}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`;
  if (!validDate(date)) return null;
  const parsed = new Date(`${date}T12:00:00`);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return parsed <= today ? date : null;
}

export function retargetPhotoPath(relativePath: string, date: string): string {
  if (!validDate(date)) throw new RangeError('Дата должна быть в формате ГГГГ-ММ-ДД');
  const normalized = safeRelativePath(relativePath);
  if (!normalized) throw new RangeError('Некорректный путь фотографии');
  const parts = normalized.split('/');
  const fileName = parts.pop() as string;
  const extensionIndex = fileName.lastIndexOf('.');
  const extension = extensionIndex > 0 ? fileName.slice(extensionIndex) : '';
  const stem = extension ? fileName.slice(0, extensionIndex) : fileName;
  const [year, month, day] = date.split('-');

  if (/^(?:19|20)\d{2}$/.test(parts.at(-2) || '') && /^\d{1,2}$/.test(parts.at(-1) || '')) {
    const previousStem = stem.replace(/^\d{1,2}(?:[ ._-]+|$)/, '');
    const separator = stem.match(/^\d{1,2}([ ._-]+)/)?.[1] || '';
    const nextStem = previousStem ? `${day}${separator || ' '}${previousStem}` : day;
    return [...parts.slice(0, -2), year, month, `${nextStem}${extension}`].join('/');
  }

  if (/^(?:19|20)\d{2}$/.test(parts.at(-3) || '')
      && /^\d{1,2}$/.test(parts.at(-2) || '')
      && /^\d{1,2}$/.test(parts.at(-1) || '')) {
    return [...parts.slice(0, -3), year, month, day, fileName].join('/');
  }

  const datePrefix = stem.match(/^(?:19|20)\d{2}([._-])\d{1,2}\1\d{1,2}([ ._-]+|$)/);
  if (datePrefix) {
    const replacement = [year, month, day].join(datePrefix[1]) + (datePrefix[2] || ' ');
    return [...parts, `${stem.replace(datePrefix[0], replacement)}${extension}`].join('/');
  }

  return [...parts, `${date} ${stem}${extension}`].join('/');
}

export function moveViewerMetadata(
  metadata: ArchiveViewerMetadata,
  oldPath: string,
  newPath: string,
  oldDate: string,
  newDate: string,
  {
    moveBlurDate = true,
    moveHighlights = true
  }: {
    moveBlurDate?: boolean;
    moveHighlights?: boolean;
  } = {}
): ArchiveViewerMetadata {
  const next = normalizeViewerMetadata(metadata);
  const location = next.locations[oldPath];
  if (location) {
    delete next.locations[oldPath];
    next.locations[newPath] = location;
  }
  if (moveBlurDate && next.blurDates.includes(oldDate)) {
    next.blurDates = [...new Set(next.blurDates.filter((date) => date !== oldDate).concat(newDate))].sort();
  }
  if (moveHighlights) {
    for (const scope of ['months', 'years'] as const) {
      const oldPeriod = oldDate.slice(0, scope === 'months' ? 7 : 4);
      if (next.highlights[scope][oldPeriod] !== oldDate) continue;
      delete next.highlights[scope][oldPeriod];
      const newPeriod = newDate.slice(0, scope === 'months' ? 7 : 4);
      next.highlights[scope][newPeriod] = newDate;
    }
  }
  return next;
}

export function validLocation(value: unknown): value is ArchiveLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as Partial<ArchiveLocation>;
  return Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && Number(location.latitude) >= -90
    && Number(location.latitude) <= 90
    && Number(location.longitude) >= -180
    && Number(location.longitude) <= 180;
}

export function parseCoordinateQuery(value: string): ArchiveLocation | null {
  const match = value.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const location = {
    latitude: Number(match[1].replace(',', '.')),
    longitude: Number(match[2].replace(',', '.'))
  };
  return validLocation(location) ? location : null;
}

export function normalizePlaceSearchResults(value: unknown): PlaceSearchResult[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).flatMap((item, index) => {
    const location = {
      latitude: Number(item?.lat),
      longitude: Number(item?.lon)
    };
    const label = typeof item?.display_name === 'string' ? item.display_name.trim().slice(0, 500) : '';
    if (!validLocation(location) || !label) return [];
    return [{
      ...(typeof item?.address?.country === 'string'
        ? { country: item.address.country.trim().slice(0, 120) }
        : {}),
      id: `${item?.osm_type || 'place'}:${item?.osm_id || item?.place_id || index}`,
      label,
      ...location,
      place: label.slice(0, 240)
    }];
  });
}

function safeRelativePath(value: string): string | null {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized && !normalized.startsWith('/') && !normalized.split('/').some((part) => !part || part === '..')
    ? normalized
    : null;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?:19|20)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function stringRecord(value: unknown, validKey: (key: string) => boolean): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => (
    validKey(key) && typeof item === 'string'
  )));
}

function locationRecord(value: unknown): Record<string, ArchiveLocation> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([path, location]) => {
    const safePath = safeRelativePath(path);
    return safePath && validLocation(location) ? [[safePath, {
      ...(typeof location.country === 'string' && location.country.trim()
        ? { country: location.country.trim().slice(0, 120) }
        : {}),
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      ...(typeof location.place === 'string' && location.place.trim()
        ? { place: location.place.trim().slice(0, 240) }
        : {})
    }]] : [];
  }));
}
