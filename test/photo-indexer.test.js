const test = require('node:test');
const assert = require('node:assert/strict');
const { dateFromPath, dateKeyFromValue, shouldSkipDirectory } = require('../src/server/photo-indexer');

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

test('skips unrelated media and system directories during image discovery', () => {
  assert.equal(shouldSkipDirectory('/Users/test', 'Music', '/Users/test'), true);
  assert.equal(shouldSkipDirectory('/Users/test', 'movies', '/Users/test'), true);
  assert.equal(shouldSkipDirectory('/Users/test/Pictures', 'Family', '/Users/test/Pictures'), false);
});
