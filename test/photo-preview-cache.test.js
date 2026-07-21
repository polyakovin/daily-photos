const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { createPhotoPreviewGenerator } = require('../src/electron/photo-preview-cache');

test('создаёт JPEG-превью атомарно и передаёт ограниченный размер', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-preview-'));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const destinationPath = path.join(temporaryRoot, 'cache', 'preview.jpg');
  const calls = [];
  const generatePreview = createPhotoPreviewGenerator({
    nativeImage: {
      createThumbnailFromPath: async (sourcePath, size) => {
        calls.push({ sourcePath, size });
        return {
          isEmpty: () => false,
          toJPEG: (quality) => Buffer.from(`preview-${quality}`)
        };
      }
    }
  });

  await generatePreview('/photos/original.jpg', destinationPath);

  assert.deepEqual(calls, [{
    sourcePath: '/photos/original.jpg',
    size: { width: 480, height: 480 }
  }]);
  assert.equal(fs.readFileSync(destinationPath, 'utf8'), 'preview-72');
  assert.deepEqual(fs.readdirSync(path.dirname(destinationPath)), ['preview.jpg']);
});

test('не запускает больше двух декодирований одновременно', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-preview-'));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  let active = 0;
  let maximumActive = 0;
  const releases = [];
  const generatePreview = createPhotoPreviewGenerator({
    concurrency: 2,
    nativeImage: {
      createThumbnailFromPath: async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => releases.push(resolve));
        active -= 1;
        return { isEmpty: () => false, toJPEG: () => Buffer.from('preview') };
      }
    }
  });

  const jobs = [0, 1, 2].map((index) => generatePreview(
    `/photos/${index}.jpg`,
    path.join(temporaryRoot, `${index}.jpg`)
  ));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(maximumActive, 2);
  releases.splice(0).forEach((release) => release());
  for (let attempt = 0; attempt < 50 && releases.length === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(releases.length, 1);
  releases.splice(0).forEach((release) => release());
  await Promise.all(jobs);
  assert.equal(maximumActive, 2);
});
