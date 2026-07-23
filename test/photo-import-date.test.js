const assert = require('node:assert/strict');
const test = require('node:test');
const {
  periodBounds,
  suggestCalendarImportDate
} = require('../src/renderer/photo-import-date');

test('suggests the latest empty date in the visible calendar month', () => {
  assert.equal(suggestCalendarImportDate({
    view: 'calendar',
    focus: 'month',
    visibleDate: new Date(2026, 6, 1),
    occupiedDates: new Set(['2026-07-23', '2026-07-22']),
    today: new Date(2026, 6, 23)
  }), '2026-07-21');
});

test('keeps week suggestions inside the visible week and never suggests the future', () => {
  const bounds = periodBounds('week', new Date(2026, 6, 23));
  assert.equal(bounds.start.toDateString(), new Date(2026, 6, 20).toDateString());
  assert.equal(bounds.end.toDateString(), new Date(2026, 6, 26).toDateString());
  assert.equal(suggestCalendarImportDate({
    view: 'calendar',
    focus: 'week',
    visibleDate: new Date(2026, 6, 23),
    occupiedDates: new Set(['2026-07-23']),
    today: new Date(2026, 6, 23)
  }), '2026-07-22');
});

test('uses the visible year and ignores non-calendar or overview modes', () => {
  assert.equal(suggestCalendarImportDate({
    view: 'calendar',
    focus: 'year',
    visibleDate: new Date(2024, 0, 1),
    occupiedDates: new Set(['2024-12-31']),
    today: new Date(2026, 6, 23)
  }), '2024-12-30');
  assert.equal(suggestCalendarImportDate({
    view: 'timeline',
    focus: 'month',
    visibleDate: new Date(2024, 0, 1),
    occupiedDates: []
  }), null);
  assert.equal(suggestCalendarImportDate({
    view: 'calendar',
    focus: 'years',
    visibleDate: new Date(2024, 0, 1),
    occupiedDates: []
  }), null);
});

test('returns no suggestion when every available day in the period has a photo', () => {
  assert.equal(suggestCalendarImportDate({
    view: 'calendar',
    focus: 'week',
    visibleDate: new Date(2026, 6, 23),
    occupiedDates: new Set([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23'
    ]),
    today: new Date(2026, 6, 23)
  }), null);
});
