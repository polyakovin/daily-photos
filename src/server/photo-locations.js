const fs = require('fs');

const PHOTO_ID_RE = /^[a-f0-9]{32}$/;
const PHOTO_PATH_RE = /\.(?:avif|gif|heic|heif|jpe?g|png|webp)$/i;
const PHOTO_LOCATION_DOCUMENT_VERSION = 1;
const LOCATION_SOURCES = new Set([
  'manual',
  'photo',
  'home-office',
  'organic-maps',
  'home-office+organic-maps'
]);

function normalizeCoordinates(value) {
  if (
    value?.latitude === null
    || value?.latitude === undefined
    || value?.latitude === ''
    || value?.longitude === null
    || value?.longitude === undefined
    || value?.longitude === ''
  ) return null;
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) return null;
  return { latitude, longitude };
}

function normalizeLocationKey(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (PHOTO_ID_RE.test(value)) return value;
  const key = value.trim().replaceAll('\\', '/').replace(/^\.\/+/, '');
  if (
    !key
    || key.startsWith('/')
    || /^[a-z]:\//i.test(key)
    || !PHOTO_PATH_RE.test(key)
    || key.split('/').some((part) => !part || part === '.' || part === '..')
  ) return null;
  return key;
}

function optionalText(value, maximumLength = 240) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maximumLength) : null;
}

function normalizeLocationRecord(value) {
  if (value?.hidden === true) return { hidden: true };
  const coordinates = normalizeCoordinates(value);
  if (!coordinates) return null;
  const result = { ...coordinates };
  const source = optionalText(value?.source, 48);
  const place = optionalText(value?.place);
  const country = optionalText(value?.country, 120);
  const confidence = optionalText(value?.confidence, 48);
  const observedAt = optionalText(value?.observedAt, 32);
  const referenceId = optionalText(value?.referenceId, 128);
  if (source && LOCATION_SOURCES.has(source)) result.source = source;
  if (place) result.place = place;
  if (country) result.country = country;
  if (confidence) result.confidence = confidence;
  if (referenceId) result.referenceId = referenceId;
  if (/^(?:19|20)\d{2}-\d{2}-\d{2}$/.test(observedAt || '')) {
    result.observedAt = observedAt;
  }
  return result;
}

function attachDocumentMetadata(locations, value) {
  Object.defineProperty(locations, 'documentMetadata', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: {
      generatedAt: optionalText(value?.generatedAt, 64),
      sources: Array.isArray(value?.sources)
        ? value.sources.map((source) => optionalText(source, 160)).filter(Boolean).slice(0, 16)
        : []
    }
  });
  return locations;
}

function readPhotoLocations(filePath) {
  try {
    const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw new Error('ожидался объект');
    }
    const values = document.version === PHOTO_LOCATION_DOCUMENT_VERSION
      ? document.photos
      : document;
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error('ожидался объект с фотографиями');
    }
    return attachDocumentMetadata(new Map(Object.entries(values).flatMap(([key, value]) => {
      const normalizedKey = normalizeLocationKey(key);
      const location = normalizeLocationRecord(value);
      return normalizedKey && location ? [[normalizedKey, location]] : [];
    })), document);
  } catch (error) {
    if (error.code === 'ENOENT') return attachDocumentMetadata(new Map(), {});
    console.error(`Не удалось прочитать геометки фотографий: ${error.message}`);
    return attachDocumentMetadata(new Map(), {});
  }
}

function serializePhotoLocations(locations) {
  const metadata = locations?.documentMetadata || {};
  const document = {
    version: PHOTO_LOCATION_DOCUMENT_VERSION,
    photos: Object.fromEntries(
      [...locations.entries()]
        .map(([key, value]) => [normalizeLocationKey(key), normalizeLocationRecord(value)])
        .filter(([key, value]) => key && value)
        .sort(([a], [b]) => a.localeCompare(b))
    )
  };
  if (metadata.generatedAt) document.generatedAt = metadata.generatedAt;
  if (metadata.sources?.length) document.sources = [...metadata.sources];
  return document;
}

function writePhotoLocations(filePath, locations) {
  const temporaryFile = `${filePath}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(serializePhotoLocations(locations), null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryFile, filePath);
}

module.exports = {
  LOCATION_SOURCES,
  PHOTO_LOCATION_DOCUMENT_VERSION,
  PHOTO_ID_RE,
  normalizeCoordinates,
  normalizeLocationKey,
  normalizeLocationRecord,
  readPhotoLocations,
  serializePhotoLocations,
  writePhotoLocations
};
