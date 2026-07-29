const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  consolidateLocationData,
  readLocationData
} = require('../src/server/location-storage');
const {
  readPhotoLocations,
  writePhotoLocations
} = require('../src/server/photo-locations');
const { writeLocationReference } = require('../src/server/location-reference');

test('location data keeps the richest map-coordinate place and remaps photo references', () => {
  const locations = new Map([
    ['2026/07/24.jpg', {
      latitude: 36.8002,
      longitude: 10.185765,
      source: 'manual',
      referenceId: 'organic-tunis'
    }],
    ['2026/07/25.jpg', {
      latitude: 36.8002001,
      longitude: 10.185765,
      source: 'manual',
      referenceId: 'nearby-duplicate'
    }]
  ]);
  const result = consolidateLocationData(locations, [{
    id: 'organic-tunis',
    name: 'Tunis',
    latitude: 36.8002,
    longitude: 10.185765,
    source: 'organic-maps',
    evidence: 'bookmark',
    observedAt: '2024-07-24',
    timestamp: '2024-07-24T10:00:00Z',
    collection: 'Избранное'
  }, {
    id: 'home-office-tunis',
    name: 'Тунис',
    country: 'Тунис',
    latitude: 36.8002,
    longitude: 10.185765,
    source: 'home-office',
    evidence: 'visited',
    mediaCount: 3,
    visitDates: ['2024-07-24', '2025-07-24']
  }, {
    id: 'nearby-duplicate',
    name: 'Почти та же точка',
    latitude: 36.8002001,
    longitude: 10.185765,
    source: 'manual',
    evidence: 'manual'
  }, {
    id: 'separate',
    name: 'Соседняя точка',
    latitude: 36.80021,
    longitude: 10.185765,
    source: 'manual',
    evidence: 'manual'
  }]);

  assert.equal(result.removedPlaceCount, 2);
  assert.equal(result.remappedPhotoCount, 2);
  assert.deepEqual(locations.get('2026/07/24.jpg'), {
    latitude: 36.8002,
    longitude: 10.185765,
    source: 'manual',
    referenceId: 'home-office-tunis'
  });
  assert.deepEqual(locations.get('2026/07/25.jpg'), {
    latitude: 36.8002001,
    longitude: 10.185765,
    source: 'manual',
    referenceId: 'home-office-tunis'
  });
  assert.deepEqual(result.places, [{
    id: 'home-office-tunis',
    name: 'Тунис',
    latitude: 36.8002,
    longitude: 10.185765,
    country: 'Тунис',
    source: 'home-office',
    evidence: 'visited',
    observedAt: '2024-07-24',
    timestamp: '2024-07-24T10:00:00Z',
    collection: 'Избранное',
    mediaCount: 3,
    visitDates: ['2024-07-24', '2025-07-24'],
    mergedPlaces: [{
      id: 'organic-tunis',
      name: 'Tunis',
      latitude: 36.8002,
      longitude: 10.185765,
      source: 'organic-maps',
      evidence: 'bookmark',
      observedAt: '2024-07-24',
      timestamp: '2024-07-24T10:00:00Z',
      collection: 'Избранное'
    }, {
      id: 'nearby-duplicate',
      name: 'Почти та же точка',
      latitude: 36.8002001,
      longitude: 10.185765,
      source: 'manual',
      evidence: 'manual'
    }]
  }, {
    id: 'separate',
    name: 'Соседняя точка',
    latitude: 36.80021,
    longitude: 10.185765,
    source: 'manual',
    evidence: 'manual'
  }]);
});

test('legacy location reference migrates into photo locations and is removed', (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-location-storage-'));
  const photoLocationsFile = path.join(temporaryRoot, 'photo_locations.json');
  const legacyReferenceFile = path.join(temporaryRoot, 'location_reference.json');
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  writePhotoLocations(photoLocationsFile, new Map([
    ['2026/07/24.jpg', {
      latitude: 36.8002,
      longitude: 10.185765,
      source: 'manual',
      referenceId: 'organic-tunis'
    }]
  ]));
  writeLocationReference(legacyReferenceFile, {
    version: 1,
    generatedAt: '2026-07-24T00:00:00.000Z',
    places: [{
      id: 'organic-tunis',
      name: 'Tunis',
      latitude: 36.8002,
      longitude: 10.185765,
      source: 'organic-maps',
      evidence: 'bookmark'
    }, {
      id: 'home-office-tunis',
      name: 'Тунис',
      country: 'Тунис',
      latitude: 36.8002,
      longitude: 10.185765,
      source: 'home-office',
      evidence: 'visited',
      mediaCount: 1
    }]
  });

  const locations = readLocationData(photoLocationsFile, legacyReferenceFile);
  const storedDocument = JSON.parse(fs.readFileSync(photoLocationsFile, 'utf8'));

  assert.equal(fs.existsSync(legacyReferenceFile), false);
  assert.equal(storedDocument.version, 2);
  assert.equal(storedDocument.places.length, 1);
  assert.equal(
    storedDocument.photos['2026/07/24.jpg'].referenceId,
    'home-office-tunis'
  );
  assert.equal(locations.documentMetadata.places.length, 1);
  assert.deepEqual(
    readPhotoLocations(photoLocationsFile).get('2026/07/24.jpg'),
    locations.get('2026/07/24.jpg')
  );
});
