const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  normalizeReferencePlace,
  readLocationReference
} = require('../src/server/location-reference');
const { readLocationData } = require('../src/server/location-storage');
const { readPhotoLocations } = require('../src/server/photo-locations');
const { startPhotoDayServer } = require('../src/server');

test('location reference keeps valid standalone places', () => {
  assert.deepEqual(normalizeReferencePlace({
    id: 'tunis',
    name: 'Тунис',
    country: 'Тунис',
    latitude: '36.8002',
    longitude: '10.185765',
    source: 'home-office',
    evidence: 'visited',
    mediaCount: 1,
    visitDates: ['2024-07-24', 'invalid', '2024-07-24']
  }), {
    id: 'tunis',
    name: 'Тунис',
    latitude: 36.8002,
    longitude: 10.185765,
    country: 'Тунис',
    source: 'home-office',
    evidence: 'visited',
    mediaCount: 1,
    visitDates: ['2024-07-24']
  });
  assert.equal(normalizeReferencePlace({
    id: 'outside',
    name: 'За пределами карты',
    latitude: 100,
    longitude: 10
  }), null);
});

test('location reference is exposed from the selected archive folder', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-reference-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const stateRoot = path.join(temporaryRoot, 'state');
  fs.mkdirSync(archiveRoot, { recursive: true });
  fs.writeFileSync(path.join(archiveRoot, '2026-07-24.jpg'), 'not-really-a-jpeg');
  fs.writeFileSync(path.join(archiveRoot, 'location_reference.json'), JSON.stringify({
    version: 1,
    generatedAt: '2026-07-24T00:00:00.000Z',
    places: [{
      id: 'tunis',
      name: 'Тунис',
      country: 'Тунис',
      latitude: 36.8002,
      longitude: 10.185765,
      source: 'home-office',
      evidence: 'visited'
    }, {
      id: 'broken',
      name: 'Некорректная точка',
      latitude: 200,
      longitude: 10
    }]
  }));
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
  assert.equal(fs.existsSync(path.join(archiveRoot, 'location_reference.json')), false);

  const response = await fetch(`${server.url}/api/location-reference`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    version: 1,
    generatedAt: '2026-07-24T00:00:00.000Z',
    places: [{
      id: 'tunis',
      name: 'Тунис',
      latitude: 36.8002,
      longitude: 10.185765,
      country: 'Тунис',
      source: 'home-office',
      evidence: 'visited'
    }]
  });

  const createdResponse = await fetch(`${server.url}/api/location-reference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Сиди-Бу-Саид',
      country: 'Тунис',
      latitude: 36.871093,
      longitude: 10.349053
    })
  });
  assert.equal(createdResponse.status, 201);
  const createdPlace = await createdResponse.json();
  assert.match(createdPlace.id, /^[a-f0-9]{24}$/);
  assert.deepEqual({
    ...createdPlace,
    id: 'generated'
  }, {
    id: 'generated',
    name: 'Сиди-Бу-Саид',
    latitude: 36.871093,
    longitude: 10.349053,
    country: 'Тунис',
    source: 'manual',
    evidence: 'manual'
  });
  assert.deepEqual(
    readLocationData(
      path.join(archiveRoot, 'photo_locations.json'),
      path.join(archiveRoot, 'location_reference.json')
    ).documentMetadata.places.at(-1),
    createdPlace
  );

  const renamedResponse = await fetch(
    `${server.url}/api/location-reference/${encodeURIComponent(createdPlace.id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Синий город', country: 'Северный Тунис' })
    }
  );
  assert.equal(renamedResponse.status, 200);
  const renamedPlace = await renamedResponse.json();
  assert.deepEqual(renamedPlace, {
    ...createdPlace,
    name: 'Синий город',
    country: 'Северный Тунис'
  });
  assert.deepEqual(
    readLocationData(
      path.join(archiveRoot, 'photo_locations.json'),
      path.join(archiveRoot, 'location_reference.json')
    ).documentMetadata.places.at(-1),
    renamedPlace
  );

  const invalidRenameResponse = await fetch(
    `${server.url}/api/location-reference/${encodeURIComponent(createdPlace.id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' })
    }
  );
  assert.equal(invalidRenameResponse.status, 400);

  const [photo] = await fetch(`${server.url}/api/photos`).then((response) => response.json());
  assert.ok(photo?.id);
  const linkedResponse = await fetch(`${server.url}/api/photo-locations/${photo.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: renamedPlace.latitude,
      longitude: renamedPlace.longitude,
      place: renamedPlace.name,
      country: renamedPlace.country,
      referenceId: renamedPlace.id
    })
  });
  assert.equal(linkedResponse.status, 200);

  const deletedResponse = await fetch(
    `${server.url}/api/location-reference/${encodeURIComponent(createdPlace.id)}`,
    { method: 'DELETE' }
  );
  assert.equal(deletedResponse.status, 200);
  assert.deepEqual(await deletedResponse.json(), {
    placeId: createdPlace.id,
    placeName: renamedPlace.name,
    removedPhotoCount: 1,
    photoLocations: [{
      photoId: photo.id,
      latitude: null,
      longitude: null,
      locationSource: null,
      locationPlace: null,
      locationCountry: null,
      locationReferenceId: null
    }]
  });
  assert.equal(
    readLocationData(
      path.join(archiveRoot, 'photo_locations.json'),
      path.join(archiveRoot, 'location_reference.json')
    ).documentMetadata.places.some((place) => place.id === createdPlace.id),
    false
  );
  assert.equal(
    readPhotoLocations(path.join(archiveRoot, 'photo_locations.json'))
      .has('2026-07-24.jpg'),
    false
  );

  const missingDeleteResponse = await fetch(
    `${server.url}/api/location-reference/${encodeURIComponent(createdPlace.id)}`,
    { method: 'DELETE' }
  );
  assert.equal(missingDeleteResponse.status, 404);

  const missingRenameResponse = await fetch(
    `${server.url}/api/location-reference/${encodeURIComponent(createdPlace.id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Несуществующее место' })
    }
  );
  assert.equal(missingRenameResponse.status, 404);

  const invalidResponse = await fetch(`${server.url}/api/location-reference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', latitude: 200, longitude: 10 })
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal(readLocationReference(path.join(archiveRoot, 'missing.json')).places.length, 0);
});
