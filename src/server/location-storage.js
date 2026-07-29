const fs = require('node:fs');
const {
  readLocationReference,
  serializeLocationReference
} = require('./location-reference');
const {
  readPhotoLocations,
  serializePhotoLocations
} = require('./photo-locations');

const LOCATION_DATA_DOCUMENT_VERSION = 2;
const LOCATION_COORDINATE_DIGITS = 5;
const EVIDENCE_PRIORITY = new Map([
  ['manual', 6],
  ['visited', 5],
  ['dated-media', 4],
  ['media', 3],
  ['bookmark', 2],
  ['reference', 1]
]);
const SOURCE_PRIORITY = new Map([
  ['manual', 3],
  ['home-office', 2],
  ['organic-maps', 1]
]);

function referencePlaceInformationScore(place) {
  const scalarFields = [
    'country',
    'source',
    'evidence',
    'observedAt',
    'timestamp',
    'collection'
  ];
  return scalarFields.reduce((score, field) => (
    score + Number(place?.[field] !== undefined && place[field] !== null && place[field] !== '')
  ), 0)
    + Number(Number.isInteger(place?.mediaCount))
    + Number(Array.isArray(place?.visitDates) && place.visitDates.length > 0)
    + Number(Array.isArray(place?.mergedPlaces) && place.mergedPlaces.length > 0);
}

function compareReferencePlaces(left, right) {
  return referencePlaceInformationScore(right) - referencePlaceInformationScore(left)
    || (EVIDENCE_PRIORITY.get(right.evidence) || 0) - (EVIDENCE_PRIORITY.get(left.evidence) || 0)
    || (SOURCE_PRIORITY.get(right.source) || 0) - (SOURCE_PRIORITY.get(left.source) || 0)
    || left.index - right.index
    || left.place.id.localeCompare(right.place.id);
}

function flattenedMergedPlaces(place) {
  const primary = { ...place };
  delete primary.mergedPlaces;
  return [
    primary,
    ...(Array.isArray(place.mergedPlaces) ? place.mergedPlaces : [])
  ];
}

function mergeReferencePlaceGroup(values) {
  const ranked = values
    .map(({ place, index }) => ({ ...place, place, index }))
    .sort(compareReferencePlaces);
  const winner = { ...ranked[0].place };
  const mergedPlaces = [];
  const seenMergedIds = new Set([winner.id]);
  const scalarFields = ['country', 'observedAt', 'timestamp', 'collection'];
  const visitDates = new Set(winner.visitDates || []);
  let mediaCount = Number.isInteger(winner.mediaCount) ? winner.mediaCount : null;

  for (const candidate of ranked) {
    for (const field of scalarFields) {
      if (!winner[field] && candidate.place[field]) winner[field] = candidate.place[field];
    }
    if (Number.isInteger(candidate.place.mediaCount)) {
      mediaCount = Math.max(mediaCount ?? 0, candidate.place.mediaCount);
    }
    for (const date of candidate.place.visitDates || []) visitDates.add(date);
    if (candidate.place.id === winner.id) {
      for (const merged of candidate.place.mergedPlaces || []) {
        if (seenMergedIds.has(merged.id)) continue;
        seenMergedIds.add(merged.id);
        mergedPlaces.push(merged);
      }
      continue;
    }
    for (const merged of flattenedMergedPlaces(candidate.place)) {
      if (seenMergedIds.has(merged.id)) continue;
      seenMergedIds.add(merged.id);
      mergedPlaces.push(merged);
    }
  }

  if (mediaCount !== null) winner.mediaCount = mediaCount;
  if (visitDates.size) winner.visitDates = [...visitDates].sort();
  if (mergedPlaces.length) winner.mergedPlaces = mergedPlaces;
  else delete winner.mergedPlaces;
  return winner;
}

function normalizedReferencePlaces(places) {
  return serializeLocationReference({ version: 1, places }).places;
}

function locationCoordinateKey(place) {
  return `${place.latitude.toFixed(LOCATION_COORDINATE_DIGITS)}:${place.longitude.toFixed(LOCATION_COORDINATE_DIGITS)}`;
}

function consolidateLocationData(locations, places) {
  const normalizedPlaces = normalizedReferencePlaces(places);
  const groups = new Map();
  normalizedPlaces.forEach((place, index) => {
    const key = locationCoordinateKey(place);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ place, index });
  });

  const consolidatedPlaces = [];
  const referenceIdReplacements = new Map();
  for (const values of groups.values()) {
    const winner = mergeReferencePlaceGroup(values);
    consolidatedPlaces.push(winner);
    referenceIdReplacements.set(winner.id, winner.id);
    for (const value of values) {
      referenceIdReplacements.set(value.place.id, winner.id);
      for (const merged of value.place.mergedPlaces || []) {
        referenceIdReplacements.set(merged.id, winner.id);
      }
    }
  }

  let remappedPhotoCount = 0;
  for (const [key, location] of locations) {
    if (!location?.referenceId) continue;
    const replacement = referenceIdReplacements.get(location.referenceId);
    if (!replacement || replacement === location.referenceId) continue;
    locations.set(key, { ...location, referenceId: replacement });
    remappedPhotoCount += 1;
  }

  return {
    places: consolidatedPlaces,
    removedPlaceCount: normalizedPlaces.length - consolidatedPlaces.length,
    remappedPhotoCount
  };
}

