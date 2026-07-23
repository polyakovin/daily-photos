const fs = require('fs');
const path = require('path');
const exifr = require('exifr');
const { importDateOverrideForFile } = require('./import-date-overrides');

const IMAGE_RE = /\.(?:jpe?g|png|webp|gif|avif)$/i;
const METADATA_DATE_TAGS = [
  'DateTimeOriginal',
  'CreateDate',
  'DateTimeDigitized',
  'DateCreated',
  'ModifyDate',
  'DateTime'
];
const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.cache',
  '.thumbnails',
  '$RECYCLE.BIN',
  'System Volume Information',
  'node_modules',
  'Caches',
  'Cache',
  'DerivedData',
  'Applications',
  'Audiobooks',
  'Books',
  'Movies',
  'Music',
  'Podcasts',
  'Video',
  'Videos'
]);
const ROOT_SYSTEM_DIRECTORIES = new Set([
  'Applications',
  'Library',
  'System',
  'Windows',
  'Program Files',
  'Program Files (x86)',
  'ProgramData',
  'Recovery',
  'bin',
  'boot',
  'dev',
  'etc',
  'opt',
  'private',
  'proc',
  'run',
  'sbin',
  'snap',
  'sys',
  'tmp',
  'usr',
  'var'
]);
const IGNORED_DIRECTORY_NAMES_LOWER = new Set(
  [...IGNORED_DIRECTORY_NAMES].map((name) => name.toLowerCase())
);
const ROOT_SYSTEM_DIRECTORIES_LOWER = new Set(
  [...ROOT_SYSTEM_DIRECTORIES].map((name) => name.toLowerCase())
);
const MAX_CONCURRENCY = 8;
const PROGRESS_INTERVAL_MS = 120;

function isUsableDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return false;
  const year = value.getFullYear();
  const tomorrow = Date.now() + 86400000;
  return year >= 1900 && value.getTime() <= tomorrow;
}

function dateKeyFromValue(value) {
  let date = value;
  if (typeof value === 'string') {
    const direct = value.match(/((?:19|20)\d{2})[:.-](1[0-2]|0?[1-9])[:.-](3[01]|[12]\d|0?[1-9])(?:\D|$)/);
    if (direct) {
      const year = Number(direct[1]);
      const month = Number(direct[2]);
      const day = Number(direct[3]);
      const candidate = new Date(year, month - 1, day);
      if (
        candidate.getFullYear() === year
        && candidate.getMonth() === month - 1
        && candidate.getDate() === day
        && isUsableDate(candidate)
      ) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return null;
    }
    date = new Date(value);
  }
  if (!isUsableDate(date)) return null;
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
    .join('-');
}

function dateFromPath(filePath) {
  const value = filePath.split(path.sep).join('/');
  let match = value.match(/(?:^|\/)((?:19|20)\d{2})[._-](1[0-2]|0?[1-9])[._-](3[01]|[12]\d|0?[1-9])(?:\D|$)/);
  if (!match) {
    const parts = value.match(/(?:^|\/)((?:19|20)\d{2})\/(1[0-2]|0?[1-9])\/([^/]+)$/);
    if (!parts) return null;
    const day = parts[3].match(/^(?:.*?[._-])?(3[01]|[12]\d|0?[1-9])(?:\D|$)/);
    if (!day) return null;
    match = [parts[0], parts[1], parts[2], day[1]];
  }
  return dateKeyFromValue(`${match[1]}-${match[2]}-${match[3]}`);
}

function importedDateFromPath(filePath) {
  const fileName = path.basename(filePath);
  const match = fileName.match(/^((?:19|20)\d{2}-\d{2}-\d{2})\.photoday\./i);
  return match ? dateKeyFromValue(match[1]) : null;
}

async function embeddedPhotoDate(filePath) {
  try {
    const metadata = await exifr.parse(filePath, {
      pick: METADATA_DATE_TAGS,
      xmp: { pick: METADATA_DATE_TAGS },
      mergeOutput: true,
      reviveValues: true,
      sanitize: true
    });
    for (const tag of METADATA_DATE_TAGS) {
      const date = dateKeyFromValue(metadata?.[tag]);
      if (date) return date;
    }
  } catch {
    // Повреждённые или неподдерживаемые метаданные не должны останавливать индексирование.
  }
  return null;
}

function shouldSkipDirectory(parent, entryName, sourceRoot) {
  const normalizedEntryName = entryName.toLowerCase();
  if (entryName.startsWith('.') || IGNORED_DIRECTORY_NAMES_LOWER.has(normalizedEntryName)) return true;
  if (
    path.resolve(parent) === path.parse(path.resolve(sourceRoot)).root
    && ROOT_SYSTEM_DIRECTORIES_LOWER.has(normalizedEntryName)
  ) {
    return true;
  }
  const normalizedParent = parent.split(path.sep).join('/').toLowerCase();
  if (normalizedParent.includes('.photoslibrary')) {
    return !['originals', 'masters'].includes(entryName.toLowerCase())
      && !normalizedParent.includes('/originals')
      && !normalizedParent.includes('/masters');
  }
  return false;
}

