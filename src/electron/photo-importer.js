const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const {
  archiveDestination,
  detectArchiveStyle,
  normalizeArchiveStyle,
  safePhotoStem
} = require('./photo-archive-style');
const {
  importOverrideKey,
  readPhotoImportConfig,
  writePhotoImportConfig
} = require('../server/import-date-overrides');

const STANDARD_IMAGE_RE = /\.(?:jpe?g|png|webp|gif|avif)$/i;
const CONVERTIBLE_IMAGE_RE = /\.(?:heic|heif)$/i;
const DATE_KEY_RE = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const MAX_IMPORT_FILES = 100;
const runConversionCommand = promisify(execFile);

function isValidImportDate(value, today = new Date()) {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(year, month - 1, day);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return candidate.getFullYear() === year
    && candidate.getMonth() === month - 1
    && candidate.getDate() === day
    && candidate.getTime() <= todayStart.getTime();
}

function importableImage(filePath) {
  return STANDARD_IMAGE_RE.test(filePath)
    || CONVERTIBLE_IMAGE_RE.test(filePath);
}

async function validateSources(filePaths) {
  if (!Array.isArray(filePaths) || !filePaths.length) {
    throw new Error('Перетащите хотя бы одну фотографию');
  }
  if (filePaths.length > MAX_IMPORT_FILES) {
    throw new Error(`За один раз можно добавить не больше ${MAX_IMPORT_FILES} фотографий`);
  }

  const sources = [...new Set(filePaths)];
  if (sources.length !== filePaths.length) {
    throw new Error('Список фотографий содержит повторяющиеся файлы');
  }

  for (const sourcePath of sources) {
    if (typeof sourcePath !== 'string' || !sourcePath || sourcePath.length > 4096) {
      throw new Error('Не удалось прочитать путь к фотографии');
    }
    if (!importableImage(sourcePath)) {
      throw new Error(`Формат файла «${path.basename(sourcePath)}» не поддерживается`);
    }
    const stats = await fs.promises.stat(sourcePath);
    if (!stats.isFile()) throw new Error(`«${path.basename(sourcePath)}» не является файлом`);
  }
  return sources;
}

async function convertPhotoForImport(sourcePath, destinationPath, {
  runCommand = runConversionCommand
} = {}) {
  const decodedPath = `${destinationPath}.png`;
  const options = {
    timeout: 120_000,
    env: {
      ...process.env,
      PATH: ['/opt/homebrew/bin', '/usr/local/bin', process.env.PATH || ''].join(path.delimiter)
    }
  };
  try {
    await runCommand('heif-convert', [sourcePath, decodedPath], options);
    await runCommand('cwebp', ['-quiet', '-q', '85', '-metadata', 'all', decodedPath, '-o', destinationPath], options);
    await runCommand('exiftool', [
      '-overwrite_original', '-TagsFromFile', sourcePath, '-all:all',
      '-IFD0:Orientation=', '-IFD1:Orientation=', '-XMP-tiff:Orientation=',
      '-IFD0:Orientation#=1', destinationPath
    ], options);
    await runCommand('webpinfo', ['-quiet', destinationPath], options);
  } catch (error) {
    const detail = error.code === 'ENOENT'
      ? 'Для конвертации нужны heif-convert, cwebp, exiftool и webpinfo'
      : String(error.stderr || error.message).trim();
    throw new Error(`Не удалось конвертировать «${path.basename(sourcePath)}»: ${detail}`, { cause: error });
  } finally {
    await fs.promises.unlink(decodedPath).catch(() => {});
  }
}

async function reservedStemsIn(directory) {
  let entries;
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
  return new Set(entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.parse(entry.name).name.toLocaleLowerCase()));
}

