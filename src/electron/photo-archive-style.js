const fs = require('node:fs');
const path = require('node:path');

const IMAGE_RE = /\.(?:jpe?g|png|webp|gif|avif|heic|heif)$/i;
const STYLE_TYPES = new Set([
  'year-month-day-directory',
  'year-month-day-file',
  'year-month-day-name',
  'year-month-full-date-name',
  'year-month-original',
  'year-full-date-name',
  'year-month-day-prefix-name',
  'year-original',
  'date-directory',
  'full-date-name'
]);
const STYLE_SAMPLE_LIMIT = 1200;
const DIRECTORY_SCAN_LIMIT = 1000;
const MIN_STYLE_SAMPLES = 3;
const MIN_STYLE_SHARE = 0.55;
const DEFAULT_ARCHIVE_STYLE = Object.freeze({
  type: 'full-date-name',
  prefix: '',
  dateSeparator: '-',
  nameSeparator: ' ',
  monthWidth: 2,
  dayWidth: 2
});

function safePrefix(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\\/g, '/').replace(/^\.\/|\/$/g, '');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) return null;
  return normalized;
}

function normalizeArchiveStyle(value) {
  if (!value || !STYLE_TYPES.has(value.type)) return null;
  const prefix = safePrefix(value.prefix || '');
  if (prefix === null) return null;
  const dateSeparator = ['-', '.', '_'].includes(value.dateSeparator) ? value.dateSeparator : '-';
  const nameSeparator = typeof value.nameSeparator === 'string'
    && value.nameSeparator.length <= 3
    && /^[ ._-]*$/.test(value.nameSeparator)
    ? value.nameSeparator || ' '
    : ' ';
  return {
    type: value.type,
    prefix,
    dateSeparator,
    nameSeparator,
    monthWidth: value.monthWidth === 1 ? 1 : 2,
    dayWidth: value.dayWidth === 1 ? 1 : 2
  };
}

function parseFullDatePrefix(value) {
  const match = value.match(/^((?:19|20)\d{2})([._-])(\d{1,2})\2(\d{1,2})([ ._-]+|$)/);
  if (!match) return null;
  const month = Number(match[3]);
  const day = Number(match[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {
    dateSeparator: match[2],
    monthWidth: match[3].length,
    dayWidth: match[4].length,
    nameSeparator: match[5] || ' '
  };
}

function dateDirectoryStyle(segment) {
  const date = parseFullDatePrefix(segment);
  if (!date || !new RegExp(`\\d[${date.dateSeparator.replace('-', '\\-')}]\\d+$`).test(segment)) return null;
  return date;
}

function isYear(value) {
  return /^(?:19|20)\d{2}$/.test(value);
}

function isMonth(value) {
  return /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 12;
}

function isDay(value) {
  return /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 31;
}

function joinedPrefix(parts) {
  return parts.join('/');
}

function classifyArchivePath(relativePath) {
  const normalizedPath = relativePath.split(path.sep).join('/');
  const parts = normalizedPath.split('/');
  const fileName = parts.at(-1);
  const stem = path.posix.parse(fileName).name;
  const directories = parts.slice(0, -1);
  const last = directories.at(-1);
  const beforeLast = directories.at(-2);
  const thirdLast = directories.at(-3);

  if (isYear(thirdLast) && isMonth(beforeLast) && isDay(last)) {
    return {
      type: 'year-month-day-directory',
      prefix: joinedPrefix(directories.slice(0, -3)),
      dateSeparator: '-',
      nameSeparator: ' ',
      monthWidth: beforeLast.length,
      dayWidth: last.length
    };
  }

  if (isYear(beforeLast) && isMonth(last)) {
    const prefix = joinedPrefix(directories.slice(0, -2));
    const fullDate = parseFullDatePrefix(stem);
    if (fullDate) return { type: 'year-month-full-date-name', prefix, ...fullDate };
    if (isDay(stem)) {
      return {
        type: 'year-month-day-file',
        prefix,
        dateSeparator: '-',
        nameSeparator: ' ',
        monthWidth: last.length,
        dayWidth: stem.length
      };
    }
    const dayPrefix = stem.match(/^(\d{1,2})([ ._-]+)/);
    if (dayPrefix && isDay(dayPrefix[1])) {
      return {
        type: 'year-month-day-name',
        prefix,
        dateSeparator: '-',
        nameSeparator: dayPrefix[2] || ' ',
        monthWidth: last.length,
        dayWidth: dayPrefix[1].length
      };
    }
    return {
      type: 'year-month-original',
      prefix,
      dateSeparator: '-',
      nameSeparator: ' ',
      monthWidth: last.length,
      dayWidth: 2
    };
  }

  if (isYear(last)) {
    const prefix = joinedPrefix(directories.slice(0, -1));
    const fullDate = parseFullDatePrefix(stem);
    if (fullDate) return { type: 'year-full-date-name', prefix, ...fullDate };
    const monthDay = stem.match(/^(\d{1,2})([._-])(\d{1,2})([ ._-]+|$)/);
    if (monthDay && isMonth(monthDay[1]) && isDay(monthDay[3])) {
      return {
        type: 'year-month-day-prefix-name',
        prefix,
        dateSeparator: monthDay[2],
        nameSeparator: monthDay[4] || ' ',
        monthWidth: monthDay[1].length,
        dayWidth: monthDay[3].length
      };
    }
    return {
      type: 'year-original',
      prefix,
      dateSeparator: '-',
      nameSeparator: ' ',
      monthWidth: 2,
      dayWidth: 2
    };
  }

  const dateDirectory = dateDirectoryStyle(last || '');
  if (dateDirectory) {
    return {
      type: 'date-directory',
      prefix: joinedPrefix(directories.slice(0, -1)),
      ...dateDirectory
    };
  }

  const fullDate = parseFullDatePrefix(stem);
  if (fullDate) {
    return {
      type: 'full-date-name',
      prefix: joinedPrefix(directories),
      ...fullDate
    };
  }
  return null;
}

function styleIdentity(style) {
  return JSON.stringify(normalizeArchiveStyle(style));
}

function mostFrequent(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] || null;
}

async function sampleArchiveImages(archivePath) {
  const queue = [archivePath];
  const files = [];
  let directoryCount = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    if (files.length >= STYLE_SAMPLE_LIMIT || directoryCount >= DIRECTORY_SCAN_LIMIT) break;
    const directory = queue[cursor];
    directoryCount += 1;
    let entries;
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '_diary') continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) queue.push(absolutePath);
      else if (entry.isFile() && IMAGE_RE.test(entry.name)) {
        files.push(path.relative(archivePath, absolutePath));
        if (files.length >= STYLE_SAMPLE_LIMIT) break;
      }
    }
  }
  return files;
}

