const assert = require('node:assert/strict');
const test = require('node:test');
const {
  addCalendarDays,
  addCalendarMonths,
  buildCalendarMonth,
  formatDateKey,
  parseDateText
} = require('../src/renderer/date-picker');

test('parses relaxed Russian date input and formats it consistently', () => {
  for (const value of ['9.7.2026', '09/07/2026', '09-07-2026', '09072026', '2026-07-09']) {
    assert.equal(parseDateText(value), '2026-07-09');
  }
  assert.equal(formatDateKey('2026-07-09'), '09.07.2026');
});

test('rejects impossible and out-of-range dates', () => {
  assert.equal(parseDateText('31.02.2026'), '');
  assert.equal(parseDateText('29.02.2025'), '');
  assert.equal(parseDateText('29.02.2024'), '2024-02-29');
  assert.equal(parseDateText('date09072026'), '');
  assert.equal(parseDateText('31.12.1899', { min: '1900-01-01' }), '');
  assert.equal(parseDateText('30.07.2026', { max: '2026-07-29' }), '');
});

test('builds a Monday-first six-week calendar grid', () => {
  const days = buildCalendarMonth(2026, 6);
  assert.equal(days.length, 42);
  assert.deepEqual(days[0], { date: '2026-06-29', inMonth: false });
  assert.deepEqual(days[2], { date: '2026-07-01', inMonth: true });
  assert.deepEqual(days.at(-1), { date: '2026-08-09', inMonth: false });
});

test('moves calendar focus without skipping across short months', () => {
  assert.equal(addCalendarDays('2026-07-29', 7), '2026-08-05');
  assert.equal(addCalendarMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addCalendarMonths('2025-01-31', 1), '2025-02-28');
  assert.equal(addCalendarMonths('2024-02-29', 12), '2025-02-28');
});