async function copyWithUniqueName(sourcePath, destinationDirectory, destinationStem, reservedStems) {
  const extension = path.extname(sourcePath).toLowerCase();

  for (let sequence = 1; sequence <= 9999; sequence += 1) {
    const suffix = sequence === 1 ? '' : ` (${sequence})`;
    const stem = `${destinationStem}${suffix}`;
    if (reservedStems.has(stem.toLocaleLowerCase())) continue;
    const fileName = `${stem}${extension}`;
    const destinationPath = path.join(destinationDirectory, fileName);
    try {
      await fs.promises.copyFile(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
      reservedStems.add(stem.toLocaleLowerCase());
      return destinationPath;
    } catch (error) {
      if (error.code === 'EEXIST') continue;
      try {
        await fs.promises.unlink(destinationPath);
      } catch {}
      throw error;
    }
  }
  throw new Error(`Не удалось подобрать свободное имя для «${path.basename(sourcePath)}»`);
}

async function importPhotoFiles({
  archivePath,
  filePaths,
  date,
  convertImage = convertPhotoForImport
} = {}) {
  if (!isValidImportDate(date)) throw new Error('Выберите корректную дату не позже сегодняшней');

  const archiveStats = await fs.promises.stat(archivePath);
  if (!archiveStats.isDirectory()) throw new Error('Выбранная папка фотографий недоступна');

  const sources = await validateSources(filePaths);
  const config = readPhotoImportConfig(archivePath);
  const configuredStyle = normalizeArchiveStyle(config.style);
  let style = configuredStyle;
  if (!style || style.type === 'year-month-day-name') {
    const detectedStyle = await detectArchiveStyle(archivePath);
    if (!style || detectedStyle.type === 'year-month-day-file') style = detectedStyle;
  }

  const imported = [];
  const directoryStems = new Map();
  let temporaryRoot = '';
  try {
    const preparedSources = [];
    for (const sourcePath of sources) {
      let preparedPath = sourcePath;
      if (CONVERTIBLE_IMAGE_RE.test(sourcePath)) {
        if (!temporaryRoot) {
          temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-conversion-'));
        }
        preparedPath = path.join(temporaryRoot, `${preparedSources.length}.webp`);
        await convertImage(sourcePath, preparedPath);
        const stats = await fs.promises.stat(preparedPath);
        if (!stats.isFile() || stats.size === 0) {
          throw new Error(`Конвертация «${path.basename(sourcePath)}» не создала фотографию`);
        }
      }
      preparedSources.push({ sourcePath, preparedPath });
    }
    for (const { sourcePath, preparedPath } of preparedSources) {
      const destination = archiveDestination(style, date, sourcePath);
      const destinationDirectory = path.join(archivePath, ...destination.directoryParts);
      await fs.promises.mkdir(destinationDirectory, { recursive: true });
      let reservedStems = directoryStems.get(destinationDirectory);
      if (!reservedStems) {
        reservedStems = await reservedStemsIn(destinationDirectory);
        directoryStems.set(destinationDirectory, reservedStems);
      }
      const destinationPath = await copyWithUniqueName(
        preparedPath,
        destinationDirectory,
        destination.stem,
        reservedStems
      );
      imported.push({
        sourcePath,
        destinationPath,
        name: path.basename(destinationPath)
      });
    }
    for (const { destinationPath } of imported) {
      const key = importOverrideKey(archivePath, destinationPath);
      if (!key) throw new Error('Не удалось сохранить выбранную дату фотографии');
      config.overrides.set(key, date);
    }
    writePhotoImportConfig(archivePath, { style, overrides: config.overrides });
  } catch (error) {
    await Promise.all(imported.map(({ destinationPath }) => (
      fs.promises.unlink(destinationPath).catch(() => {})
    )));
    throw error;
  } finally {
    if (temporaryRoot) await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
  }
  return imported;
}

module.exports = {
  CONVERTIBLE_IMAGE_RE,
  DATE_KEY_RE,
  STANDARD_IMAGE_RE,
  convertPhotoForImport,
  importPhotoFiles,
  isValidImportDate,
  safePhotoStem
};
