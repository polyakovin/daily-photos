const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeCoordinates,
  normalizeLongitude,
  project,
  unproject
} = require('../src/renderer/map');

test('map projection round-trips coordinates at different zoom levels', () => {
  const location = { latitude: 55.7558, longitude: 37.6173 };
  for (const zoom of [1, 5, 12]) {
    const point = project(location.latitude, location.longitude, zoom);
    const restored = unproject(point.x, point.y, zoom);
    assert.ok(Math.abs(restored.latitude - location.latitude) < 1e-8);
    assert.ok(Math.abs(restored.longitude - location.longitude) < 1e-8);
  }
});

test('map coordinate helpers reject invalid values and wrap longitude', () => {
  assert.deepEqual(normalizeCoordinates({ latitude: 0, longitude: 0 }), {
    latitude: 0,
    longitude: 0
  });
  assert.equal(normalizeCoordinates({ latitude: null, longitude: null }), null);
  assert.equal(normalizeCoordinates({ latitude: -91, longitude: 0 }), null);
  assert.equal(normalizeCoordinates({ latitude: 0, longitude: 181 }), null);
  assert.equal(normalizeLongitude(190), -170);
  assert.equal(normalizeLongitude(-190), 170);
});
