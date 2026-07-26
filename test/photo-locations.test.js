const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  normalizeCoordinates,
  readPhotoLocations,
  serializePhotoLocations,
  writePhotoLocations
} = require('../src/server/photo-locations');
const { startPhotoDayServer } = require('../src/server');

test('photo location storage keeps only valid photo ids and coordinates', () => {
  const validId = 'a'.repeat(32);
  const values = serializePhotoLocations(new Map([
    [validId, { latitude: 59.9386, longitude: 30.3141 }],
    ['2024/07/05.webp', {
      latitude: 55.75,
      longitude: 37.61,
      source: 'home-office',
      place: 'Москва'
    }],
    ['2024/07/06.webp', { hidden: true }],
    ['../outside.jpg', { latitude: 55.75, longitude: 37.61 }],
    ['invalid', { latitude: 55.75, longitude: 37.61 }],
    ['b'.repeat(32), { latitude: 100, longitude: 37.61 }]
  ]));
  assert.deepEqual(values, {
    version: 1,
    photos: {
      [validId]: { latitude: 59.9386, longitude: 30.3141 },
      '2024/07/05.webp': {
        latitude: 55.75,
        longitude: 37.61,
        source: 'home-office',
        place: 'Москва'
      },
      '2024/07/06.webp': { hidden: true }
    }
  });
  assert.deepEqual(normalizeCoordinates({ latitude: '55.75', longitude: '37.61' }), {
    latitude: 55.75,
    longitude: 37.61
  });
  assert.equal(normalizeCoordinates({ latitude: null, longitude: null }), null);
});

test('manual photo location can be saved and removed through the local API', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-locations-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const stateRoot = path.join(temporaryRoot, 'state');
  const photoPath = path.join(archiveRoot, '2024-07-05 place.jpg');
  fs.mkdirSync(archiveRoot, { recursive: true });
  fs.writeFileSync(photoPath, 'not-really-a-jpeg');
  writePhotoLocations(path.join(archiveRoot, 'photo_locations.json'), new Map([
    ['2024-07-05 place.jpg', {
      latitude: 55.75,
      longitude: 37.61,
      source: 'home-office',
      place: 'Москва'
    }]
  ]));
  let server = null;
  t.after(async () => {
    await server?.close();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  server = await startPhotoDayServer({
    contentRoot: archiveRoot,
    stateRoot,
    convertImages: false,
    metadataIndex: true,
    mode: 'folder',
    roots: [archiveRoot],
    port: 0
  });
  await server.reindex();
  const [photo] = await fetch(`${server.url}/api/photos`).then((response) => response.json());
  assert.equal(photo.locationSource, 'home-office');
  assert.equal(photo.locationPlace, 'Москва');
  assert.equal(photo.latitude, 55.75);
  assert.equal(photo.longitude, 37.61);
  const endpoint = `${server.url}/api/photo-locations/${photo.id}`;
  const mapEndpoint = `${endpoint}/map`;

  const hiddenResponse = await fetch(mapEndpoint, { method: 'DELETE' });
  assert.equal(hiddenResponse.status, 200);
  assert.deepEqual(await hiddenResponse.json(), {
    photoId: photo.id,
    latitude: null,
    longitude: null,
    locationSource: null,
    locationPlace: null,
    locationCountry: null,
    locationReferenceId: null,
    locationHidden: true
  });
  assert.deepEqual(
    readPhotoLocations(path.join(archiveRoot, 'photo_locations.json')).get('2024-07-05 place.jpg'),
    { hidden: true }
  );

  const savedResponse = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: 55.7558,
      longitude: 37.6173,
      place: 'Красная площадь, Москва',
      country: 'Россия',
      referenceId: 'place-moscow'
    })
  });
  assert.equal(savedResponse.status, 200);
  assert.deepEqual(await savedResponse.json(), {
    photoId: photo.id,
    latitude: 55.7558,
    longitude: 37.6173,
    locationSource: 'manual',
    locationPlace: 'Красная площадь, Москва',
    locationCountry: 'Россия',
    locationReferenceId: 'place-moscow'
  });
  assert.deepEqual(readPhotoLocations(path.join(archiveRoot, 'photo_locations.json')).get('2024-07-05 place.jpg'), {
    latitude: 55.7558,
    longitude: 37.6173,
    source: 'manual',
    place: 'Красная площадь, Москва',
    country: 'Россия',
    referenceId: 'place-moscow'
  });

  const invalidResponse = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: 95, longitude: 37 })
  });
  assert.equal(invalidResponse.status, 400);

  const removedResponse = await fetch(endpoint, { method: 'DELETE' });
  assert.equal(removedResponse.status, 200);
  assert.deepEqual(await removedResponse.json(), {
    photoId: photo.id,
    latitude: null,
    longitude: null,
    locationSource: null,
    locationPlace: null,
    locationCountry: null,
    locationReferenceId: null
  });
});
