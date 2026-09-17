import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ArchiveAccessTimeoutError,
  withArchiveAccessTimeout
} from '../src/archive-access.ts';

test('archive access rejects after its deadline instead of leaving startup busy forever', async () => {
  const neverFinishes = new Promise<string>(() => undefined);

  await assert.rejects(
    withArchiveAccessTimeout(() => neverFinishes, 5),
    (error: unknown) => (
      error instanceof ArchiveAccessTimeoutError
      && error.timeoutMs === 5
    )
  );
});

test('archive access returns a result that arrives before the deadline', async () => {
  assert.equal(
    await withArchiveAccessTimeout(async () => 'ready', 50),
    'ready'
  );
});
