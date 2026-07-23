const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  conversionFailureMessage,
  displayConversionPath,
  parseConversionProtocolLine,
  sanitizeConversionError,
  updateRecentFiles
} = require('../src/server/conversion-progress');

test('parses conversion progress and file events', () => {
  assert.deepEqual(
    parseConversionProtocolLine('PHOTO_DAY_PROGRESS conversion 18 18'),
    { type: 'progress', phase: 'conversion', completed: 18, total: 18 }
  );

  const filePath = '/Фото дня/2026/лето 01.jpg';
  const encodedPath = Buffer.from(filePath).toString('hex');
  assert.deepEqual(
    parseConversionProtocolLine(`PHOTO_DAY_FILE failed ${encodedPath}`),
    { type: 'file', status: 'failed', filePath }
  );
  assert.equal(parseConversionProtocolLine('обычный вывод конвертера'), null);
  assert.equal(parseConversionProtocolLine('PHOTO_DAY_FILE failed abc'), null);
});

test('formats archive-relative paths and maintains a bounded recent file list', () => {
  const root = path.join(path.sep, 'archive');
  assert.equal(
    displayConversionPath(path.join(root, '2026', 'photo.jpg'), root),
    '2026/photo.jpg'
  );
  assert.equal(displayConversionPath(path.join(path.sep, 'other', 'photo.jpg'), root), 'photo.jpg');

  let files = [];
  files = updateRecentFiles(files, { path: 'one.jpg', status: 'processing' }, 2);
  files = updateRecentFiles(files, { path: 'two.jpg', status: 'converted' }, 2);
  files = updateRecentFiles(files, { path: 'one.jpg', status: 'failed' }, 2);
  assert.deepEqual(files, [
    { path: 'two.jpg', status: 'converted' },
    { path: 'one.jpg', status: 'failed' }
  ]);
});

test('surfaces failed file names and sanitizes converter output', () => {
  assert.equal(
    conversionFailureMessage({
      files: [
        { path: '2024/one.jpg', status: 'failed' },
        { path: '2024/two.heic', status: 'failed' }
      ],
      errors: ['decoder failed']
    }),
    'Не удалось конвертировать: 2024/one.jpg, 2024/two.heic; проблемные оригиналы сохранены'
  );
  assert.equal(
    conversionFailureMessage({ errors: ['Не найдена утилита cwebp'] }),
    'Не найдена утилита cwebp'
  );
  assert.equal(sanitizeConversionError('  ошибка:\n  повреждённый файл  '), 'ошибка: повреждённый файл');
});
