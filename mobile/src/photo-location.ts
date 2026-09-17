import type { ArchiveLocation } from '../modules/photo-archive';

export function normalizePhotoLocation(value: unknown): ArchiveLocation | null {
  if (!value || typeof value !== 'object') return null;
  const location = value as Partial<ArchiveLocation>;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (
    !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
  ) return null;
  return {
    ...(typeof location.country === 'string' && location.country.trim()
      ? { country: location.country.trim() }
      : {}),
    latitude,
    longitude,
    ...(typeof location.place === 'string' && location.place.trim()
      ? { place: location.place.trim() }
      : {})
  };
}

export function resolvePhotoLocation(
  savedLocation: unknown,
  exifLocation: unknown
): ArchiveLocation | null {
  return normalizePhotoLocation(savedLocation) || normalizePhotoLocation(exifLocation);
}

export type PhotoExifLocationModule = {
  getPhotoExifLocation?: (uri: string) => Promise<unknown>;
};

export async function loadPhotoExifLocation(
  nativeModule: PhotoExifLocationModule,
  originalUri: string,
  prepareLocalUri: () => Promise<string>
): Promise<ArchiveLocation | null> {
  if (typeof nativeModule.getPhotoExifLocation !== 'function') return null;
  try {
    const location = normalizePhotoLocation(
      await nativeModule.getPhotoExifLocation(originalUri)
    );
    if (location) return location;
  } catch {
    // iCloud placeholders can fail until the original has been copied locally.
  }
  try {
    const localUri = await prepareLocalUri();
    if (!localUri || localUri === originalUri) return null;
    return normalizePhotoLocation(await nativeModule.getPhotoExifLocation(localUri));
  } catch {
    return null;
  }
}
