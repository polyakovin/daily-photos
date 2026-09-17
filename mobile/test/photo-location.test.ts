import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadPhotoExifLocation,
  normalizePhotoLocation,
  resolvePhotoLocation
} from '../src/photo-location.ts';

test('saved photo coordinates take priority over EXIF coordinates', () => {
  const saved = { latitude: 55.75, longitude: 37.61, place: 'Москва' };
  const exif = { latitude: 59.93, longitude: 30.31 };
  assert.deepEqual(resolvePhotoLocation(saved, exif), saved);
  assert.deepEqual(resolvePhotoLocation(null, exif), exif);
});

test('photo locations reject invalid coordinates and trim labels', () => {
  assert.equal(normalizePhotoLocation({ latitude: 120, longitude: 30 }), null);
  assert.deepEqual(normalizePhotoLocation({
    country: ' Россия ',
    latitude: 0,
    longitude: 0,
    place: ' Экватор '
  }), {
    country: 'Россия',
    latitude: 0,
    longitude: 0,
    place: 'Экватор'
  });
});

test('EXIF retries from the app-local original after an iCloud placeholder misses', async () => {
  const calls: string[] = [];
  const location = await loadPhotoExifLocation({
    getPhotoExifLocation: async (uri) => {
      calls.push(uri);
      return uri.includes('/cache/')
        ? { latitude: 59.9343, longitude: 30.3351 }
        : null;
    }
  }, 'file:///iCloud/photo.heic', async () => 'file:///cache/photo.heic');

  assert.deepEqual(location, { latitude: 59.9343, longitude: 30.3351 });
  assert.deepEqual(calls, [
    'file:///iCloud/photo.heic',
    'file:///cache/photo.heic'
  ]);
});

test('EXIF lookup tolerates an older native module', async () => {
  assert.equal(await loadPhotoExifLocation(
    {},
    'file:///photo.jpg',
    async () => 'file:///cache/photo.jpg'
  ), null);
});
