const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  convertPhotoForImport,
  importPhotoFiles,
  isValidImportDate,
  safePhotoStem
} = require('../src/electron/photo-importer');
const {
  readPhotoImportConfig,
  writePhotoImportConfig
} = require('../src/server/import-date-overrides');
const { indexPhotoRoots } = require('../src/server/photo-indexer');

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

test('converts HEIC and HEIF during a mixed import and indexes the chosen date', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-'));
  t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));
  const archivePath = path.join(temporaryRoot, 'archive');
  await fs.promises.mkdir(archivePath);
  const filePaths = ['Sunset.JPG', 'Sunset.HEIC', 'Sunset.heif']
    .map((name) => path.join(temporaryRoot, name));
  for (const sourcePath of filePaths) await fs.promises.writeFile(sourcePath, sourcePath);
  const existingPath = path.join(archivePath, '2024-07-21 Sunset.webp');
  await fs.promises.writeFile(existingPath, 'existing photo');
  const converted = [];

  const imported = await importPhotoFiles({
    archivePath,
    filePaths,
    date: '2024-07-21',
    convertImage: async (sourcePath, destinationPath) => {
      converted.push({ sourcePath, destinationPath });
      await fs.promises.writeFile(destinationPath, 'converted photo');
    }
  });

  assert.deepEqual(imported.map(({ name }) => name), [
    '2024-07-21 Sunset (2).jpg',
    '2024-07-21 Sunset (3).webp',
    '2024-07-21 Sunset (4).webp'
  ]);
  assert.deepEqual(imported.map(({ sourcePath }) => sourcePath), filePaths);
  assert.deepEqual(converted.map(({ sourcePath }) => sourcePath), filePaths.slice(1));
  assert.equal(await fs.promises.readFile(existingPath, 'utf8'), 'existing photo');
  for (const sourcePath of filePaths) {
    assert.equal(await fs.promises.readFile(sourcePath, 'utf8'), sourcePath);
  }
  for (const { destinationPath } of converted) assert.equal(fs.existsSync(destinationPath), false);
  const config = readPhotoImportConfig(archivePath);
  const records = await indexPhotoRoots({
    roots: [archivePath],
    overrideRoot: archivePath,
    dateOverrides: config.overrides
  });
  assert.equal(records.length, 4);
  assert.ok(records.every((photo) => photo.date === '2024-07-21'));
});

test('conversion failure leaves originals, existing photos and import settings intact', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-'));
  t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));
  const archivePath = path.join(temporaryRoot, 'archive');
  await fs.promises.mkdir(archivePath);
  const filePaths = ['plain.jpg', 'good.heic', 'broken.heif']
    .map((name) => path.join(temporaryRoot, name));
  for (const sourcePath of filePaths) await fs.promises.writeFile(sourcePath, 'original');
  writePhotoImportConfig(archivePath, { overrides: new Map([['existing', '2023-01-01']]) });
  const before = await fs.promises.readFile(path.join(archivePath, 'photo_import_config.json'));
  const temporaryPaths = [];

  await assert.rejects(importPhotoFiles({
    archivePath,
    filePaths,
    date: '2024-07-21',
    convertImage: async (sourcePath, destinationPath) => {
      temporaryPaths.push(destinationPath);
      await fs.promises.writeFile(destinationPath, 'partial conversion');
      if (sourcePath.endsWith('.heif')) throw new Error('decoder failed');
    }
  }), /decoder failed/);

  assert.deepEqual(await fs.promises.readdir(archivePath), ['photo_import_config.json']);
  assert.deepEqual(await fs.promises.readFile(path.join(archivePath, 'photo_import_config.json')), before);
  for (const sourcePath of filePaths) assert.equal(await fs.promises.readFile(sourcePath, 'utf8'), 'original');
  for (const destinationPath of temporaryPaths) assert.equal(fs.existsSync(destinationPath), false);
});

test('rejects an empty conversion before saving photos in the archive', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-'));
  t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));
  const archivePath = path.join(temporaryRoot, 'archive');
  const sourcePath = path.join(temporaryRoot, 'photo.heic');
  await fs.promises.mkdir(archivePath);
  await fs.promises.writeFile(sourcePath, 'original');

  await assert.rejects(importPhotoFiles({
    archivePath,
    filePaths: [sourcePath],
    date: '2024-07-21',
    convertImage: async (_sourcePath, destinationPath) => fs.promises.writeFile(destinationPath, '')
  }), /конвертац/i);
  assert.deepEqual(await fs.promises.readdir(archivePath), []);
});

test('HEIC conversion preserves metadata, normalizes orientation and validates the WebP', async (t) => {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-import-'));
  t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));
  const sourcePath = path.join(temporaryRoot, 'original.heic');
  const destinationPath = path.join(temporaryRoot, 'converted.webp');
  await fs.promises.writeFile(sourcePath, 'original');
  const calls = [];

  await convertPhotoForImport(sourcePath, destinationPath, {
    runCommand: async (command, args) => {
      calls.push({ command, args });
      if (command === 'heif-convert') await fs.promises.writeFile(args.at(-1), 'decoded pixels');
      if (command === 'cwebp') await fs.promises.writeFile(args.at(-1), 'converted pixels');
    }
  });

  assert.deepEqual(calls.map(({ command }) => command), ['heif-convert', 'cwebp', 'exiftool', 'webpinfo']);
  assert.ok(calls[2].args.includes(sourcePath));
  assert.ok(calls[2].args.includes('-all:all'));
  assert.ok(calls[2].args.includes('-IFD0:Orientation#=1'));
  assert.equal(calls[3].args.at(-1), destinationPath);
  assert.equal(await fs.promises.readFile(sourcePath, 'utf8'), 'original');
  assert.equal(await fs.promises.readFile(destinationPath, 'utf8'), 'converted pixels');
  assert.equal(fs.existsSync(calls[0].args.at(-1)), false);
});
