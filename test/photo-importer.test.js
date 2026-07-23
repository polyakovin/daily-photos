const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  importPhotoFiles,
  isValidImportDate,
  safePhotoStem
} = require('../src/electron/photo-importer');
const {
  readPhotoImportConfig,
  writePhotoImportConfig
} = require('../src/server/import-date-overrides');

test('validates import dates and sanitizes destination names', () => {
  const today = new Date(2026, 6, 23);
  assert.equal(isValidImportDate('2026-07-23', today), true);
  assert.equal(isValidImportDate('2026-07-24', today), false);
  assert.equal(isValidImportDate('2026-02-30', today), false);
  assert.equal(safePhotoStem('/tmp/семья: лето?.JPG'), 'семья лето');
});

test('uses a neutral dated name when the archive has no observable structure', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-'));
  const archivePath = path.join(temporaryRoot, 'archive');
  const sourcePath = path.join(temporaryRoot, 'Sunset.JPG');
  await fs.promises.mkdir(archivePath);
  await fs.promises.writeFile(sourcePath, 'photo bytes');
  t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));

  const first = await importPhotoFiles({
    archivePath,
    filePaths: [sourcePath],
    date: '2024-07-21'
  });
  const second = await importPhotoFiles({
    archivePath,
    filePaths: [sourcePath],
    date: '2024-07-21'
  });

  assert.equal(
    path.relative(archivePath, first[0].destinationPath),
    '2024-07-21 Sunset.jpg'
  );
  assert.equal(
    path.relative(archivePath, second[0].destinationPath),
    '2024-07-21 Sunset (2).jpg'
  );
  assert.equal(await fs.promises.readFile(sourcePath, 'utf8'), 'photo bytes');
  assert.equal(await fs.promises.readFile(first[0].destinationPath, 'utf8'), 'photo bytes');
  const config = readPhotoImportConfig(archivePath);
  assert.equal(config.style.type, 'full-date-name');
  assert.equal(config.overrides.get('2024-07-21 Sunset'), '2024-07-21');
  assert.equal(config.overrides.get('2024-07-21 Sunset (2)'), '2024-07-21');
});

test('detects and saves the dominant archive naming style', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-'));
  const archivePath = path.join(temporaryRoot, 'archive');
  const sourcePath = path.join(temporaryRoot, 'Sunset.JPG');
  const sampleDirectory = path.join(archivePath, '2023', '08');
  await fs.promises.mkdir(sampleDirectory, { recursive: true });
  await Promise.all([
    fs.promises.writeFile(path.join(sampleDirectory, '15.jpg'), 'one'),
    fs.promises.writeFile(path.join(sampleDirectory, '16.jpg'), 'two'),
    fs.promises.writeFile(path.join(sampleDirectory, '17.jpg'), 'three'),
    fs.promises.writeFile(sourcePath, 'photo bytes')
  ]);
  t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));

  const [result] = await importPhotoFiles({
    archivePath,
    filePaths: [sourcePath],
    date: '2024-07-21'
  });

  assert.equal(
    path.relative(archivePath, result.destinationPath),
    path.join('2024', '07', '21.jpg')
  );
  assert.equal(readPhotoImportConfig(archivePath).style.type, 'year-month-day-file');
});

test('repairs a previously saved day-name style when the archive uses day-only files', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-'));
  const archivePath = path.join(temporaryRoot, 'archive');
  const sourcePath = path.join(temporaryRoot, 'Sunset.JPG');
  const sampleDirectory = path.join(archivePath, '2023', '08');
  await fs.promises.mkdir(sampleDirectory, { recursive: true });
  await Promise.all([
    fs.promises.writeFile(path.join(sampleDirectory, '15.jpg'), 'one'),
    fs.promises.writeFile(path.join(sampleDirectory, '16.jpg'), 'two'),
    fs.promises.writeFile(path.join(sampleDirectory, '17.jpg'), 'three'),
    fs.promises.writeFile(sourcePath, 'photo bytes')
  ]);
  writePhotoImportConfig(archivePath, {
    style: {
      type: 'year-month-day-name',
      prefix: '',
      dateSeparator: '-',
      nameSeparator: ' ',
      monthWidth: 2,
      dayWidth: 2
    }
  });
  t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));

  const [result] = await importPhotoFiles({
    archivePath,
    filePaths: [sourcePath],
    date: '2024-07-21'
  });

  assert.equal(
    path.relative(archivePath, result.destinationPath),
    path.join('2024', '07', '21.jpg')
  );
  assert.equal(readPhotoImportConfig(archivePath).style.type, 'year-month-day-file');
});

test('reuses a style saved in the archive configuration', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-'));
  const archivePath = path.join(temporaryRoot, 'archive');
  const sourcePath = path.join(temporaryRoot, 'Sunset.JPG');
  await fs.promises.mkdir(archivePath);
  await fs.promises.writeFile(sourcePath, 'photo bytes');
  writePhotoImportConfig(archivePath, {
    style: {
      type: 'date-directory',
      prefix: 'Photos',
      dateSeparator: '.',
      nameSeparator: ' ',
      monthWidth: 2,
      dayWidth: 2
    }
  });
  t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));

  const [result] = await importPhotoFiles({
    archivePath,
    filePaths: [sourcePath],
    date: '2024-07-21'
  });

  assert.equal(
    path.relative(archivePath, result.destinationPath),
    path.join('Photos', '2024.07.21', 'Sunset.jpg')
  );
  assert.equal(readPhotoImportConfig(archivePath).style.type, 'date-directory');
});

test('rejects unsupported files before changing the archive', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-'));
  const archivePath = path.join(temporaryRoot, 'archive');
  const sourcePath = path.join(temporaryRoot, 'notes.txt');
  await fs.promises.mkdir(archivePath);
  await fs.promises.writeFile(sourcePath, 'not a photo');
  t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));

  await assert.rejects(
    importPhotoFiles({
      archivePath,
      filePaths: [sourcePath],
      date: '2024-07-21'
    }),
    /не поддерживается/
  );
  assert.deepEqual(await fs.promises.readdir(archivePath), []);
});
