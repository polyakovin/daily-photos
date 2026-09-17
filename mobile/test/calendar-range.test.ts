import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarMoveTarget,
  startOfCalendarPeriod
} from '../src/calendar-range.ts';

test('calendar periods start at Monday, first day of month or first day of year', () => {
  const value = new Date(2026, 7, 12);
  assert.deepEqual(startOfCalendarPeriod(value, 'week'), new Date(2026, 7, 10));
  assert.deepEqual(startOfCalendarPeriod(value, 'month'), new Date(2026, 7, 1));
  assert.deepEqual(startOfCalendarPeriod(value, 'year'), new Date(2026, 0, 1));
});

test('calendar cannot move before the period containing the first photo', () => {
  const firstPhoto = new Date(2021, 4, 19);
  const today = new Date(2026, 7, 12);

  assert.equal(calendarMoveTarget(new Date(2021, 4, 1), 'month', -1, firstPhoto, today), null);
  assert.equal(calendarMoveTarget(new Date(2021, 4, 17), 'week', -1, firstPhoto, today), null);
  assert.equal(calendarMoveTarget(new Date(2021, 0, 1), 'year', -1, firstPhoto, today), null);
});

test('calendar cannot move beyond the period containing today', () => {
  const firstPhoto = new Date(2021, 4, 19);
  const today = new Date(2026, 7, 12);

  assert.equal(calendarMoveTarget(today, 'month', 1, firstPhoto, today), null);
  assert.equal(calendarMoveTarget(today, 'week', 1, firstPhoto, today), null);
  assert.equal(calendarMoveTarget(today, 'year', 1, firstPhoto, today), null);
});

test('calendar returns the adjacent period when it remains inside archive bounds', () => {
  const firstPhoto = new Date(2021, 4, 19);
  const today = new Date(2026, 7, 12);

  assert.deepEqual(
    calendarMoveTarget(new Date(2024, 5, 15), 'month', 1, firstPhoto, today),
    new Date(2024, 6, 1)
  );
  assert.deepEqual(
    calendarMoveTarget(new Date(2024, 5, 12), 'week', -1, firstPhoto, today),
    new Date(2024, 5, 3)
  );
});
