#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  normalizeLocationKey,
  readPhotoLocations,
  serializePhotoLocations
} = require('../src/server/photo-locations');

const DATE_RE = /^(?:19|20)\d{2}-\d{2}-\d{2}$/;

function parseArguments(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument === '--include-single-kml-dates') {
      options.includeSingleKmlDates = true;
      continue;
    }
    if (!argument.startsWith('--') || index === values.length - 1) {
      throw new Error(`Неизвестный аргумент: ${argument}`);
    }
    options[argument.slice(2)] = values[index + 1];
    index += 1;
  }
  return options;
}

function yamlScalar(value) {
  const source = String(value || '').trim();
  if (!source || source === 'null' || source === '~') return null;
  if (source === 'true') return true;
  if (source === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(source)) return Number(source);
  if (source.startsWith('"') && source.endsWith('"')) {
    try {
      return JSON.parse(source);
    } catch {
      return source.slice(1, -1);
    }
  }
  if (source.startsWith("'") && source.endsWith("'")) {
    return source.slice(1, -1).replaceAll("''", "'");
  }
  return source;
}

function parseHomeOfficeLocations(source) {
  const locations = [];
  let current = null;
  let section = '';

  function finishCurrent() {
    if (!current) return;
    if (current.coordinates.length >= 2) {
      current.latitude = Number(current.coordinates[0]);
      current.longitude = Number(current.coordinates[1]);
    }
    delete current.coordinates;
    locations.push(current);
  }

  for (const line of String(source).split(/\r?\n/)) {
    const locationStart = line.match(/^  - name:\s*(.+)$/);
    if (locationStart) {
      finishCurrent();
      current = {
        name: yamlScalar(locationStart[1]),
        country: null,
        note: null,
        visited: false,
        coordinates: [],
        media: []
      };
      section = '';
      continue;
    }
    if (!current) continue;

    const field = line.match(/^    ([a-z_]+):(?:\s*(.*))?$/i);
    if (field) {
      const [, key, rawValue = ''] = field;
      section = key;
      if (['country', 'note', 'visited'].includes(key)) current[key] = yamlScalar(rawValue);
      continue;
    }
    if (section === 'location') {
      const coordinate = line.match(/^      -\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (coordinate) current.coordinates.push(Number(coordinate[1]));
    } else if (section === 'media') {
      const mediaName = line.match(/^      - name:\s*(.+)$/);
      if (mediaName) current.media.push(yamlScalar(mediaName[1]));
    }
  }
  finishCurrent();
  return locations.filter((location) => (
    Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && location.longitude >= -180
    && location.longitude <= 180
  ));
}

function mediaDate(mediaName) {
  const match = String(mediaName || '').match(/^((?:19|20)\d{2}-\d{2}-\d{2})(?:\D|$)/);
  return match && DATE_RE.test(match[1]) ? match[1] : null;
}

function homeOfficeDateCandidates(locations) {
  const result = new Map();
  for (const location of locations) {
    for (const media of location.media) {
      const date = mediaDate(media);
      if (!date) continue;
      if (!result.has(date)) result.set(date, []);
      result.get(date).push({
        name: location.name,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        note: location.note,
        media
      });
    }
  }
  for (const [date, candidates] of result) {
    const unique = new Map();
    for (const candidate of candidates) {
      const key = [
        candidate.name,
        candidate.latitude.toFixed(6),
        candidate.longitude.toFixed(6)
      ].join('|');
      if (!unique.has(key)) unique.set(key, candidate);
    }
    result.set(date, [...unique.values()]);
  }
  return result;
}

function decodeXml(value) {
  return String(value || '')
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&#(\d+);/g, (_match, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, number) => String.fromCodePoint(parseInt(number, 16)))
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .trim();
}

function tagValue(source, tagName) {
  const match = String(source).match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXml(match[1]) : null;
}

function parseKmlPlacemarks(source, collection = '') {
  const places = [];
  for (const match of String(source).matchAll(/<Placemark(?:\s[^>]*)?>([\s\S]*?)<\/Placemark>/gi)) {
    const placemark = match[1];
    const point = placemark.match(/<Point(?:\s[^>]*)?>[\s\S]*?<coordinates>([^<]+)<\/coordinates>[\s\S]*?<\/Point>/i);
    if (!point) continue;
    const [longitude, latitude] = decodeXml(point[1]).split(',').map(Number);
    if (
      !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || latitude < -90
      || latitude > 90
      || longitude < -180
      || longitude > 180
    ) continue;
    const when = tagValue(placemark, 'when');
    places.push({
      name: tagValue(placemark, 'name') || 'Место без названия',
      latitude,
      longitude,
      observedAt: when && DATE_RE.test(when.slice(0, 10)) ? when.slice(0, 10) : null,
      timestamp: when,
      collection
    });
  }
  return places;
}

function readOrganicMapsKmz(filePath) {
  const entries = execFileSync('unzip', ['-Z1', filePath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  }).split(/\r?\n/).filter((entry) => /^files\/.*\.kml$/i.test(entry));
  const places = entries.flatMap((entry) => {
    const source = execFileSync('unzip', ['-p', filePath, entry], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024
    });
    return parseKmlPlacemarks(source, path.basename(entry, path.extname(entry)));
  });
  const unique = new Map();
  for (const place of places) {
    const key = [
      normalizeName(place.name),
      place.latitude.toFixed(6),
      place.longitude.toFixed(6),
      place.timestamp || ''
    ].join('|');
    if (!unique.has(key)) unique.set(key, place);
  }
  return [...unique.values()];
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

function distanceKilometers(a, b) {
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function organicMapsDateCandidates(places) {
  const result = new Map();
  for (const place of places) {
    if (!place.observedAt) continue;
    if (!result.has(place.observedAt)) result.set(place.observedAt, []);
    result.get(place.observedAt).push(place);
  }
  return result;
}

function corroboratingOrganicPlace(candidate, date, organicByDate) {
  const sameDate = organicByDate.get(date) || [];
  const nearby = sameDate
    .map((place) => ({
      place,
      distance: distanceKilometers(candidate, place),
      sameName: normalizeName(candidate.name) === normalizeName(place.name)
    }))
    .filter((entry) => entry.distance <= 75)
    .sort((a, b) => (
      Number(b.sameName) - Number(a.sameName)
      || a.distance - b.distance
    ));
  const best = nearby[0];
  if (!best || (!best.sameName && best.distance > 2)) return null;
  return best.place;
}

function chooseHomeOfficeCandidate(candidates, decision) {
  if (candidates.length === 1) return candidates[0];
  if (!decision) return null;
  const normalizedDecision = normalizeName(decision);
  return candidates.find((candidate) => normalizeName(candidate.name) === normalizedDecision) || null;
}

function buildDateLocations({
  archiveDates,
  homeOfficeByDate,
  organicByDate,
  decisions = {},
  includeSingleKmlDates = false
}) {
  const locations = new Map();
  const ambiguous = {};
  let combinedMatches = 0;
  let homeOfficeMatches = 0;
  let organicOnlyMatches = 0;
  let reviewedMatches = 0;

  for (const [date, candidates] of homeOfficeByDate) {
    if (!archiveDates.has(date)) continue;
    const decision = decisions[date];
    if (
      decision
      && typeof decision === 'object'
      && Number.isFinite(Number(decision.latitude))
      && Number.isFinite(Number(decision.longitude))
    ) {
      locations.set(date, {
        latitude: Number(decision.latitude),
        longitude: Number(decision.longitude),
        source: decision.source || 'photo',
        place: decision.place || candidates[0]?.name,
        country: decision.country || candidates[0]?.country,
        confidence: decision.confidence || 'visual-review',
        observedAt: date
      });
      reviewedMatches += 1;
      continue;
    }
    const selected = chooseHomeOfficeCandidate(candidates, decision);
    if (!selected) {
      ambiguous[date] = candidates.map((candidate) => candidate.name);
      continue;
    }
    const organic = corroboratingOrganicPlace(selected, date, organicByDate);
    locations.set(date, {
      latitude: organic?.latitude ?? selected.latitude,
      longitude: organic?.longitude ?? selected.longitude,
      source: organic ? 'home-office+organic-maps' : 'home-office',
      place: selected.name,
      country: selected.country,
      confidence: candidates.length > 1
        ? 'visual-review'
        : organic ? 'date-and-proximity' : 'dated-media',
      observedAt: date
    });
    if (candidates.length > 1) reviewedMatches += 1;
    if (organic) combinedMatches += 1;
    else homeOfficeMatches += 1;
  }

  if (includeSingleKmlDates) {
    for (const [date, candidates] of organicByDate) {
      if (
        locations.has(date)
        || !archiveDates.has(date)
        || candidates.length !== 1
      ) continue;
      const [selected] = candidates;
      locations.set(date, {
        latitude: selected.latitude,
        longitude: selected.longitude,
        source: 'organic-maps',
        place: selected.name,
        confidence: 'single-bookmark-date',
        observedAt: date
      });
      organicOnlyMatches += 1;
    }
  }

  return {
    locations,
    ambiguous,
    counts: { combinedMatches, homeOfficeMatches, organicOnlyMatches, reviewedMatches }
  };
}

function locationReference(homeOfficeLocations, organicPlaces, generatedAt) {
  const places = [];
  for (const location of homeOfficeLocations) {
    const visitDates = [...new Set(location.media.map(mediaDate).filter(Boolean))].sort();
    if (!location.visited && !visitDates.length) continue;
    places.push({
      id: crypto.createHash('sha256')
        .update(`home-office|${location.name}|${location.latitude}|${location.longitude}`)
        .digest('hex').slice(0, 24),
      name: location.name,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
      source: 'home-office',
      evidence: location.visited ? 'visited' : 'dated-media',
      visitDates
    });
  }
  for (const place of organicPlaces) {
    places.push({
      id: crypto.createHash('sha256')
        .update(`organic-maps|${place.collection}|${place.name}|${place.latitude}|${place.longitude}`)
        .digest('hex').slice(0, 24),
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      source: 'organic-maps',
      evidence: 'bookmark',
      observedAt: place.observedAt,
      timestamp: place.timestamp,
      collection: place.collection
    });
  }
  return { version: 1, generatedAt, places };
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryFile, filePath);
}

function buildPhotoGeodata(options) {
  const required = ['archive-index', 'archive-root', 'home-office', 'organic-maps'];
  const missing = required.filter((key) => !options[key]);
  if (missing.length) throw new Error(`Не указаны параметры: ${missing.map((key) => `--${key}`).join(', ')}`);

  const archiveRoot = path.resolve(options['archive-root']);
  const archiveIndex = JSON.parse(fs.readFileSync(options['archive-index'], 'utf8'));
  const records = Array.isArray(archiveIndex.records) ? archiveIndex.records : [];
  const homeOfficeLocations = parseHomeOfficeLocations(fs.readFileSync(options['home-office'], 'utf8'));
  const homeOfficeByDate = homeOfficeDateCandidates(homeOfficeLocations);
  const organicPlaces = readOrganicMapsKmz(options['organic-maps']);
  const organicByDate = organicMapsDateCandidates(organicPlaces);
  const decisions = options.decisions
    ? JSON.parse(fs.readFileSync(options.decisions, 'utf8'))
    : {};
  const archiveDates = new Set(records.map((record) => record.date).filter((date) => DATE_RE.test(date)));
  const matched = buildDateLocations({
    archiveDates,
    homeOfficeByDate,
    organicByDate,
    decisions,
    includeSingleKmlDates: options.includeSingleKmlDates
  });
  const existingLocations = options.existing && fs.existsSync(options.existing)
    ? readPhotoLocations(options.existing)
    : new Map();
  const photoLocations = new Map();
  let matchedPhotos = 0;
  let skippedPaths = 0;
  for (const record of records) {
    const location = matched.locations.get(record.date);
    if (!location) continue;
    const relativePath = path.relative(archiveRoot, path.resolve(record.filePath));
    const key = normalizeLocationKey(relativePath.split(path.sep).join('/'));
    if (!key) {
      skippedPaths += 1;
      continue;
    }
    photoLocations.set(key, location);
    matchedPhotos += 1;
  }
  for (const [key, location] of existingLocations) {
    if (!location.source || location.source === 'manual') photoLocations.set(key, location);
  }

  const generatedAt = new Date().toISOString();
  Object.defineProperty(photoLocations, 'documentMetadata', {
    enumerable: false,
    value: {
      generatedAt,
      sources: [
        'EXIF фотографий (читается приложением при индексации)',
        'home-office: life/resources/leisure/travel-locations.yaml',
        `Organic Maps: ${path.basename(options['organic-maps'])}`
      ]
    }
  });
  const locationDocument = serializePhotoLocations(photoLocations);
  const referenceDocument = locationReference(homeOfficeLocations, organicPlaces, generatedAt);
  const report = {
    generatedAt,
    archive: {
      photos: records.length,
      dates: archiveDates.size,
      matchedPhotos,
      skippedPaths
    },
    homeOffice: {
      locations: homeOfficeLocations.length,
      datedMediaDates: homeOfficeByDate.size
    },
    organicMaps: {
      points: organicPlaces.length,
      datedPointDates: organicByDate.size
    },
    matches: {
      dates: matched.locations.size,
      ...matched.counts,
      ambiguousDates: Object.keys(matched.ambiguous).length
    },
    ambiguous: matched.ambiguous,
    referencePlaces: referenceDocument.places.length
  };

  if (!options.dryRun) {
    if (!options.output) throw new Error('Не указан параметр --output');
    atomicWriteJson(options.output, locationDocument);
    if (options['reference-output']) atomicWriteJson(options['reference-output'], referenceDocument);
    if (options.report) atomicWriteJson(options.report, report);
  }
  return { locationDocument, referenceDocument, report };
}

if (require.main === module) {
  try {
    const result = buildPhotoGeodata(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Не удалось собрать геоданные: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildDateLocations,
  buildPhotoGeodata,
  distanceKilometers,
  homeOfficeDateCandidates,
  mediaDate,
  normalizeName,
  organicMapsDateCandidates,
  parseArguments,
  parseHomeOfficeLocations,
  parseKmlPlacemarks,
  readOrganicMapsKmz
};
