import assert from 'node:assert/strict';
import test from 'node:test';
import {
  scanProgressDescription,
  scanProgressRatio,
  scanProgressTitle
} from '../src/scan-progress.ts';

test('does not invent progress before the archive item count is known', () => {
  const progress = {
    foundPhotos: 800,
    phase: 'counting' as const,
    photos: [],
    scannedItems: 0
  };
  assert.equal(scanProgressRatio(progress), null);
  assert.equal(scanProgressTitle(progress), 'Считаем объекты архива…');
  assert.match(scanProgressDescription(progress), /точный объём/);
});

test('uses processed archive items divided by the real total', () => {
  const progress = {
    foundPhotos: 12,
    phase: 'scanning' as const,
    photos: [],
    scannedItems: 250,
    totalItems: 1000
  };
  assert.equal(scanProgressRatio(progress), 0.25);
  assert.match(scanProgressDescription(progress), /250 из 1 000/);
});

test('never lets changing photo counts drive or overflow the progress bar', () => {
  assert.equal(scanProgressRatio({
    foundPhotos: 10_000,
    phase: 'scanning',
    photos: [],
    scannedItems: 1200,
    totalItems: 1000
  }), 1);
  assert.equal(scanProgressRatio({
    foundPhotos: 500,
    phase: 'scanning',
    photos: [],
    scannedItems: 500
  }), null);
});
