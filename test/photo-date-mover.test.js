const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startPhotoDayServer } = require('../src/server');
const {
  readPhotoImportConfig,
  writePhotoImportConfig
} = require('../src/server/import-date-overrides');
const {
  readPhotoLocations,
  writePhotoLocations
} = require('../src/server/photo-locations');

test('viewer date change moves the photo and keeps portable metadata attached', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-move-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const stateRoot = path.join(temporaryRoot, 'state');
  const sourceDirectory = path.join(archiveRoot, '2024', '07');
  const sourcePath = path.join(sourceDirectory, '21 Summer.jpg');
  await fs.promises.mkdir(sourceDirectory, { recursive: true });
  await fs.promises.writeFile(sourcePath, 'photo bytes');
  writePhotoImportConfig(archiveRoot, {
    style: {
      type: 'year-month-day-name',
      prefix: '',
      dateSeparator: '-',
      nameSeparator: ' ',
      monthWidth: 2,
      dayWidth: 2
    }
  });
  writePhotoLocations(
    path.join(archiveRoot, 'photo_locations.json'),
    new Map([
      ['2024/07/21 Summer.jpg', {
        latitude: 55.7558,
        longitude: 37.6173,
        source: 'manual'
      }]
    ])
  );

  let server;
  t.after(async () => {
    await server?.close();
    await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
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
  const highlightResponse = await fetch(`${server.url}/api/highlight-selections/month/2024-07`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoId: photo.id })
  });
  assert.equal(highlightResponse.status, 200);
  const blurResponse = await fetch(`${server.url}/api/blur-dates/2024-07-21`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blurred: true })
  });
  assert.equal(blurResponse.status, 200);
  const response = await fetch(`${server.url}/api/photos/${photo.id}/date`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2024-08-03' })
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.photo.date, '2024-08-03');
  assert.notEqual(result.photo.id, photo.id);
  assert.equal(result.photo.latitude, 55.7558);
  assert.equal(result.photo.longitude, 37.6173);
  assert.equal(await fs.promises.readFile(
    path.join(archiveRoot, '2024', '08', '03 Summer.jpg'),
    'utf8'
  ), 'photo bytes');
  await assert.rejects(fs.promises.stat(sourcePath), { code: 'ENOENT' });

  const config = readPhotoImportConfig(archiveRoot);
  assert.equal(config.overrides.has('2024/07/21 Summer'), false);
  assert.equal(config.overrides.get('2024/08/03 Summer'), '2024-08-03');
  assert.deepEqual(readPhotoLocations(
    path.join(archiveRoot, 'photo_locations.json')
  ).get('2024/08/03 Summer.jpg'), {
    latitude: 55.7558,
    longitude: 37.6173,
    source: 'manual'
  });
  assert.deepEqual(
    await fetch(`${server.url}/api/highlight-selections`).then((value) => value.json()),
    { years: {}, months: { '2024-08': '2024-08-03' } }
  );
  assert.deepEqual(
    await fetch(`${server.url}/api/blur-dates`).then((value) => value.json()),
    ['2024-08-03']
  );
});

test('viewer date change never overwrites another photo', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-move-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const stateRoot = path.join(temporaryRoot, 'state');
  await fs.promises.mkdir(path.join(archiveRoot, '2024', '07'), { recursive: true });
  await fs.promises.mkdir(path.join(archiveRoot, '2024', '08'), { recursive: true });
  await fs.promises.writeFile(path.join(archiveRoot, '2024', '07', '21.jpg'), 'moving photo');
  await fs.promises.writeFile(path.join(archiveRoot, '2024', '08', '03.jpg'), 'existing photo');
  writePhotoImportConfig(archiveRoot, {
    style: {
      type: 'year-month-day-file',
      prefix: '',
      dateSeparator: '-',
      nameSeparator: ' ',
      monthWidth: 2,
      dayWidth: 2
    }
  });

  let server;
  t.after(async () => {
    await server?.close();
    await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
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
  const photos = await fetch(`${server.url}/api/photos`).then((response) => response.json());
  const sourcePhoto = photos.find((photo) => photo.date === '2024-07-21');

  const response = await fetch(`${server.url}/api/photos/${sourcePhoto.id}/date`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2024-08-03' })
  });

  assert.equal(response.status, 200);
  assert.equal(
    await fs.promises.readFile(path.join(archiveRoot, '2024', '08', '03.jpg'), 'utf8'),
    'existing photo'
  );
  assert.equal(
    await fs.promises.readFile(path.join(archiveRoot, '2024', '08', '03 (2).jpg'), 'utf8'),
    'moving photo'
  );
});

test('viewer date change is disabled for automatic computer search', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-move-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const stateRoot = path.join(temporaryRoot, 'state');
  const sourcePath = path.join(archiveRoot, '2024-07-21 Summer.jpg');
  await fs.promises.mkdir(archiveRoot);
  await fs.promises.writeFile(sourcePath, 'photo bytes');

  let server;
  t.after(async () => {
    await server?.close();
    await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
  });
  server = await startPhotoDayServer({
    contentRoot: archiveRoot,
    stateRoot,
    convertImages: false,
    metadataIndex: true,
    mode: 'computer',
    roots: [archiveRoot],
    port: 0
  });
  await server.reindex();
  const [photo] = await fetch(`${server.url}/api/photos`).then((response) => response.json());

  const response = await fetch(`${server.url}/api/photos/${photo.id}/date`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2024-08-03' })
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: 'Смена даты доступна только при работе с выбранной папкой'
  });
  assert.equal(await fs.promises.readFile(sourcePath, 'utf8'), 'photo bytes');
});
