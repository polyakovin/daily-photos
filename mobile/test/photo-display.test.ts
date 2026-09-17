import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PhotoLoadTimeoutError,
  loadDisplayPhoto,
  loadPhotoPreview
} from '../src/photo-display.ts';
import { createTaskQueue } from '../src/preview-queue.ts';

test('an older native build fails gracefully when the local display method is unavailable', async () => {
  await assert.rejects(
    loadDisplayPhoto({}, 'file:///archive/photo.jpg', 'photo-key'),
    /требует пересборки/
  );
});

test('the local display method receives the original URI and stable cache key', async () => {
  const calls: string[][] = [];
  const result = await loadDisplayPhoto({
    getDisplayUri: async (...values) => {
      calls.push(values);
      return 'file:///cache/photo.jpg';
    }
  }, 'file:///archive/photo.jpg', 'photo-key');

  assert.equal(result, 'file:///cache/photo.jpg');
  assert.deepEqual(calls, [['file:///archive/photo.jpg', 'photo-key']]);
});

test('preview loading fails after a deadline instead of occupying its queue forever', async () => {
  const neverFinishes = new Promise<string>(() => undefined);

  await assert.rejects(
    loadPhotoPreview({ getPreview: () => neverFinishes }, 'file:///archive/photo.jpg', 'photo-key', 5),
    (error: unknown) => (
      error instanceof PhotoLoadTimeoutError
      && error.kind === 'preview'
      && error.timeoutMs === 5
    )
  );
});

test('display loading fails after a deadline instead of occupying its queue forever', async () => {
  const neverFinishes = new Promise<string>(() => undefined);

  await assert.rejects(
    loadDisplayPhoto({ getDisplayUri: () => neverFinishes }, 'file:///archive/photo.jpg', 'photo-key', 5),
    (error: unknown) => (
      error instanceof PhotoLoadTimeoutError
      && error.kind === 'display'
      && error.timeoutMs === 5
    )
  );
});

test('the preview method receives the original URI and stable cache key', async () => {
  const calls: string[][] = [];
  const result = await loadPhotoPreview({
    getPreview: async (...values) => {
      calls.push(values);
      return 'file:///cache/preview.jpg';
    }
  }, 'file:///archive/photo.jpg', 'photo-key');

  assert.equal(result, 'file:///cache/preview.jpg');
  assert.deepEqual(calls, [['file:///archive/photo.jpg', 'photo-key']]);
});

test('a timed-out preview releases the queue for the next visible photo', async () => {
  const enqueue = createTaskQueue(1);
  const first = enqueue(() => loadPhotoPreview(
    { getPreview: () => new Promise<string>(() => undefined) },
    'file:///archive/stuck.jpg',
    'stuck-key',
    5
  ));
  const second = enqueue(() => loadPhotoPreview(
    { getPreview: async () => 'file:///cache/next.jpg' },
    'file:///archive/next.jpg',
    'next-key',
    50
  ));

  await assert.rejects(first, PhotoLoadTimeoutError);
  assert.equal(await second, 'file:///cache/next.jpg');
});