function estimateSeconds(startedAt, completed, total) {
  if (!startedAt || completed < 2 || total <= completed) return total === completed ? 0 : null;
  const elapsedSeconds = (Date.now() - startedAt) / 1000;
  if (elapsedSeconds <= 0) return null;
  return Math.max(1, Math.round((total - completed) / (completed / elapsedSeconds)));
}

function emitThrottled(callback) {
  let lastEmission = 0;
  return (value, force = false) => {
    const now = Date.now();
    if (!force && now - lastEmission < PROGRESS_INTERVAL_MS) return;
    lastEmission = now;
    callback?.(value);
  };
}

function immediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function discoverImages(roots, onProgress) {
  const queue = roots.map((root) => ({ directory: root, sourceRoot: root }));
  const files = [];
  let completedDirectories = 0;
  let skippedDirectories = 0;
  let displayedProgress = 2;
  let queueCursor = 0;
  const startedAt = Date.now();
  const emit = emitThrottled(onProgress);

  while (queueCursor < queue.length) {
    const { directory, sourceRoot } = queue[queueCursor];
    queueCursor += 1;
    let entries;
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch {
      skippedDirectories += 1;
      completedDirectories += 1;
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(directory, entry.name, sourceRoot)) {
          queue.push({ directory: absolutePath, sourceRoot });
        }
      } else if (
        entry.isFile()
        && IMAGE_RE.test(entry.name)
        && !entry.name.includes('.orientation-raw.')
        && !entry.name.includes('.orientation-fixed.')
      ) {
        files.push(absolutePath);
      }
    }

    completedDirectories += 1;
    const knownTotal = completedDirectories + queue.length - queueCursor;
    const estimatedShare = knownTotal ? completedDirectories / knownTotal : 1;
    displayedProgress = Math.max(displayedProgress, Math.min(29, 2 + Math.round(estimatedShare * 27)));
    emit({
      phase: 'discovery',
      detail: `Ищем изображения · найдено ${files.length.toLocaleString('ru-RU')}`,
      progress: displayedProgress,
      completed: completedDirectories,
      total: knownTotal,
      unit: 'папок',
      etaSeconds: estimateSeconds(startedAt, completedDirectories, knownTotal),
      skipped: skippedDirectories
    });
    if (completedDirectories % 20 === 0) await immediate();
  }

  emit({
    phase: 'discovery',
    detail: `Найдено изображений: ${files.length.toLocaleString('ru-RU')}`,
    progress: 30,
    completed: completedDirectories,
    total: completedDirectories,
    unit: 'папок',
    etaSeconds: 0,
    skipped: skippedDirectories
  }, true);
  return { files, skippedDirectories };
}

async function readIndexedPhoto(filePath, { dateOverrides, overrideRoot } = {}) {
  let stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch {
    return null;
  }
  if (!stats.isFile()) return null;

  const selectedImportDate = dateOverrides && overrideRoot
    ? importDateOverrideForFile(dateOverrides, overrideRoot, filePath)
    : null;
  const date = selectedImportDate
    || importedDateFromPath(filePath)
    || await embeddedPhotoDate(filePath)
    || dateFromPath(filePath)
    || dateKeyFromValue(stats.birthtime)
    || dateKeyFromValue(stats.mtime);
  if (!date) return null;
  return {
    date,
    name: path.parse(filePath).name.replace(/[?_]+$/g, '') || 'Фото дня',
    filePath,
    modified: Math.trunc(stats.mtimeMs),
    size: stats.size
  };
}

async function indexPhotoRoots({ roots, onProgress, dateOverrides, overrideRoot } = {}) {
  const normalizedRoots = [...new Set((roots || []).map((root) => path.resolve(root)))];
  if (!normalizedRoots.length) throw new Error('Не указано, где искать фотографии');
  const { files, skippedDirectories } = await discoverImages(normalizedRoots, onProgress);
  const indexed = [];
  let cursor = 0;
  let completed = 0;
  const startedAt = Date.now();
  const emit = emitThrottled(onProgress);

  async function worker() {
    while (cursor < files.length) {
      const fileIndex = cursor;
      cursor += 1;
      const photo = await readIndexedPhoto(files[fileIndex], { dateOverrides, overrideRoot });
      if (photo) indexed.push(photo);
      completed += 1;
      const share = files.length ? completed / files.length : 1;
      emit({
        phase: 'metadata',
        detail: `Читаем даты съёмки · распознано ${indexed.length.toLocaleString('ru-RU')}`,
        progress: 30 + Math.round(share * 66),
        completed,
        total: files.length,
        unit: 'фото',
        etaSeconds: estimateSeconds(startedAt, completed, files.length),
        skipped: skippedDirectories
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, Math.max(1, files.length)) }, worker));
  emit({
    phase: 'metadata',
    detail: `Даты распознаны у ${indexed.length.toLocaleString('ru-RU')} фото`,
    progress: 96,
    completed: files.length,
    total: files.length,
    unit: 'фото',
    etaSeconds: 0,
    skipped: skippedDirectories
  }, true);

  return indexed.sort((a, b) => a.date.localeCompare(b.date) || a.filePath.localeCompare(b.filePath));
}

module.exports = {
  IMAGE_RE,
  dateFromPath,
  dateKeyFromValue,
  embeddedPhotoDate,
  importedDateFromPath,
  indexPhotoRoots,
  shouldSkipDirectory
};
