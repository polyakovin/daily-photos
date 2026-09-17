export type TouchPoint = {
  locationX?: number;
  locationY?: number;
  pageX: number;
  pageY: number;
};

export type PinchFocalPoint = {
  x: number;
  y: number;
};

export type PinchTranslation = {
  x: number;
  y: number;
};

export function shouldStartPinch(
  touches: readonly TouchPoint[],
  enabled = true
): boolean {
  return enabled && touches.length >= 2;
}

export function pinchDistance(touches: readonly TouchPoint[]): number | null {
  if (touches.length < 2) return null;
  const deltaX = touches[1].pageX - touches[0].pageX;
  const deltaY = touches[1].pageY - touches[0].pageY;
  const distance = Math.hypot(deltaX, deltaY);
  return Number.isFinite(distance) && distance > 0 ? distance : null;
}

export function pinchFocalPoint(
  touches: readonly TouchPoint[]
): PinchFocalPoint | null {
  if (touches.length < 2) return null;
  const useLocalCoordinates = touches.slice(0, 2).every((touch) => (
    Number.isFinite(touch.locationX) && Number.isFinite(touch.locationY)
  ));
  const x = useLocalCoordinates
    ? ((touches[0].locationX as number) + (touches[1].locationX as number)) / 2
    : (touches[0].pageX + touches[1].pageX) / 2;
  const y = useLocalCoordinates
    ? ((touches[0].locationY as number) + (touches[1].locationY as number)) / 2
    : (touches[0].pageY + touches[1].pageY) / 2;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function pinchPageFocalPoint(
  touches: readonly TouchPoint[]
): PinchFocalPoint | null {
  if (touches.length < 2) return null;
  const x = (touches[0].pageX + touches[1].pageX) / 2;
  const y = (touches[0].pageY + touches[1].pageY) / 2;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function pinchTranslation(
  initialFocalPoint: PinchFocalPoint | null,
  currentFocalPoint: PinchFocalPoint | null
): PinchTranslation {
  if (!initialFocalPoint || !currentFocalPoint) return { x: 0, y: 0 };
  const x = currentFocalPoint.x - initialFocalPoint.x;
  const y = currentFocalPoint.y - initialFocalPoint.y;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : { x: 0, y: 0 };
}

export function transientPinchScale(
  distance: number,
  initialDistance: number,
  maximumScale = 4
): number {
  if (
    !Number.isFinite(distance)
    || !Number.isFinite(initialDistance)
    || initialDistance <= 0
    || !Number.isFinite(maximumScale)
    || maximumScale < 1
  ) return 1;
  return Math.max(1, Math.min(maximumScale, distance / initialDistance));
}
