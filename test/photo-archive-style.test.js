const assert = require('node:assert/strict');
const test = require('node:test');
const {
  archiveDestination,
  classifyArchivePath,
  normalizeArchiveStyle
} = require('../src/electron/photo-archive-style');

test('classifies common archive layouts', () => {
  assert.equal(
    classifyArchivePath('2024/07/21.jpg').type,
    'year-month-day-file'
  );
  assert.equal(
    classifyArchivePath('2024/07/21 beach.jpg').type,
    'year-month-day-name'
  );
  assert.equal(
    classifyArchivePath('Photos/2024/07/21/Beach.jpg').type,
    'year-month-day-directory'
  );
  assert.equal(
    classifyArchivePath('2024.07.21 Beach.jpg').type,
    'full-date-name'
  );
  assert.equal(classifyArchivePath('Family/Beach.jpg'), null);
});

test('formats destinations from a configured style', () => {
  assert.deepEqual(archiveDestination({
    type: 'year-month-day-file',
    prefix: '',
    dateSeparator: '-',
    nameSeparator: ' ',
    monthWidth: 2,
    dayWidth: 2
  }, '2024-07-21', '/tmp/Sun:set?.JPG'), {
    directoryParts: ['2024', '07'],
    stem: '21'
  });

  assert.deepEqual(archiveDestination({
    type: 'year-month-day-directory',
    prefix: 'Photos',
    dateSeparator: '-',
    nameSeparator: ' ',
    monthWidth: 2,
    dayWidth: 2
  }, '2024-07-21', '/tmp/Sun:set?.JPG'), {
    directoryParts: ['Photos', '2024', '07', '21'],
    stem: 'Sun set'
  });
});

test('rejects unsafe configured prefixes', () => {
  assert.equal(normalizeArchiveStyle({
    type: 'full-date-name',
    prefix: '../outside'
  }), null);
});
