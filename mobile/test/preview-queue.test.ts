import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProximityWarmup,
  createTaskQueue,
  prewarmItems
} from '../src/preview-queue.ts';

test('preview queue limits expensive native thumbnail work', async () => {
  const enqueue = createTaskQueue(2);
  let active = 0;
  let maximumActive = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const jobs = Array.from({ length: 5 }, (_, value) => enqueue(async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await gate;
    active -= 1;
    return value;
  }));

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(maximumActive, 2);
  release();
  assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4]);
});

test('preview queue rejects invalid concurrency', () => {
  assert.throws(() => createTaskQueue(0), /positive integer/);
});

test('preview queue rejects synchronous native errors and keeps draining', async () => {
  const enqueue = createTaskQueue(1);
  const failed = enqueue(() => {
    throw new TypeError('native method is unavailable');
  });
  const next = enqueue(async () => 'next photo');

  await assert.rejects(failed, /native method is unavailable/);
  assert.equal(await next, 'next photo');
});

test('new foreground previews overtake queued background work', async () => {
  const enqueue = createTaskQueue(1);
  const visited: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = enqueue(async () => {
    await gate;
    visited.push('running');
  });
  const background = enqueue(async () => {
    visited.push('background');
  }, 0);
  const foreground = enqueue(async () => {
    visited.push('foreground');
  }, 10);

  release();
  await Promise.all([running, background, foreground]);
  assert.deepEqual(visited, ['running', 'foreground', 'background']);
});

test('a visible request promotes the same queued background preview', async () => {
  const enqueue = createTaskQueue(1);
  const visited: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = enqueue(() => gate);
  const promoted = enqueue(async () => {
    visited.push('promoted');
  }, 0);
  const ordinary = enqueue(async () => {
    visited.push('ordinary');
  }, 5);
  enqueue.promote(promoted, 10);

  release();
  await Promise.all([running, promoted, ordinary]);
  assert.deepEqual(visited, ['promoted', 'ordinary']);
});

test('proximity warmup expands from previews that are already cached', () => {
  const warmup = createProximityWarmup(
    ['a', 'b', 'c', 'd', 'e', 'f'],
    (value) => value,
    ['c']
  );

  assert.equal(warmup.takeNext(), 'b');
  warmup.markVisited('b');
  assert.equal(warmup.takeNext(), 'd');
  warmup.markVisited('d');
  assert.equal(warmup.takeNext(), 'a');
  warmup.markVisited('a');
  assert.equal(warmup.takeNext(), 'e');
});

test('current photos and their neighbours overtake the default newest-first warmup', () => {
  const warmup = createProximityWarmup(
    ['a', 'b', 'c', 'd', 'e', 'f'],
    (value) => value
  );
  warmup.prioritize('c');

  assert.equal(warmup.takeNext(), 'c');
  warmup.markVisited('c');
  assert.equal(warmup.takeNext(), 'b');
  warmup.markVisited('b');
  assert.equal(warmup.takeNext(), 'd');
});

test('background prewarming processes the whole index with bounded concurrency', async () => {
  let active = 0;
  let maximumActive = 0;
  const visited: number[] = [];
  const result = await prewarmItems([5, 4, 3, 2, 1], async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    visited.push(value);
    await new Promise<void>((resolve) => setImmediate(resolve));
    active -= 1;
    if (value === 3) throw new Error('broken photo');
  }, { concurrency: 2 });

  assert.equal(maximumActive, 2);
  assert.deepEqual(visited, [5, 4, 3, 2, 1]);
  assert.deepEqual(result, { completed: 5, failed: 1, total: 5 });
});

test('background prewarming stops dispatching new work when its index becomes stale', async () => {
  let active = true;
  const visited: number[] = [];
  const result = await prewarmItems([1, 2, 3], async (value) => {
    visited.push(value);
    active = false;
  }, { shouldContinue: () => active });

  assert.deepEqual(visited, [1]);
  assert.deepEqual(result, { completed: 1, failed: 0, total: 3 });
});