async function detectArchiveStyle(archivePath) {
  const files = await sampleArchiveImages(archivePath);
  const classified = files.map(classifyArchivePath).filter(Boolean);
  if (!classified.length) return { ...DEFAULT_ARCHIVE_STYLE };

  const winningType = mostFrequent(classified.map((style) => style.type));
  if (
    !winningType
    || winningType[1] < MIN_STYLE_SAMPLES
    || winningType[1] / files.length < MIN_STYLE_SHARE
  ) return { ...DEFAULT_ARCHIVE_STYLE };

  const matchingStyles = classified.filter((style) => style.type === winningType[0]);
  const winningVariant = mostFrequent(matchingStyles.map(styleIdentity));
  if (!winningVariant || winningVariant[1] < MIN_STYLE_SAMPLES) return { ...DEFAULT_ARCHIVE_STYLE };
  return JSON.parse(winningVariant[0]);
}

function padded(value, width) {
  return width === 1 ? String(Number(value)) : String(value).padStart(2, '0');
}

function safePhotoStem(filePath) {
  const parsed = path.parse(path.basename(filePath));
  const sanitized = parsed.name
    .normalize('NFKC')
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 96);
  return sanitized || 'photo';
}

function archiveDestination(styleValue, date, sourcePath) {
  const style = normalizeArchiveStyle(styleValue) || { ...DEFAULT_ARCHIVE_STYLE };
  const [year, rawMonth, rawDay] = date.split('-');
  const month = padded(rawMonth, style.monthWidth);
  const day = padded(rawDay, style.dayWidth);
  const fullDate = [year, month, day].join(style.dateSeparator);
  const monthDay = [month, day].join(style.dateSeparator);
  const sourceStem = safePhotoStem(sourcePath);
  let directoryParts = style.prefix ? style.prefix.split('/') : [];
  let stem = sourceStem;

  switch (style.type) {
    case 'year-month-day-directory':
      directoryParts = [...directoryParts, year, month, day];
      break;
    case 'year-month-day-file':
      directoryParts = [...directoryParts, year, month];
      stem = day;
      break;
    case 'year-month-day-name':
      directoryParts = [...directoryParts, year, month];
      stem = `${day}${style.nameSeparator}${sourceStem}`;
      break;
    case 'year-month-full-date-name':
      directoryParts = [...directoryParts, year, month];
      stem = `${fullDate}${style.nameSeparator}${sourceStem}`;
      break;
    case 'year-month-original':
      directoryParts = [...directoryParts, year, month];
      break;
    case 'year-full-date-name':
      directoryParts = [...directoryParts, year];
      stem = `${fullDate}${style.nameSeparator}${sourceStem}`;
      break;
    case 'year-month-day-prefix-name':
      directoryParts = [...directoryParts, year];
      stem = `${monthDay}${style.nameSeparator}${sourceStem}`;
      break;
    case 'year-original':
      directoryParts = [...directoryParts, year];
      break;
    case 'date-directory':
      directoryParts = [...directoryParts, fullDate];
      break;
    default:
      stem = `${fullDate}${style.nameSeparator}${sourceStem}`;
  }
  return { directoryParts, stem };
}

module.exports = {
  DEFAULT_ARCHIVE_STYLE,
  STYLE_TYPES,
  archiveDestination,
  classifyArchivePath,
  detectArchiveStyle,
  normalizeArchiveStyle,
  safePhotoStem,
  sampleArchiveImages
};
