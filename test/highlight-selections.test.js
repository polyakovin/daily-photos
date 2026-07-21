const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startPhotoDayServer } = require('../src/server');

test('отметки периода и презентации хранятся отдельно в каждой папке архива', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-highlights-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const otherArchiveRoot = path.join(temporaryRoot, 'other-archive');
  const stateRoot = path.join(temporaryRoot, 'state');
  fs.mkdirSync(archiveRoot, { recursive: true });
  fs.mkdirSync(otherArchiveRoot, { recursive: true });
  fs.writeFileSync(path.join(archiveRoot, '2024-07-05 first.jpg'), 'first-photo');
  fs.writeFileSync(path.join(archiveRoot, '2024-08-09 second.jpg'), 'second-photo');
  fs.writeFileSync(path.join(otherArchiveRoot, '2025-03-12 other.jpg'), 'other-photo');

  let server = null;
  t.after(async () => {
    await server?.close();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  const startServer = () => startPhotoDayServer({
    contentRoot: archiveRoot,
    stateRoot,
    convertImages: false,
    metadataIndex: true,
    mode: 'folder',
    roots: [archiveRoot],
    port: 0
  });

  server = await startServer();
  await server.reindex();
  const photos = await fetch(`${server.url}/api/photos`).then((response) => response.json());
  const julyPhoto = photos.find((photo) => photo.date === '2024-07-05');
  const augustPhoto = photos.find((photo) => photo.date === '2024-08-09');

  const monthResponse = await fetch(`${server.url}/api/highlight-selections/month/2024-07`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoId: julyPhoto.id })
  });
  assert.equal(monthResponse.status, 200);
  const monthState = await monthResponse.json();
  assert.equal(monthState.selections.months['2024-07'], julyPhoto.id);
  assert.equal(monthState.highlights.months.find((item) => item.year === 2024 && item.month === 7).id, julyPhoto.id);

  const yearResponse = await fetch(`${server.url}/api/highlight-selections/year/2024`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoId: augustPhoto.id })
  });
  assert.equal(yearResponse.status, 200);
  const archiveSelectionsFile = path.join(archiveRoot, 'period_photo_selections.json');
  assert.equal(fs.existsSync(archiveSelectionsFile), true);
  assert.equal(fs.existsSync(path.join(stateRoot, 'period_photo_selections.json')), false);
  assert.equal(JSON.parse(fs.readFileSync(archiveSelectionsFile, 'utf8')).years['2024'], augustPhoto.id);
  const blurResponse = await fetch(`${server.url}/api/blur-dates/2024-07-05`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blurred: true })
  });
  assert.equal(blurResponse.status, 200);
  const archiveBlurFile = path.join(archiveRoot, 'presentation_blur_dates.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(archiveBlurFile, 'utf8')), ['2024-07-05']);
  assert.equal(fs.existsSync(path.join(stateRoot, 'presentation_blur_dates.json')), false);

  const invalidResponse = await fetch(`${server.url}/api/highlight-selections/year/2025`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoId: julyPhoto.id })
  });
  assert.equal(invalidResponse.status, 400);

  await server.close();
  server = await startServer();
  const restored = await fetch(`${server.url}/api/highlight-selections`).then((response) => response.json());
  assert.equal(restored.months['2024-07'], julyPhoto.id);
  assert.equal(restored.years['2024'], augustPhoto.id);
  assert.deepEqual(await fetch(`${server.url}/api/blur-dates`).then((response) => response.json()), ['2024-07-05']);
  const restoredHighlights = await fetch(`${server.url}/api/highlights`).then((response) => response.json());
  assert.equal(restoredHighlights.years.find((item) => item.year === 2024).id, augustPhoto.id);

  await server.setContentSource({ mode: 'folder', roots: [otherArchiveRoot] });
  const otherSelections = await fetch(`${server.url}/api/highlight-selections`).then((response) => response.json());
  assert.deepEqual(otherSelections, { years: {}, months: {} });
  assert.deepEqual(await fetch(`${server.url}/api/blur-dates`).then((response) => response.json()), []);
  const otherPhotos = await fetch(`${server.url}/api/photos`).then((response) => response.json());
  const otherResponse = await fetch(`${server.url}/api/highlight-selections/year/2025`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoId: otherPhotos[0].id })
  });
  assert.equal(otherResponse.status, 200);
  assert.equal(fs.existsSync(path.join(otherArchiveRoot, 'period_photo_selections.json')), true);
  const otherBlurResponse = await fetch(`${server.url}/api/blur-dates/2025-03-12`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blurred: true })
  });
  assert.equal(otherBlurResponse.status, 200);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(otherArchiveRoot, 'presentation_blur_dates.json'), 'utf8')),
    ['2025-03-12']
  );

  await server.setContentSource({ mode: 'folder', roots: [archiveRoot] });
  const returnedSelections = await fetch(`${server.url}/api/highlight-selections`).then((response) => response.json());
  assert.equal(returnedSelections.months['2024-07'], julyPhoto.id);
  assert.equal(returnedSelections.years['2024'], augustPhoto.id);
  assert.deepEqual(await fetch(`${server.url}/api/blur-dates`).then((response) => response.json()), ['2024-07-05']);

  const removeResponse = await fetch(`${server.url}/api/highlight-selections/month/2024-07`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoId: null })
  });
  assert.equal(removeResponse.status, 200);
  const removed = await removeResponse.json();
  assert.equal(removed.selections.months['2024-07'], undefined);
});
