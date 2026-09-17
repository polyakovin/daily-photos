import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPresentationPhotoBlurred,
  normalizeStoredPresentationMode,
  PRESENTATION_MODE_STORAGE_KEY
} from '../src/presentation.ts';

test('presentation mode uses the same durable key as the desktop app', () => {
  assert.equal(PRESENTATION_MODE_STORAGE_KEY, 'photo-day:presentation-mode');
  assert.equal(normalizeStoredPresentationMode('true'), true);
  assert.equal(normalizeStoredPresentationMode('false'), false);
  assert.equal(normalizeStoredPresentationMode(null), false);
});

test('presentation blurs only dates explicitly marked for it', () => {
  const blurDates = new Set(['2024-08-12']);
  assert.equal(isPresentationPhotoBlurred(true, blurDates, '2024-08-12'), true);
  assert.equal(isPresentationPhotoBlurred(false, blurDates, '2024-08-12'), false);
  assert.equal(isPresentationPhotoBlurred(true, blurDates, '2024-08-13'), false);
});
