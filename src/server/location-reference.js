const fs = require('fs');
const { normalizeCoordinates } = require('./photo-locations');

const LOCATION_REFERENCE_DOCUMENT_VERSION = 1;
const LOCATION_REFERENCE_SOURCES = new Set(['home-office', 'organic-maps', 'manual']);
const LOCATION_REFERENCE_EVIDENCE = new Set([
  'visited',
  'dated-media',
  'media',
  'reference',
  'bookmark',
  'manual'
]);
const DATE_RE = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function optionalText(value, maximumLength = 240) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maximumLength) : null;
}

function normalizeReferencePlaceFields(value) {
  const coordinates = normalizeCoordinates(value);
  const id = optionalText(value?.id, 128);
  const name = optionalText(value?.name);
  if (!coordinates || !id || !name) return null;

  const result = { id, name, ...coordinates };
  const country = optionalText(value?.country, 120);
  const source = optionalText(value?.source, 48);
  const evidence = optionalText(value?.evidence, 48);
  const observedAt = optionalText(value?.observedAt, 32);
  const timestamp = optionalText(value?.timestamp, 64);
  const collection = optionalText(value?.collection, 160);
  const mediaCount = Number(value?.mediaCount);
  const visitDates = Array.isArray(value?.visitDates)
    ? [...new Set(value.visitDates.filter((date) => DATE_RE.test(date)))].sort().slice(0, 500)
    : [];

  if (country) result.country = country;
  if (source && LOCATION_REFERENCE_SOURCES.has(source)) result.source = source;
  if (evidence && LOCATION_REFERENCE_EVIDENCE.has(evidence)) result.evidence = evidence;
  if (DATE_RE.test(observedAt || '')) result.observedAt = observedAt;
  if (timestamp) result.timestamp = timestamp;
  if (collection) result.collection = collection;
  if (Number.isInteger(mediaCount) && mediaCount >= 0) result.mediaCount = mediaCount;
  if (visitDates.length) result.visitDates = visitDates;
  return result;
}

function normalizeReferencePlace(value) {
  const result = normalizeReferencePlaceFields(value);
  if (!result) return null;
  const mergedPlaces = (Array.isArray(value?.mergedPlaces) ? value.mergedPlaces : [])
    .map(normalizeReferencePlaceFields)
    .filter((place) => place && place.id !== result.id)
    .filter((place, index, places) => (
      places.findIndex((candidate) => candidate.id === place.id) === index
    ))
    .slice(0, 500);
  if (mergedPlaces.length) result.mergedPlaces = mergedPlaces;
  return result;
}

function emptyLocationReference() {
  return { version: LOCATION_REFERENCE_DOCUMENT_VERSION, places: [] };
}

function readLocationReference(filePath) {
  try {
    const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (
      document?.version !== LOCATION_REFERENCE_DOCUMENT_VERSION
      || !Array.isArray(document.places)
    ) {
      throw new Error('ожидался справочник мест версии 1');
    }
    const places = document.places
      .map(normalizeReferencePlace)
      .filter(Boolean);
    const result = {
      version: LOCATION_REFERENCE_DOCUMENT_VERSION,
      places
    };
    const generatedAt = optionalText(document.generatedAt, 64);
    if (generatedAt) result.generatedAt = generatedAt;
    return result;
  } catch (error) {
    if (error.code === 'ENOENT') return emptyLocationReference();
    console.error(`Не удалось прочитать справочник мест: ${error.message}`);
    return emptyLocationReference();
  }
}

function serializeLocationReference(value) {
  const places = (Array.isArray(value?.places) ? value.places : [])
    .map(normalizeReferencePlace)
    .filter(Boolean);
  const document = {
    version: LOCATION_REFERENCE_DOCUMENT_VERSION,
    places
  };
  const generatedAt = optionalText(value?.generatedAt, 64);
  if (generatedAt) document.generatedAt = generatedAt;
  return document;
}

function writeLocationReference(filePath, value) {
  const temporaryFile = `${filePath}.tmp`;
  const document = serializeLocationReference(value);
  fs.writeFileSync(temporaryFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryFile, filePath);
  return document;
}

module.exports = {
  LOCATION_REFERENCE_DOCUMENT_VERSION,
  LOCATION_REFERENCE_EVIDENCE,
  LOCATION_REFERENCE_SOURCES,
  normalizeReferencePlace,
  readLocationReference,
  serializeLocationReference,
  writeLocationReference
};
