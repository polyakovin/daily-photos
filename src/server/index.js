const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { indexPhotoRoots } = require('./photo-indexer');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RENDERER_ROOT = path.join(PROJECT_ROOT, 'src', 'renderer');
const SCRIPTS_ROOT = path.join(PROJECT_ROOT, 'scripts');
let CONTENT_ROOT = path.resolve(process.env.PHOTO_DAY_CONTENT_ROOT || path.join(PROJECT_ROOT, 'content'));
let DIARY_ROOT = path.join(CONTENT_ROOT, '_diary');
let STATE_ROOT = path.resolve(process.env.PHOTO_DAY_STATE_ROOT || path.join(PROJECT_ROOT, '.local'));
let TMP_ROOT = path.join(STATE_ROOT, 'tmp');
let PREVIEW_ROOT = path.join(TMP_ROOT, 'previews');
let INDEXED_PREVIEW_ROOT = path.join(STATE_ROOT, 'cache', 'photo-previews');
let BLUR_DATES_FILE = path.join(STATE_ROOT, 'presentation_blur_dates.json');
let INDEX_CACHE_FILE = path.join(STATE_ROOT, 'photo-index.json');
let PHOTO_SELECTIONS_FILE = path.join(STATE_ROOT, 'daily_photo_selections.json');
const SERVER_VERSION = String(Math.trunc(fs.statSync(__filename).mtimeMs / 1000));
const PORT = Number(process.env.PORT || 4173);
const IMAGE_RE = /\.(?:jpe?g|png|webp|gif|avif)$/i;
const WATCHED_IMAGE_RE = /\.(?:jpe?g|png|webp|gif|avif|heic|heif)$/i;
const DIARY_FILE_RE = /^((?:19|20)\d{2})\.(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])\.md$/i;
const DATE_KEY_RE = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const UI_FILES = new Map([
  ['/app.html', 'index.html'],
  ['/styles.css', 'styles.css'],
  ['/life-range.js', 'life-range.js'],
  ['/app.js', 'app.js']
]);
const updateClients = new Set();

let shouldConvertImages = process.env.PHOTO_DAY_CONVERT_IMAGES !== '0';
let shouldIndexMetadata = false;
let indexedPreviewGenerator = null;
let sourceMode = 'folder';
let sourceRoots = [CONTENT_ROOT];
let archiveWatcher = null;
let operationSequence = 0;
let activeOperation = null;
let hasLoadedIndexCache = false;
const indexedPhotoFiles = new Map();
const indexedPreviewJobs = new Map();
let photoSelections = new Map();

function configurePaths({
  contentRoot,
  stateRoot,
  metadataIndex,
  indexedPreviewGenerator: nextIndexedPreviewGenerator,
  mode,
  roots
} = {}) {
  if (contentRoot) CONTENT_ROOT = path.resolve(contentRoot);
  if (stateRoot) STATE_ROOT = path.resolve(stateRoot);
  if (typeof metadataIndex === 'boolean') shouldIndexMetadata = metadataIndex;
  if (typeof nextIndexedPreviewGenerator === 'function' || nextIndexedPreviewGenerator === null) {
    indexedPreviewGenerator = nextIndexedPreviewGenerator;
  }
  if (mode === 'folder' || mode === 'computer') sourceMode = mode;
  if (Array.isArray(roots) && roots.length) sourceRoots = roots.map((root) => path.resolve(root));
  else if (contentRoot) sourceRoots = [CONTENT_ROOT];
  DIARY_ROOT = path.join(CONTENT_ROOT, '_diary');
  TMP_ROOT = path.join(STATE_ROOT, 'tmp');
  PREVIEW_ROOT = path.join(TMP_ROOT, 'previews');
  INDEXED_PREVIEW_ROOT = path.join(STATE_ROOT, 'cache', 'photo-previews');
  BLUR_DATES_FILE = path.join(STATE_ROOT, 'presentation_blur_dates.json');
  INDEX_CACHE_FILE = path.join(STATE_ROOT, 'photo-index.json');
  PHOTO_SELECTIONS_FILE = path.join(STATE_ROOT, 'daily_photo_selections.json');
}

