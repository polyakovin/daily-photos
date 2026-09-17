import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pinchDistance,
  pinchFocalPoint,
  pinchPageFocalPoint,
  pinchTranslation,
  shouldStartPinch,
  transientPinchScale
} from '../src/pinch-zoom.ts';

test('pinch starts immediately when the second finger appears', () => {
  const oneTouch = [{ pageX: 20, pageY: 50 }];
  const twoTouches = [...oneTouch, { pageX: 80, pageY: 90 }];
  assert.equal(shouldStartPinch(oneTouch), false);
  assert.equal(shouldStartPinch(twoTouches), true);
  assert.equal(shouldStartPinch(twoTouches, false), false);
});

test('pinch distance follows the distance between the first two fingers', () => {
  assert.equal(pinchDistance([
    { pageX: 10, pageY: 20 },
    { pageX: 40, pageY: 60 }
  ]), 50);
  assert.equal(pinchDistance([{ pageX: 10, pageY: 20 }]), null);
});

test('transient pinch scale stays between the resting size and four times zoom', () => {
  assert.equal(transientPinchScale(50, 100), 1);
  assert.equal(transientPinchScale(250, 100), 2.5);
  assert.equal(transientPinchScale(500, 100), 4);
  assert.equal(transientPinchScale(Number.NaN, 100), 1);
});

test('pinch focal point follows the midpoint between both fingers', () => {
  assert.deepEqual(pinchFocalPoint([
    { locationX: 40, locationY: 60, pageX: 140, pageY: 260 },
    { locationX: 100, locationY: 140, pageX: 200, pageY: 340 }
  ]), { x: 70, y: 100 });
  assert.deepEqual(pinchFocalPoint([
    { pageX: 20, pageY: 50 },
    { pageX: 80, pageY: 90 }
  ]), { x: 50, y: 70 });
  assert.equal(pinchFocalPoint([{ pageX: 20, pageY: 50 }]), null);
});

test('pinch page focal point stays in screen coordinates while the photo transforms', () => {
  assert.deepEqual(pinchPageFocalPoint([
    { locationX: 50, locationY: 65, pageX: 180, pageY: 230 },
    { locationX: 110, locationY: 145, pageX: 240, pageY: 310 }
  ]), { x: 210, y: 270 });
  assert.equal(pinchPageFocalPoint([{ pageX: 20, pageY: 50 }]), null);
});

test('pinch translation follows screen movement one-to-one at any scale', () => {
  const initialTouches = [
    { locationX: 40, locationY: 60, pageX: 140, pageY: 260 },
    { locationX: 100, locationY: 140, pageX: 200, pageY: 340 }
  ];
  const movedTouches = [
    { locationX: 50, locationY: 54, pageX: 180, pageY: 236 },
    { locationX: 110, locationY: 134, pageX: 240, pageY: 316 }
  ];
  assert.deepEqual(
    pinchTranslation(
      pinchPageFocalPoint(initialTouches),
      pinchPageFocalPoint(movedTouches)
    ),
    { x: 40, y: -24 }
  );
  assert.deepEqual(pinchTranslation(null, { x: 112, y: 76 }), { x: 0, y: 0 });
});
