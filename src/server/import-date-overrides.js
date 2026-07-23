const fs = require('node:fs');
const path = require('node:path');

const PHOTO_IMPORT_CONFIG_FILE_NAME = 'photo_import_config.json';
const DATE_KEY_RE = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function importOverrideKey(archivePath, filePath) {
  const relativePath = path.relative(archivePath, filePath);
  if (
    !relativePath
    || path.isAbsolute(relativePath)
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
  ) return null;
  const extension = path.extname(relativePath);
  return relativePath.slice(0, relativePath.length - extension.length).split(path.sep).join('/');
}

function photoImportConfigFile(archivePath) {
  return path.join(archivePath, PHOTO_IMPORT_CONFIG_FILE_NAME);
}

function readPhotoImportConfig(archivePath) {
  const filePath = photoImportConfigFile(archivePath);
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { style: null, overrides: new Map() };
    throw error;
  }

  const values = payload?.version === 1 && payload.dates && typeof payload.dates === 'object'
    ? payload.dates
    : {};
  const overrides = new Map(Object.entries(values).filter(([key, date]) => (
    typeof key === 'string'
    && key
    && !key.startsWith('/')
    && !key.split('/').includes('..')
    && isValidDateKey(date)
  )));
  const style = payload?.style && typeof payload.style === 'object' && !Array.isArray(payload.style)
    ? payload.style
    : null;
  return { style, overrides };
}

function readImportDateOverrides(archivePath) {
  return readPhotoImportConfig(archivePath).overrides;
}

function writePhotoImportConfig(archivePath, { style = null, overrides = new Map() } = {}) {
  const filePath = photoImportConfigFile(archivePath);
  const temporaryPath = `${filePath}.tmp`;
  const dates = Object.fromEntries([...overrides].sort(([left], [right]) => left.localeCompare(right)));
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify({ version: 1, style, dates }, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    throw error;
  }
}

function writeImportDateOverrides(archivePath, overrides) {
  const { style } = readPhotoImportConfig(archivePath);
  writePhotoImportConfig(archivePath, { style, overrides });
}

function importDateOverrideForFile(overrides, archivePath, filePath) {
  const key = importOverrideKey(archivePath, filePath);
  return key ? overrides.get(key) || null : null;
}

module.exports = {
  PHOTO_IMPORT_CONFIG_FILE_NAME,
  importDateOverrideForFile,
  importOverrideKey,
  isValidDateKey,
  photoImportConfigFile,
  readImportDateOverrides,
  readPhotoImportConfig,
  writeImportDateOverrides,
  writePhotoImportConfig
};