function isValidDateKey(value) {
  if (!DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function readBlurDates() {
  try {
    const values = JSON.parse(fs.readFileSync(BLUR_DATES_FILE, 'utf8'));
    if (!Array.isArray(values)) throw new Error('ожидался массив дат');
    return new Set(values.filter((value) => typeof value === 'string' && isValidDateKey(value)));
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    console.error(`Не удалось прочитать ${path.basename(BLUR_DATES_FILE)}: ${error.message}`);
    return new Set();
  }
}

function sortedBlurDates() {
  return [...blurDates].sort();
}

function writeBlurDates() {
  const temporaryFile = `${BLUR_DATES_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(sortedBlurDates(), null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryFile, BLUR_DATES_FILE);
}

function readPhotoSelections() {
  try {
    const values = JSON.parse(fs.readFileSync(PHOTO_SELECTIONS_FILE, 'utf8'));
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('ожидался объект');
    return new Map(Object.entries(values).filter(([date, photoId]) => (
      isValidDateKey(date) && typeof photoId === 'string' && /^[a-f0-9]{32}$/.test(photoId)
    )));
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    console.error(`Не удалось прочитать ${path.basename(PHOTO_SELECTIONS_FILE)}: ${error.message}`);
    return new Map();
  }
}

function serializedPhotoSelections() {
  return Object.fromEntries([...photoSelections.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function writePhotoSelections() {
  const temporaryFile = `${PHOTO_SELECTIONS_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(serializedPhotoSelections(), null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryFile, PHOTO_SELECTIONS_FILE);
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  response.end(JSON.stringify(value));
}

function notifyEvent(name, value) {
  const message = `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`;
  for (const client of updateClients) client.write(message);
}

function startOperation(title, detail, progress = 0) {
  activeOperation = {
    id: `${Date.now()}-${operationSequence += 1}`,
    status: 'running',
    title,
    detail,
    progress,
    completed: null,
    total: null,
    unit: null,
    etaSeconds: null,
    startedAt: Date.now()
  };
  notifyEvent('background-operation', activeOperation);
  return activeOperation.id;
}

function updateOperation(id, patch) {
  if (!activeOperation || activeOperation.id !== id) return;
  activeOperation = { ...activeOperation, ...patch, status: 'running' };
  notifyEvent('background-operation', activeOperation);
}

function finishOperation(id, detail, error = null) {
  if (!activeOperation || activeOperation.id !== id) return;
  activeOperation = {
    ...activeOperation,
    status: error ? 'error' : 'success',
    detail: error || detail,
    progress: error ? activeOperation.progress : 100,
    completed: error ? activeOperation.completed : activeOperation.total,
    etaSeconds: error ? activeOperation.etaSeconds : 0
  };
  notifyEvent('background-operation', activeOperation);
  activeOperation = null;
}

function streamChildOutput(stream, destination, onLine = null) {
  let buffered = '';
  stream.on('data', (chunk) => {
    buffered += chunk.toString();
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() || '';
    for (const line of lines) {
      if (!onLine?.(line)) destination.write(`${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffered && !onLine?.(buffered)) destination.write(buffered);
  });
}

function convertNewImages(onProgress = null) {
  if (!shouldConvertImages) return Promise.resolve(true);
  const script = path.join(SCRIPTS_ROOT, 'images-to-webp.sh');
  const pathValue = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    process.env.PATH || ''
  ].join(path.delimiter);

  console.log('Поиск новых изображений...');
  return new Promise((resolve) => {
    const child = spawn('/bin/bash', [script, '--delete-source', CONTENT_ROOT], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PATH: pathValue },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    streamChildOutput(child.stdout, process.stdout, (line) => {
      const match = line.match(/^PHOTO_DAY_PROGRESS\s+(conversion|previews)\s+(\d+)\s+(\d+)$/);
      if (!match) return false;
      const phase = match[1];
      const completed = Number(match[2]);
      const total = Number(match[3]);
      const phaseProgress = total > 0 ? completed / total : 1;
      const progress = phase === 'conversion'
        ? 8 + Math.round(phaseProgress * 50)
        : 58 + Math.round(phaseProgress * 25);
      onProgress?.({ phase, completed, total, progress });
      return true;
    });
    streamChildOutput(child.stderr, process.stderr);
    child.once('error', (error) => {
      console.error(`Не удалось запустить конвертацию: ${error.message}`);
      resolve(false);
    });
    child.once('close', (code) => {
      if (code !== 0) console.error(`Конвертация завершилась с кодом ${code}.`);
      resolve(code === 0);
    });
  });
}

function dateFromPath(relativePath) {
  const value = relativePath.split(path.sep).join('/');
  let match = value.match(/(?:^|\/)((?:19|20)\d{2})[._-](1[0-2]|0?[1-9])[._-](3[01]|[12]\d|0?[1-9])(?:\D|$)/);

  if (!match) {
    const parts = value.match(/(?:^|\/)((?:19|20)\d{2})\/(1[0-2]|0?[1-9])\/([^/]+)$/);
    if (!parts) return null;

    const day = parts[3].match(/^(?:.*?[._-])?(3[01]|[12]\d|0?[1-9])(?:\D|$)/);
    if (!day) return null;
    match = [parts[0], parts[1], parts[2], day[1]];
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function scanPhotos() {
  const result = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (
        IMAGE_RE.test(entry.name)
        && !entry.name.includes('.orientation-raw.')
        && !entry.name.includes('.orientation-fixed.')
      ) {
        const relativePath = path.relative(CONTENT_ROOT, absolutePath);
        const date = dateFromPath(relativePath);
        if (!date) continue;
        result.push({
          id: indexedPhotoId(absolutePath),
          date,
          name: path.parse(entry.name).name.replace(/[?_]+$/g, '') || 'Фото дня',
          src: photoSource(relativePath),
          thumbnailSrc: previewSource(relativePath)
        });
      }
    }
  }

  walk(CONTENT_ROOT);
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.src.localeCompare(b.src));
}

function indexSourceSignature(mode = sourceMode, roots = sourceRoots) {
  return JSON.stringify({ version: 1, mode, roots: roots.map((root) => path.resolve(root)).sort() });
}

function indexedPhotoId(filePath) {
  return crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 32);
}

function buildIndexedHighlights(indexedPhotos) {
  const years = new Map();
  const months = new Map();
  for (const photo of indexedPhotos) {
    const year = Number(photo.date.slice(0, 4));
    const month = Number(photo.date.slice(5, 7));
    if (!years.has(year)) {
      years.set(year, {
        year,
        date: photo.date,
        src: photo.src,
        thumbnailSrc: photo.thumbnailSrc
      });
    }
    const monthKey = `${year}-${month}`;
    if (!months.has(monthKey)) {
      months.set(monthKey, {
        year,
        month,
        date: photo.date,
        src: photo.src,
        thumbnailSrc: photo.thumbnailSrc
      });
    }
  }
  return { years: [...years.values()], months: [...months.values()] };
}

function installIndexedRecords(records) {
  indexedPhotoFiles.clear();
  photos = records.map((record) => {
    const filePath = path.resolve(record.filePath);
    const id = indexedPhotoId(filePath);
    const modified = Math.max(0, Math.trunc(Number(record.modified) || 0));
    const size = Math.max(0, Math.trunc(Number(record.size) || 0));
    const version = `${modified}-${size}`;
    indexedPhotoFiles.set(id, { filePath, version });
    const source = `/indexed-photo/${id}?v=${modified}`;
    return {
      id,
      date: record.date,
      name: record.name || path.parse(filePath).name || 'Фото дня',
      src: source,
      thumbnailSrc: indexedPreviewGenerator
        ? `/indexed-preview/${id}?v=${version}`
        : source
    };
  });
  highlights = buildIndexedHighlights(photos);
}

function writeIndexCache(records) {
  const temporaryFile = `${INDEX_CACHE_FILE}.tmp`;
  const payload = {
    signature: indexSourceSignature(),
    createdAt: new Date().toISOString(),
    records
  };
  fs.writeFileSync(temporaryFile, `${JSON.stringify(payload)}\n`, 'utf8');
  fs.renameSync(temporaryFile, INDEX_CACHE_FILE);
  hasLoadedIndexCache = true;
}

function loadIndexCache() {
  try {
    const payload = JSON.parse(fs.readFileSync(INDEX_CACHE_FILE, 'utf8'));
    if (payload.signature !== indexSourceSignature() || !Array.isArray(payload.records)) return false;
    const records = payload.records.filter((record) => (
      record
      && typeof record.filePath === 'string'
      && typeof record.date === 'string'
      && typeof record.name === 'string'
    ));
    installIndexedRecords(records);
    hasLoadedIndexCache = true;
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(`Не удалось прочитать индекс фото: ${error.message}`);
    return false;
  }
}

async function indexMetadataPhotos(operationId) {
  const records = await indexPhotoRoots({
    roots: sourceRoots,
    onProgress: (progress) => updateOperation(operationId, progress)
  });
  updateOperation(operationId, {
    detail: 'Собираем календарь',
    progress: 98,
    completed: records.length,
    total: records.length,
    unit: 'фото',
    etaSeconds: 0
  });
  installIndexedRecords(records);
  diary = sourceMode === 'folder' ? scanDiary() : [];
  writeIndexCache(records);
  return records;
}

function scanDiary() {
  const result = [];
  let entries;
  try {
    entries = fs.readdirSync(DIARY_ROOT, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return result;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(DIARY_FILE_RE);
    if (!match) continue;
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    if (!isValidDateKey(date)) continue;
    result.push({
      date,
      content: fs.readFileSync(path.join(DIARY_ROOT, entry.name), 'utf8')
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function photoSource(relativePath) {
  return versionedImageSource('photo', CONTENT_ROOT, relativePath);
}

function previewSource(relativePath) {
  try {
    if (fs.statSync(path.join(PREVIEW_ROOT, relativePath)).isFile()) {
      return versionedImageSource('preview', PREVIEW_ROOT, relativePath);
    }
  } catch {
    // Пока превью не создано, используем оригинал.
  }
  return photoSource(relativePath);
}

function versionedImageSource(route, baseDirectory, relativePath) {
  const encodedPath = relativePath.split(path.sep).map(encodeURIComponent).join('/');
  try {
    const modified = Math.trunc(fs.statSync(path.join(baseDirectory, relativePath)).mtimeMs);
    return `/${route}/${encodedPath}?v=${modified}`;
  } catch {
    return `/${route}/${encodedPath}`;
  }
}

function findMatchingPhotoDate(highlightPath, candidateDirectory) {
  let highlightSize;
  try {
    highlightSize = fs.statSync(highlightPath).size;
  } catch {
    return null;
  }

  let highlightContents = null;
  function walk(directory) {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return null;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const match = walk(absolutePath);
        if (match) return match;
        continue;
      }
      if (!entry.isFile() || !IMAGE_RE.test(entry.name)) continue;

      const relativePath = path.relative(CONTENT_ROOT, absolutePath);
      const date = dateFromPath(relativePath);
      if (!date) continue;
      try {
        if (fs.statSync(absolutePath).size !== highlightSize) continue;
        if (!highlightContents) highlightContents = fs.readFileSync(highlightPath);
        if (highlightContents.equals(fs.readFileSync(absolutePath))) return date;
      } catch {
        // Пропускаем файл, если он изменился во время индексации.
      }
    }
    return null;
  }

  return walk(candidateDirectory);
}

function scanHighlights() {
  const years = [];
  const months = [];

  for (const entry of fs.readdirSync(CONTENT_ROOT, { withFileTypes: true })) {
    if (!entry.isFile() || !IMAGE_RE.test(entry.name)) continue;
    const match = entry.name.match(/^((?:19|20)\d{2})[^\d]*\.(?:jpe?g|png|webp|gif|avif)$/i);
    if (match) {
      const year = Number(match[1]);
      const highlightPath = path.join(CONTENT_ROOT, entry.name);
      years.push({
        year,
        date: findMatchingPhotoDate(highlightPath, path.join(CONTENT_ROOT, String(year))),
        src: photoSource(entry.name),
        thumbnailSrc: previewSource(entry.name)
      });
    }
  }

  for (const entry of fs.readdirSync(CONTENT_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^(?:19|20)\d{2}$/.test(entry.name)) continue;
    const year = Number(entry.name);
    const directory = path.join(CONTENT_ROOT, entry.name);
    for (const image of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!image.isFile() || !IMAGE_RE.test(image.name)) continue;
      const match = image.name.match(/^(0?[1-9]|1[0-2])[^\d]*\.(?:jpe?g|png|webp|gif|avif)$/i);
      if (match) {
        const month = Number(match[1]);
        const highlightPath = path.join(directory, image.name);
        months.push({
          year,
          month,
          date: findMatchingPhotoDate(
            highlightPath,
            path.join(directory, String(month).padStart(2, '0'))
          ),
          src: photoSource(path.join(entry.name, image.name)),
          thumbnailSrc: previewSource(path.join(entry.name, image.name))
        });
      }
    }
  }

  return { years, months };
}

let photos = [];
let highlights = { years: [], months: [] };
let diary = [];
let blurDates = new Set();
let archiveRefreshTimer = null;
let archiveRefreshRunning = false;

function archiveSignature(nextPhotos, nextHighlights, nextDiary) {
  return JSON.stringify([nextPhotos, nextHighlights, nextDiary]);
}

function notifyArchiveUpdated() {
  notifyEvent('archive-updated', Date.now());
}

function notifyBlurDatesUpdated() {
  notifyEvent('blur-dates-updated', sortedBlurDates());
}

async function refreshArchive(operationId = null) {
  if (archiveRefreshRunning) return;
  archiveRefreshRunning = true;
  const currentOperationId = operationId
    || startOperation('Обновляем архив', 'Проверяем новые файлы', 4);
  const previousSignature = archiveSignature(photos, highlights, diary);

  try {
    if (shouldIndexMetadata) {
      updateOperation(currentOperationId, {
        title: sourceMode === 'computer' ? 'Ищем фотографии автоматически' : 'Индексируем папку',
        detail: 'Готовим поиск изображений',
        progress: 2,
        completed: null,
        total: null,
        unit: null,
        etaSeconds: null
      });
      await indexMetadataPhotos(currentOperationId);
      const archiveChanged = archiveSignature(photos, highlights, diary) !== previousSignature;
      finishOperation(
        currentOperationId,
        `Готово: ${photos.length.toLocaleString('ru-RU')} фото по датам съёмки`
      );
      if (archiveChanged) notifyArchiveUpdated();
      return;
    }

    updateOperation(currentOperationId, {
      detail: shouldConvertImages ? 'Проверяем и готовим снимки' : 'Проверяем файлы архива',
      progress: 8,
      completed: null,
      total: null
    });
    const converted = await convertNewImages(({ phase, completed, total, progress }) => {
      updateOperation(currentOperationId, {
        detail: phase === 'conversion' ? 'Конвертируем снимки' : 'Создаём превью',
        progress,
        completed,
        total
      });
    });
    if (!converted) {
      const message = 'Не удалось обработать новые снимки';
      console.error('Архив не обновлён: исходники сохранены для повторной попытки.');
      finishOperation(currentOperationId, '', message);
      return;
    }

    updateOperation(currentOperationId, {
      detail: 'Индексируем фото и записи',
      progress: 86,
      completed: null,
      total: null
    });
    await new Promise((resolve) => setImmediate(resolve));
    const nextPhotos = scanPhotos();
    const nextHighlights = scanHighlights();
    const nextDiary = scanDiary();
    photos = nextPhotos;
    highlights = nextHighlights;
    diary = nextDiary;

    const archiveChanged = archiveSignature(nextPhotos, nextHighlights, nextDiary) !== previousSignature;
    finishOperation(
      currentOperationId,
      archiveChanged
        ? `Готово: ${photos.length.toLocaleString('ru-RU')} фото, ${diary.length.toLocaleString('ru-RU')} записей`
        : 'Архив уже актуален'
    );
    if (archiveChanged) {
      console.log(`Архив обновлён. Фотографий: ${photos.length}, записей: ${diary.length}`);
      notifyArchiveUpdated();
    }
  } catch (error) {
    console.error(`Не удалось обновить архив: ${error.message}`);
    finishOperation(currentOperationId, '', `Ошибка обновления: ${error.message}`);
  } finally {
    archiveRefreshRunning = false;
  }
}

function scheduleArchiveRefresh() {
  clearTimeout(archiveRefreshTimer);
  const operationId = activeOperation?.status === 'running'
    ? activeOperation.id
    : startOperation('Обновляем архив', 'Обнаружены изменения', 2);
  archiveRefreshTimer = setTimeout(() => refreshArchive(operationId), 1500);
}

function watchArchive() {
  if (sourceMode !== 'folder') return null;
  let watcher;
  try {
    watcher = fs.watch(CONTENT_ROOT, { recursive: true }, (_eventType, filename) => {
      const normalizedFilename = filename?.split(path.sep).join('/');
      if (
        !normalizedFilename
        || normalizedFilename.includes('.tmp.')
        || normalizedFilename.includes('.orientation-raw.')
        || normalizedFilename.includes('.orientation-fixed.')
        || (!WATCHED_IMAGE_RE.test(normalizedFilename) && !/^_diary\/[^/]+\.md$/i.test(normalizedFilename))
      ) return;
      if (archiveRefreshRunning) return;
      scheduleArchiveRefresh();
    });
  } catch (error) {
    console.error(`Не удалось наблюдать за архивом: ${error.message}`);
    return null;
  }
  watcher.on('error', (error) => console.error(`Ошибка наблюдения за архивом: ${error.message}`));
  return watcher;
}

function loadArchive({ notify = false } = {}) {
  const previousSignature = archiveSignature(photos, highlights, diary);
  const nextPhotos = scanPhotos();
  const nextHighlights = scanHighlights();
  const nextDiary = scanDiary();
  photos = nextPhotos;
  highlights = nextHighlights;
  diary = nextDiary;
  const changed = archiveSignature(nextPhotos, nextHighlights, nextDiary) !== previousSignature;
  if (notify && changed) {
    notifyArchiveUpdated();
  }
  return changed;
}

async function switchContentSource({ mode = 'folder', roots = [] } = {}) {
  if (!['folder', 'computer'].includes(mode)) throw new Error('Неизвестный режим поиска');
  const absoluteRoots = [...new Set(roots.map((root) => path.resolve(root)))];
  if (!absoluteRoots.length) throw new Error('Не указано, где искать фотографии');
  for (const root of absoluteRoots) {
    const stats = fs.statSync(root);
    if (!stats.isDirectory()) throw new Error(`Путь не является папкой: ${root}`);
  }

  const operationId = startOperation(
    mode === 'computer' ? 'Ищем фотографии автоматически' : 'Индексируем папку',
    'Проверяем доступ к файлам',
    2
  );
  const previousState = {
    contentRoot: CONTENT_ROOT,
    sourceMode,
    sourceRoots: [...sourceRoots],
    photos,
    highlights,
    diary,
    indexedPhotoFiles: new Map(indexedPhotoFiles)
  };
  clearTimeout(archiveRefreshTimer);
  archiveWatcher?.close();
  archiveWatcher = null;
  try {
    configurePaths({
      contentRoot: mode === 'folder' ? absoluteRoots[0] : undefined,
      mode,
      roots: absoluteRoots
    });
    const previousSignature = archiveSignature(photos, highlights, diary);
    if (shouldIndexMetadata) {
      await indexMetadataPhotos(operationId);
    } else {
      updateOperation(operationId, { detail: 'Читаем содержимое папки', progress: 38 });
      if (!await convertNewImages(({ phase, completed, total, progress }) => {
        updateOperation(operationId, {
          detail: phase === 'conversion' ? 'Конвертируем снимки' : 'Создаём превью',
          progress,
          completed,
          total,
          unit: 'фото'
        });
      })) throw new Error('Не удалось обработать новые изображения');
      updateOperation(operationId, { detail: 'Собираем календарь', progress: 86, completed: null, total: null });
      await new Promise((resolve) => setImmediate(resolve));
      loadArchive();
    }
    archiveWatcher = watchArchive();
    const changed = archiveSignature(photos, highlights, diary) !== previousSignature;
    finishOperation(
      operationId,
      `Готово: ${photos.length.toLocaleString('ru-RU')} фото, ${diary.length.toLocaleString('ru-RU')} записей`
    );
    if (changed) notifyArchiveUpdated();
  } catch (error) {
    configurePaths({
      contentRoot: previousState.contentRoot,
      mode: previousState.sourceMode,
      roots: previousState.sourceRoots
    });
    photos = previousState.photos;
    highlights = previousState.highlights;
    diary = previousState.diary;
    indexedPhotoFiles.clear();
    for (const [id, filePath] of previousState.indexedPhotoFiles) indexedPhotoFiles.set(id, filePath);
    archiveWatcher = watchArchive();
    finishOperation(operationId, '', `Не удалось проиндексировать изображения: ${error.message}`);
    throw error;
  }
  return {
    contentRoot: CONTENT_ROOT,
    mode: sourceMode,
    roots: [...sourceRoots],
    photos: photos.length,
    diary: diary.length
  };
}

function switchArchiveRoot(nextRoot) {
  return switchContentSource({ mode: 'folder', roots: [nextRoot] });
}

function sendFile(response, filePath, { cacheControl = 'no-cache' } = {}) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif'
  };

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[extension] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': cacheControl
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function indexedPreviewCachePath(id, version) {
  return path.join(INDEXED_PREVIEW_ROOT, id.slice(0, 2), id, `${version}.jpg`);
}

async function removeOldIndexedPreviews(currentPath) {
  const directory = path.dirname(currentPath);
  let entries;
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (!entry.isFile() || entryPath === currentPath || !entry.name.endsWith('.jpg')) return;
    await fs.promises.unlink(entryPath).catch(() => {});
  }));
}

async function ensureIndexedPreview(id, indexedPhoto) {
  const sourceStats = await fs.promises.stat(indexedPhoto.filePath);
  if (!sourceStats.isFile()) throw new Error('Оригинал фотографии больше не существует');
  const currentVersion = `${Math.trunc(sourceStats.mtimeMs)}-${sourceStats.size}`;
  const cachePath = indexedPreviewCachePath(id, currentVersion);
  try {
    const stats = await fs.promises.stat(cachePath);
    if (stats.isFile() && stats.size > 0) return cachePath;
  } catch {
    // Превью ещё не создано.
  }

  let job = indexedPreviewJobs.get(cachePath);
  if (!job) {
    job = indexedPreviewGenerator(indexedPhoto.filePath, cachePath)
      .then(async () => {
        const stats = await fs.promises.stat(cachePath);
        if (!stats.isFile() || stats.size === 0) throw new Error('Создано пустое превью');
        await removeOldIndexedPreviews(cachePath);
        return cachePath;
      })
      .finally(() => indexedPreviewJobs.delete(cachePath));
    indexedPreviewJobs.set(cachePath, job);
  }
  return job;
}

async function sendIndexedPreview(response, id, indexedPhoto) {
  if (!indexedPreviewGenerator) {
    sendFile(response, indexedPhoto.filePath);
    return;
  }
  try {
    const previewPath = await ensureIndexedPreview(id, indexedPhoto);
    sendFile(response, previewPath, { cacheControl: 'public, max-age=31536000, immutable' });
  } catch (error) {
    console.error(`Не удалось создать превью для ${indexedPhoto.filePath}: ${error.message}`);
    sendFile(response, indexedPhoto.filePath);
  }
}

function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/api/server-version') {
    response.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    response.end(SERVER_VERSION);
    return;
  }

  if (requestUrl.pathname === '/api/photos') {
    sendJson(response, 200, photos);
    return;
  }

  if (requestUrl.pathname === '/api/diary') {
    sendJson(response, 200, diary);
    return;
  }

  if (requestUrl.pathname === '/api/highlights') {
    sendJson(response, 200, highlights);
    return;
  }

  if (requestUrl.pathname === '/api/photo-selections' && request.method === 'GET') {
    sendJson(response, 200, serializedPhotoSelections());
    return;
  }

  if (requestUrl.pathname.startsWith('/api/photo-selections/') && request.method === 'PUT') {
    let date;
    try {
      date = decodeURIComponent(requestUrl.pathname.slice('/api/photo-selections/'.length));
    } catch {
      sendJson(response, 400, { error: 'Неверная дата' });
      return;
    }
    if (!isValidDateKey(date)) {
      sendJson(response, 400, { error: 'Дата должна быть в формате ГГГГ-ММ-ДД' });
      return;
    }

    let body = '';
    let bodyTooLarge = false;
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      if (bodyTooLarge) return;
      body += chunk;
      if (body.length > 1024) bodyTooLarge = true;
    });
    request.on('end', () => {
      if (bodyTooLarge) {
        sendJson(response, 413, { error: 'Слишком большой запрос' });
        return;
      }
      let photoId;
      try {
        photoId = JSON.parse(body).photoId;
      } catch {
        sendJson(response, 400, { error: 'Неверный JSON' });
        return;
      }
      const selectedPhoto = photos.find((photo) => photo.date === date && photo.id === photoId);
      if (!selectedPhoto) {
        sendJson(response, 400, { error: 'Выбранное фото не относится к этой дате' });
        return;
      }

      const previousPhotoId = photoSelections.get(date);
      photoSelections.set(date, photoId);
      try {
        writePhotoSelections();
      } catch (error) {
        if (previousPhotoId) photoSelections.set(date, previousPhotoId);
        else photoSelections.delete(date);
        console.error(`Не удалось сохранить фото дня: ${error.message}`);
        sendJson(response, 500, { error: 'Не удалось сохранить выбор' });
        return;
      }
      const value = { date, photoId };
      notifyEvent('photo-selection-updated', value);
      sendJson(response, 200, value);
    });
    return;
  }

  if (requestUrl.pathname === '/api/blur-dates' && request.method === 'GET') {
    sendJson(response, 200, sortedBlurDates());
    return;
  }

  if (requestUrl.pathname.startsWith('/api/blur-dates/') && request.method === 'PUT') {
    let date;
    try {
      date = decodeURIComponent(requestUrl.pathname.slice('/api/blur-dates/'.length));
    } catch {
      sendJson(response, 400, { error: 'Неверная дата' });
      return;
    }
    if (!isValidDateKey(date)) {
      sendJson(response, 400, { error: 'Дата должна быть в формате ГГГГ-ММ-ДД' });
      return;
    }

    let body = '';
    let bodyTooLarge = false;
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      if (bodyTooLarge) return;
      body += chunk;
      if (body.length > 1024) bodyTooLarge = true;
    });
    request.on('end', () => {
      if (bodyTooLarge) {
        sendJson(response, 413, { error: 'Слишком большой запрос' });
        return;
      }
      let blurred;
      try {
        blurred = JSON.parse(body).blurred;
      } catch {
        sendJson(response, 400, { error: 'Неверный JSON' });
        return;
      }
      if (typeof blurred !== 'boolean') {
        sendJson(response, 400, { error: 'Поле blurred должно быть boolean' });
        return;
      }

      const previousBlurDates = new Set(blurDates);
      if (blurred) blurDates.add(date);
      else blurDates.delete(date);
      try {
        writeBlurDates();
      } catch (error) {
        blurDates = previousBlurDates;
        console.error(`Не удалось сохранить даты блюра: ${error.message}`);
        sendJson(response, 500, { error: 'Не удалось сохранить список' });
        return;
      }
      notifyBlurDatesUpdated();
      sendJson(response, 200, sortedBlurDates());
    });
    return;
  }

  if (requestUrl.pathname === '/api/events') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    response.write('retry: 2000\n\n');
    if (activeOperation) {
      response.write(`event: background-operation\ndata: ${JSON.stringify(activeOperation)}\n\n`);
    }
    updateClients.add(response);
    request.on('close', () => updateClients.delete(response));
    return;
  }

  if (requestUrl.pathname.startsWith('/indexed-preview/')) {
    const id = requestUrl.pathname.slice('/indexed-preview/'.length);
    const indexedPhoto = indexedPhotoFiles.get(id);
    if (!/^[a-f0-9]{32}$/.test(id) || !indexedPhoto || !IMAGE_RE.test(indexedPhoto.filePath)) {
      response.writeHead(404).end('Not found');
      return;
    }
    void sendIndexedPreview(response, id, indexedPhoto);
    return;
  }

  if (requestUrl.pathname.startsWith('/indexed-photo/')) {
    const id = requestUrl.pathname.slice('/indexed-photo/'.length);
    const indexedPhoto = indexedPhotoFiles.get(id);
    if (!/^[a-f0-9]{32}$/.test(id) || !indexedPhoto || !IMAGE_RE.test(indexedPhoto.filePath)) {
      response.writeHead(404).end('Not found');
      return;
    }
    sendFile(response, indexedPhoto.filePath);
    return;
  }

  if (requestUrl.pathname.startsWith('/photo/')) {
    const encodedPath = requestUrl.pathname.slice('/photo/'.length);
    let relativePath;
    try {
      relativePath = encodedPath.split('/').map(decodeURIComponent).join(path.sep);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }
    const filePath = path.resolve(CONTENT_ROOT, relativePath);
    if (!filePath.startsWith(`${CONTENT_ROOT}${path.sep}`) || !IMAGE_RE.test(filePath)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    sendFile(response, filePath);
    return;
  }

  if (requestUrl.pathname.startsWith('/preview/')) {
    const encodedPath = requestUrl.pathname.slice('/preview/'.length);
    let relativePath;
    try {
      relativePath = encodedPath.split('/').map(decodeURIComponent).join(path.sep);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }
    const filePath = path.resolve(PREVIEW_ROOT, relativePath);
    if (!filePath.startsWith(`${PREVIEW_ROOT}${path.sep}`) || !IMAGE_RE.test(filePath)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    sendFile(response, filePath);
    return;
  }

  const pathname = requestUrl.pathname === '/' ? '/app.html' : requestUrl.pathname;
  if (UI_FILES.has(pathname)) {
    sendFile(response, path.join(RENDERER_ROOT, UI_FILES.get(pathname)));
    return;
  }

  response.writeHead(404).end('Not found');
}

async function startPhotoDayServer(options = {}) {
  configurePaths(options);
  shouldConvertImages = options.convertImages ?? shouldConvertImages;
  fs.mkdirSync(CONTENT_ROOT, { recursive: true });
  fs.mkdirSync(STATE_ROOT, { recursive: true });

  hasLoadedIndexCache = false;
  if (shouldIndexMetadata) {
    if (!loadIndexCache()) {
      photos = [];
      highlights = { years: [], months: [] };
      indexedPhotoFiles.clear();
    }
    diary = sourceMode === 'folder' ? scanDiary() : [];
  } else {
    if (!await convertNewImages()) {
      throw new Error('Сервер не запущен: проверьте ошибку конвертации.');
    }
    loadArchive();
  }
  blurDates = readBlurDates();
  photoSelections = readPhotoSelections();

  const server = http.createServer(handleRequest);
  const port = options.port ?? PORT;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  console.log(`Фото дня: ${url}`);
  console.log(`Проиндексировано фотографий: ${photos.length}`);
  console.log(`Проиндексировано записей: ${diary.length}`);
  archiveWatcher = watchArchive();

  const keepAliveTimer = setInterval(() => {
    for (const client of updateClients) client.write(': keep-alive\n\n');
  }, 25000);
  keepAliveTimer.unref();

  return {
    url,
    get contentRoot() { return CONTENT_ROOT; },
    get hasCachedIndex() { return hasLoadedIndexCache; },
    setContentRoot: switchArchiveRoot,
    setContentSource: switchContentSource,
    reindex: () => refreshArchive(),
    close: () => new Promise((resolve, reject) => {
      clearInterval(keepAliveTimer);
      clearTimeout(archiveRefreshTimer);
      archiveWatcher?.close();
      archiveWatcher = null;
      for (const client of updateClients) client.end();
      updateClients.clear();
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

module.exports = { startPhotoDayServer };

if (require.main === module) {
  startPhotoDayServer().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
