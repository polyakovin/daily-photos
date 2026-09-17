import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildArchiveYears,
  buildCalendarMonth,
  buildCalendarWeek,
  buildCalendarWeeks,
  buildPhotoIndex,
  dateFromPath,
  photoDate,
  photosInChronologicalOrder
} from '../src/calendar.ts';

test('extracts dates from archive paths used by the desktop app', () => {
  assert.equal(dateFromPath('2024-7-5 отпуск.jpg'), '2024-07-05');
  assert.equal(dateFromPath('2023/08/15 кадр.webp'), '2023-08-15');
  assert.equal(dateFromPath('семья/без даты.jpg'), null);
  assert.equal(dateFromPath('2024-02-31 invalid.jpg'), null);
});

test('uses the modification date only when the path has no date', () => {
  const modifiedAt = new Date(2024, 5, 3, 12, 0, 0).getTime();
  assert.equal(photoDate({
    modifiedAt,
    name: 'кадр.jpg',
    relativePath: 'без даты/кадр.jpg',
    uri: 'file:///кадр.jpg'
  }), '2024-06-03');
  assert.equal(photoDate({
    modifiedAt,
    name: 'кадр.jpg',
    relativePath: '2020/01/02 кадр.jpg',
    uri: 'file:///кадр.jpg'
  }), '2020-01-02');
});

test('groups variants by date and sorts them by portable relative path', () => {
  const index = buildPhotoIndex([
    { name: 'b.jpg', relativePath: '2024-05-06 b.jpg', uri: 'file:///b.jpg' },
    { name: 'a.jpg', relativePath: '2024-05-06 a.jpg', uri: 'file:///a.jpg' },
    { name: 'c.jpg', relativePath: '2024-05-07 c.jpg', uri: 'file:///c.jpg' }
  ]);
  assert.deepEqual(index.dates, ['2024-05-06', '2024-05-07']);
  assert.deepEqual(index.byDate.get('2024-05-06')?.map((photo) => photo.name), ['a.jpg', 'b.jpg']);
  assert.equal(index.photoCount, 3);
  assert.deepEqual(
    photosInChronologicalOrder(index).map((photo) => photo.name),
    ['a.jpg', 'b.jpg', 'c.jpg']
  );
});

test('builds a six-week month starting on Monday', () => {
  const cells = buildCalendarMonth(2024, 8);
  assert.equal(cells.length, 42);
  assert.equal(cells[0].date, '2024-08-26');
  assert.equal(cells[6].date, '2024-09-01');
  assert.equal(cells[41].date, '2024-10-06');
});

test('splits a calendar into exact seven-column rows', () => {
  const weeks = buildCalendarWeeks(buildCalendarMonth(2024, 8));
  assert.equal(weeks.length, 6);
  assert.ok(weeks.every((week) => week.length === 7));
  assert.equal(weeks[0][0].date, '2024-08-26');
  assert.equal(weeks[0][6].date, '2024-09-01');
  assert.throws(() => buildCalendarWeeks(weeks[0].slice(0, 6)), /complete weeks/);
});

test('builds a Monday-first week across month boundaries', () => {
  const week = buildCalendarWeek(new Date(2024, 8, 1));
  assert.deepEqual(week.map((cell) => cell.date), [
    '2024-08-26',
    '2024-08-27',
    '2024-08-28',
    '2024-08-29',
    '2024-08-30',
    '2024-08-31',
    '2024-09-01'
  ]);
});

test('summarizes photos for year and years calendar modes', () => {
  const years = buildArchiveYears(buildPhotoIndex([
    { name: 'a.jpg', relativePath: '2023-12-31.jpg', uri: 'file:///a.jpg' },
    { name: 'b.jpg', relativePath: '2024-01-01.jpg', uri: 'file:///b.jpg' },
    { name: 'c.jpg', relativePath: '2024-01-01 c.jpg', uri: 'file:///c.jpg' },
    { name: 'd.jpg', relativePath: '2024-08-12.jpg', uri: 'file:///d.jpg' }
  ]));
  assert.deepEqual(years.map(({ year, photoCount }) => ({ year, photoCount })), [
    { year: 2024, photoCount: 3 },
    { year: 2023, photoCount: 1 }
  ]);
  assert.equal(years[0].months[0].photoCount, 2);
  assert.equal(years[0].months[7].photo?.name, 'd.jpg');
});

test('applies preferred daily and period photos to calendar representatives', () => {
  const index = buildPhotoIndex([
    { name: 'a.jpg', relativePath: '2024-01-01 a.jpg', uri: 'file:///a.jpg' },
    { name: 'b.jpg', relativePath: '2024-01-01 b.jpg', uri: 'file:///b.jpg' },
    { name: 'c.jpg', relativePath: '2024-03-02 c.jpg', uri: 'file:///c.jpg' }
  ], { '2024-01-01': '2024-01-01 b.jpg' });
  const [year] = buildArchiveYears(index, {
    months: { '2024-01': '2024-01-01' },
    years: { '2024': '2024-03-02' }
  });
  assert.equal(index.byDate.get('2024-01-01')?.[0].name, 'b.jpg');
  assert.equal(year.months[0].photo?.name, 'b.jpg');
  assert.equal(year.photo?.name, 'c.jpg');
});
