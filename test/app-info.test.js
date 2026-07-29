const assert = require('node:assert/strict');
const test = require('node:test');
const { createAppInfo } = require('../src/server/app-info');

test('собирает сведения о приложении и текущих данных архива', () => {
  const info = createAppInfo({
    application: {
      name: 'Фото дня',
      version: '1.5.0',
      buildDate: '2026-07-29T10:20:30.000Z',
      environment: 'desktop',
      platform: 'darwin',
      runtime: {
        electron: '37.10.3',
        chromium: '138.0.7204.243',
        node: '24.15.0'
      }
    },
    photos: [
      { date: '2024-01-01', latitude: 59.93, longitude: 30.31 },
      { date: '2024-01-01' },
      { date: '2026-07-29', latitude: 0, longitude: 0 }
    ],
    diary: [
      { date: '2023-12-31' },
      { date: '2025-03-12' }
    ],
    places: [{ id: 'home' }],
    sourceMode: 'computer',
    sourceRoots: ['/photos', '/camera'],
    metadataIndex: true,
    cachedIndex: true,
    convertsImages: false
  });

  assert.deepEqual(info.application, {
    name: 'Фото дня',
    version: '1.5.0',
    buildDate: '2026-07-29T10:20:30.000Z',
    environment: 'desktop',
    platform: 'darwin',
    runtime: {
      electron: '37.10.3',
      chromium: '138.0.7204.243',
      node: '24.15.0'
    }
  });
  assert.deepEqual(info.data, {
    sourceMode: 'computer',
    rootCount: 2,
    photos: 3,
    photoDays: 2,
    diaryEntries: 2,
    locatedPhotos: 2,
    savedPlaces: 1,
    dateFrom: '2023-12-31',
    dateTo: '2026-07-29',
    metadataIndex: true,
    cachedIndex: true,
    convertsImages: false
  });
});
