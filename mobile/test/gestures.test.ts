import assert from 'node:assert/strict';
import test from 'node:test';
import { horizontalPageShift, isHorizontalSwipeIntent } from '../src/gestures.ts';

test('recognizes horizontal movement without stealing vertical scrolling', () => {
  assert.equal(isHorizontalSwipeIntent(13, 2), true);
  assert.equal(isHorizontalSwipeIntent(11, 0), false);
  assert.equal(isHorizontalSwipeIntent(30, 28), false);
  assert.equal(isHorizontalSwipeIntent(5, 50), false);
});

test('maps a completed swipe to the adjacent page', () => {
  assert.equal(horizontalPageShift(-60, 5), 1);
  assert.equal(horizontalPageShift(60, 5), -1);
  assert.equal(horizontalPageShift(-18, 2, -0.7), 1);
  assert.equal(horizontalPageShift(18, 2, 0.7), -1);
  assert.equal(horizontalPageShift(-30, 2, -0.2), 0);
  assert.equal(horizontalPageShift(-70, 65, -0.8), 0);
});
