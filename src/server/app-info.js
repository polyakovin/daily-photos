const DATE_KEY_PATTERN = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function hasCoordinates(photo) {
  if (
    photo?.latitude === null
    || photo?.latitude === undefined
    || photo?.latitude === ''
    || photo?.longitude === null
    || photo?.longitude === undefined
    || photo?.longitude === ''
  ) return false;
  return Number.isFinite(Number(photo.latitude)) && Number.isFinite(Number(photo.longitude));
}

function createAppInfo({
  application = {},
  photos = [],
  diary = [],
  places = [],
  sourceMode = 'folder',
  sourceRoots = [],
  metadataIndex = false,
  cachedIndex = false,
  convertsImages = false
} = {}) {
  const safePhotos = Array.isArray(photos) ? photos : [];
  const safeDiary = Array.isArray(diary) ? diary : [];
  const safePlaces = Array.isArray(places) ? places : [];
  const photoDates = safePhotos
    .map((photo) => photo?.date)
    .filter((date) => typeof date === 'string' && DATE_KEY_PATTERN.test(date))
    .sort();
  const archiveDates = [
    ...photoDates,
    ...safeDiary
      .map((entry) => entry?.date)
      .filter((date) => typeof date === 'string' && DATE_KEY_PATTERN.test(date))
  ].sort();
  const runtime = application.runtime && typeof application.runtime === 'object'
    ? Object.fromEntries(
      Object.entries(application.runtime)
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([key, value]) => [key, value.trim()])
    )
    : {};

  return {
    application: {
      name: text(application.name, 'Фото дня'),
      version: text(application.version, '—'),
      buildDate: text(application.buildDate),
      environment: text(application.environment, 'web'),
      platform: text(application.platform),
      runtime
    },
    data: {
      sourceMode: sourceMode === 'computer' ? 'computer' : 'folder',
      rootCount: Array.isArray(sourceRoots) ? sourceRoots.length : 0,
      photos: safePhotos.length,
      photoDays: new Set(photoDates).size,
      diaryEntries: safeDiary.length,
      locatedPhotos: safePhotos.filter(hasCoordinates).length,
      savedPlaces: safePlaces.length,
      dateFrom: archiveDates[0] || '',
      dateTo: archiveDates.at(-1) || '',
      metadataIndex: Boolean(metadataIndex),
      cachedIndex: Boolean(cachedIndex),
      convertsImages: Boolean(convertsImages)
    }
  };
}

module.exports = { createAppInfo };
