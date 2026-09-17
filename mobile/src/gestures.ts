const SWIPE_INTENT_DISTANCE = 12;
const SWIPE_PAGE_DISTANCE = 44;
const SWIPE_PAGE_VELOCITY = 0.45;

export function isHorizontalSwipeIntent(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) >= SWIPE_INTENT_DISTANCE
    && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
}

export function horizontalPageShift(
  deltaX: number,
  deltaY: number,
  velocityX = 0
): -1 | 0 | 1 {
  if (!isHorizontalSwipeIntent(deltaX, deltaY)) return 0;
  const completed = Math.abs(deltaX) >= SWIPE_PAGE_DISTANCE
    || Math.abs(velocityX) >= SWIPE_PAGE_VELOCITY;
  if (!completed) return 0;
  return deltaX < 0 ? 1 : -1;
}
