const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { startPhotoDayServer } = require('../src/server');

test('десктопный индекс отдаёт и повторно использует превью из локального кэша', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-server-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const stateRoot = path.join(temporaryRoot, 'state');
  const originalPath = path.join(archiveRoot, '2024-07-05 original.jpg');
  fs.mkdirSync(archiveRoot, { recursive: true });
  fs.writeFileSync(originalPath, 'original-image');
  let generations = 0;
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
    indexedPreviewGenerator: async (_sourcePath, destinationPath) => {
      generations += 1;
      await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.promises.writeFile(destinationPath, `cached-preview-${generations}`);
    },
    mode: 'folder',
    roots: [archiveRoot],
    port: 0
  });
  await server.reindex();

  const photos = await fetch(`${server.url}/api/photos`).then((response) => response.json());
  assert.equal(photos.length, 1);
  assert.match(photos[0].thumbnailSrc, /^\/indexed-preview\/[a-f0-9]{32}\?v=/);
  assert.notEqual(photos[0].thumbnailSrc, photos[0].src);

  const firstPreview = await fetch(`${server.url}${photos[0].thumbnailSrc}`);
  assert.equal(await firstPreview.text(), 'cached-preview-1');
  assert.equal(firstPreview.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const secondPreview = await fetch(`${server.url}${photos[0].thumbnailSrc}`);
  assert.equal(await secondPreview.text(), 'cached-preview-1');
  assert.equal(generations, 1);

  const original = await fetch(`${server.url}${photos[0].src}`);
  assert.equal(await original.text(), 'original-image');

  fs.writeFileSync(originalPath, 'changed-original-image');
  await server.reindex();
  const updatedPhotos = await fetch(`${server.url}/api/photos`).then((response) => response.json());
  assert.notEqual(updatedPhotos[0].thumbnailSrc, photos[0].thumbnailSrc);
  const updatedPreview = await fetch(`${server.url}${updatedPhotos[0].thumbnailSrc}`);
  assert.equal(await updatedPreview.text(), 'cached-preview-2');
  assert.equal(generations, 2);
});
