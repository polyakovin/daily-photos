const assert = require('node:assert/strict');
const test = require('node:test');
const {
  STORAGE_KEY,
  newestViewState,
  normalizeViewState,
  readViewState,
  storeViewState
} = require('../src/renderer/view-state');

test('view state keeps the last section, calendar date, timeline anchor and viewer', () => {
  const state = normalizeViewState({
    updatedAt: 42,
    view: 'timeline',
    calendar: { focus: 'year', date: '2024-02-29' },
    timeline: { date: '2021-05-17', progress: 0.35 },
    viewer: { date: '2021-05-17', photoId: 'photo-17', diaryVisible: true }
  });

  assert.deepEqual(state, {
    version: 1,
    updatedAt: 42,
    view: 'timeline',
    calendar: { focus: 'year', date: '2024-02-29' },
    timeline: { date: '2021-05-17', progress: 0.35 },
    viewer: { date: '2021-05-17', photoId: 'photo-17', diaryVisible: true }
  });
});

test('view state rejects unsupported and impossible positions', () => {
  const state = normalizeViewState({
    view: 'settings',
    calendar: { focus: 'decade', date: '2023-02-29' },
    timeline: { date: 'not-a-date', progress: 3 },
    viewer: { date: '2024-13-01' }
  });

  assert.equal(state.view, 'calendar');
  assert.deepEqual(state.calendar, { focus: 'month', date: null });
  assert.deepEqual(state.timeline, { date: null, progress: 1 });
  assert.equal(state.viewer, null);
});

test('view state storage tolerates corrupt data and keeps the newest copy', () => {
  const values = new Map([[STORAGE_KEY, '{broken']]);
  const storage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); }
  };

  assert.equal(readViewState(storage).view, 'calendar');
  const local = storeViewState(storage, { updatedAt: 10, view: 'life' });
  const desktop = normalizeViewState({ updatedAt: 20, view: 'random' });

  assert.equal(JSON.parse(values.get(STORAGE_KEY)).view, 'life');
  assert.equal(newestViewState(local, desktop).view, 'random');
});
