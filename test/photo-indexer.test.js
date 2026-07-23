const test = require('node:test');
const assert = require('node:assert/strict');
const {
  dateFromPath,
  dateKeyFromValue,
  importedDateFromPath,
  indexPhotoRoots,
  shouldSkipDirectory
} = require('../src/server/photo-indexer');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importOverrideKey } = require('../src/server/import-date-overrides');

test('reads dates from EXIF and ISO strings without truncating two-digit days', () => {
  assert.equal(dateKeyFromValue('2019:08:07 12:30:00'), '2019-08-07');
  assert.equal(dateKeyFromValue('2020-02-29T10:00:00+03:00'), '2020-02-29');
  assert.equal(dateKeyFromValue('2021:02:29 10:00:00'), null);
});

test('keeps compatibility with supported archive paths', () => {
  assert.equal(dateFromPath('/Фото/2024-7-5 отпуск.jpg'), '2024-07-05');
  assert.equal(dateFromPath('/Фото/2023/08/15 кадр.webp'), '2023-08-15');
  assert.equal(dateFromPath('/Фото/без даты.jpg'), null);
});

test('recognizes the date explicitly selected during drag-and-drop import', () => {
  assert.equal(
    importedDateFromPath('/Фото/2024/07/2024-07-21.photoday.sunset.jpg'),
    '2024-07-21'
  );
  assert.equal(importedDateFromPath('/Фото/2024-07-21 sunset.jpg'), null);
  assert.equal(importedDateFromPath('/Фото/2024-02-31.photoday.invalid.jpg'), null);
});

test('uses the saved import date regardless of filename extension or EXIF', async (t) => {
  const archivePath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-index-'));
  const photoDirectory = path.join(archivePath, 'Family');
  const photoPath = path.join(photoDirectory, 'Sunset.jpg');
  await fs.promises.mkdir(photoDirectory);
  await fs.promises.writeFile(photoPath, 'not really a jpeg');
  t.after(() => fs.promises.rm(archivePath, { recursive: true, force: true }));

  const overrideKey = importOverrideKey(archivePath, photoPath);
  assert.equal(overrideKey, importOverrideKey(archivePath, path.join(photoDirectory, 'Sunset.webp')));
  const records = await indexPhotoRoots({
    roots: [archivePath],
    overrideRoot: archivePath,
    dateOverrides: new Map([[overrideKey, '2024-07-21']])
  });
  assert.equal(records[0].date, '2024-07-21');
});

test('skips unrelated media and system directories during image discovery', () => {
  assert.equal(shouldSkipDirectory('/Users/test', 'Music', '/Users/test'), true);
  assert.equal(shouldSkipDirectory('/Users/test', 'movies', '/Users/test'), true);
  assert.equal(shouldSkipDirectory('/Users/test/Pictures', 'Family', '/Users/test/Pictures'), false);
});