function setLocationDocumentMetadata(locations, patch) {
  const current = locations.documentMetadata || {};
  Object.defineProperty(locations, 'documentMetadata', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: {
      ...current,
      ...patch,
      sources: [...(patch.sources || current.sources || [])],
      places: [...(patch.places || current.places || [])]
    }
  });
  return locations;
}

function serializeLocationData(locations) {
  const metadata = locations?.documentMetadata || {};
  const consolidated = consolidateLocationData(locations, metadata.places || []);
  setLocationDocumentMetadata(locations, { places: consolidated.places });
  const photoDocument = serializePhotoLocations(locations);
  const document = {
    version: LOCATION_DATA_DOCUMENT_VERSION,
    photos: photoDocument.photos,
    places: consolidated.places
  };
  if (metadata.generatedAt) document.generatedAt = metadata.generatedAt;
  if (metadata.sources?.length) document.sources = [...metadata.sources];
  return document;
}

function writeLocationData(filePath, locations) {
  const temporaryFile = `${filePath}.tmp`;
  const document = serializeLocationData(locations);
  fs.writeFileSync(temporaryFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryFile, filePath);
  return document;
}

function readJsonDocument(filePath) {
  try {
    return {
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8'))
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false, value: null };
    return { exists: true, value: null, error };
  }
}

function latestGeneratedAt(...values) {
  return values
    .filter((value) => typeof value === 'string' && value.trim())
    .sort()
    .at(-1) || null;
}

function canMigratePhotoDocument(raw) {
  if (!raw.exists) return true;
  if (raw.error || !raw.value || typeof raw.value !== 'object' || Array.isArray(raw.value)) {
    return false;
  }
  if (!raw.value.version) return true;
  return [1, LOCATION_DATA_DOCUMENT_VERSION].includes(raw.value.version)
    && raw.value.photos
    && typeof raw.value.photos === 'object'
    && !Array.isArray(raw.value.photos);
}

function readLegacyReference(filePath) {
  const raw = readJsonDocument(filePath);
  if (!raw.exists || raw.error) return { ...raw, document: null };
  if (raw.value?.version !== 1 || !Array.isArray(raw.value.places)) {
    return {
      ...raw,
      document: null,
      error: new Error('ожидался справочник мест версии 1')
    };
  }
  return {
    ...raw,
    document: readLocationReference(filePath)
  };
}

function readLocationData(filePath, legacyReferenceFile = '', { migrate = true } = {}) {
  const rawPhotoDocument = readJsonDocument(filePath);
  const locations = readPhotoLocations(filePath);
  const embeddedPlaces = Array.isArray(rawPhotoDocument.value?.places)
    ? rawPhotoDocument.value.places
    : [];
  const legacy = legacyReferenceFile
    ? readLegacyReference(legacyReferenceFile)
    : { exists: false, document: null };
  if (legacy.error) {
    console.error(`Не удалось перенести старый справочник мест: ${legacy.error.message}`);
  }

  const places = [
    ...embeddedPlaces,
    ...(legacy.document?.places || [])
  ];
  const consolidated = consolidateLocationData(locations, places);
  const generatedAt = latestGeneratedAt(
    locations.documentMetadata?.generatedAt,
    rawPhotoDocument.value?.generatedAt,
    legacy.document?.generatedAt
  );
  setLocationDocumentMetadata(locations, {
    generatedAt,
    sources: locations.documentMetadata?.sources || rawPhotoDocument.value?.sources || [],
    places: consolidated.places
  });

  const shouldWrite = (
    rawPhotoDocument.exists
    && rawPhotoDocument.value
    && rawPhotoDocument.value.version !== LOCATION_DATA_DOCUMENT_VERSION
  )
    || Boolean(legacy.document)
    || consolidated.removedPlaceCount > 0
    || consolidated.remappedPhotoCount > 0;
  if (migrate && shouldWrite && canMigratePhotoDocument(rawPhotoDocument)) {
    writeLocationData(filePath, locations);
    if (legacy.document) {
      try {
        fs.unlinkSync(legacyReferenceFile);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`Не удалось удалить перенесённый справочник мест: ${error.message}`);
        }
      }
    }
  }
  return locations;
}

function locationReferenceDocument(locations) {
  const metadata = locations?.documentMetadata || {};
  const document = {
    version: 1,
    places: normalizedReferencePlaces(metadata.places || [])
  };
  if (metadata.generatedAt) document.generatedAt = metadata.generatedAt;
  return document;
}

function replaceLocationReferencePlaces(locations, places, generatedAt = new Date().toISOString()) {
  const consolidated = consolidateLocationData(locations, places);
  setLocationDocumentMetadata(locations, {
    generatedAt,
    places: consolidated.places
  });
  return consolidated;
}

module.exports = {
  LOCATION_DATA_DOCUMENT_VERSION,
  consolidateLocationData,
  locationReferenceDocument,
  readLocationData,
  referencePlaceInformationScore,
  replaceLocationReferencePlaces,
  serializeLocationData,
  setLocationDocumentMetadata,
  writeLocationData
};
