const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildMapPlaybackFrames,
  clusterProjectedPoints,
  distinctMapPointCount,
  groupContainsMapPoint,
  InteractiveMap,
  linkedReferencePlaces,
  mapPlaybackDelay,
  MAX_ZOOM,
  normalizeCoordinates,
  normalizeLongitude,
  parseCoordinateQuery,
  photoFanLayout,
  photoStackPoints,
  project,
  referencePlaceSuggestions,
  unproject,
  unlocatedPhotos,
  visibleReferencePoints
} = require('../src/renderer/map');

test('map projection round-trips coordinates at different zoom levels', () => {
  const location = { latitude: 55.7558, longitude: 37.6173 };
  for (const zoom of [1, 5, 12]) {
    const point = project(location.latitude, location.longitude, zoom);
    const restored = unproject(point.x, point.y, zoom);
    assert.ok(Math.abs(restored.latitude - location.latitude) < 1e-8);
    assert.ok(Math.abs(restored.longitude - location.longitude) < 1e-8);
  }
});

test('map coordinate helpers reject invalid values and wrap longitude', () => {
  assert.deepEqual(normalizeCoordinates({ latitude: 0, longitude: 0 }), {
    latitude: 0,
    longitude: 0
  });
  assert.equal(normalizeCoordinates({ latitude: null, longitude: null }), null);
  assert.equal(normalizeCoordinates({ latitude: -91, longitude: 0 }), null);
  assert.equal(normalizeCoordinates({ latitude: 0, longitude: 181 }), null);
  assert.equal(normalizeLongitude(190), -170);
  assert.equal(normalizeLongitude(-190), 170);
});

test('unlocated photos include photos deliberately removed from the map', () => {
  const hidden = { id: 'hidden', locationHidden: true };
  const withoutCoordinates = { id: 'without-coordinates' };
  const located = { id: 'located', latitude: 55.7558, longitude: 37.6173 };

  assert.deepEqual(
    unlocatedPhotos([hidden, located, withoutCoordinates]).map(({ id }) => id),
    ['hidden', 'without-coordinates']
  );
});

test('map accepts decimal coordinates without sending them to address search', () => {
  assert.deepEqual(parseCoordinateQuery('55.7558, 37.6173'), {
    latitude: 55.7558,
    longitude: 37.6173
  });
  assert.deepEqual(parseCoordinateQuery('geo:-8.40494 115.32216'), {
    latitude: -8.40494,
    longitude: 115.32216
  });
  assert.deepEqual(parseCoordinateQuery('55,7558 37,6173'), {
    latitude: 55.7558,
    longitude: 37.6173
  });
  assert.equal(parseCoordinateQuery('91, 37'), null);
  assert.equal(parseCoordinateQuery('Москва'), null);
});

test('marker clusters use a world grid that does not depend on viewport movement', () => {
  const points = [
    { id: 'a', latitude: 55.7558, longitude: 37.6173 },
    { id: 'b', latitude: 55.75581, longitude: 37.61731 },
    { id: 'c', latitude: 41.7151, longitude: 44.8271 }
  ];
  const first = clusterProjectedPoints(points, 8, 48);
  const second = clusterProjectedPoints(points, 8, 48);
  assert.deepEqual(
    first.map(({ key, points: grouped }) => [key, grouped.map((point) => point.id)]),
    second.map(({ key, points: grouped }) => [key, grouped.map((point) => point.id)])
  );
  assert.equal(first.find((group) => group.points.some((point) => point.id === 'a')).points.length, 2);
});

test('selected map point highlights its marker or containing cluster', () => {
  const selected = { id: 'selected-photo', latitude: 55.7558, longitude: 37.6173 };
  const sameCoordinates = { id: 'same-place', latitude: 55.7558, longitude: 37.6173 };
  const elsewhere = { id: 'elsewhere', latitude: 41.7151, longitude: 44.8271 };

  assert.equal(groupContainsMapPoint([selected, elsewhere], selected), true);
  assert.equal(groupContainsMapPoint([sameCoordinates], selected), true);
  assert.equal(groupContainsMapPoint([elsewhere], selected), false);
  assert.equal(groupContainsMapPoint([selected], null), false);
});

function runMapPointerGesture({ startedOnMarker, moved }) {
  const classes = new Set();
  let capturedPointerId = null;
  let mapClickCount = 0;
  let viewChangeCount = 0;
  const map = Object.assign(Object.create(InteractiveMap.prototype), {
    center: { latitude: 0, longitude: 0 },
    zoom: 4,
    suppressMarkerClick: false,
    container: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name)
      },
      setPointerCapture: (pointerId) => { capturedPointerId = pointerId; },
      hasPointerCapture: (pointerId) => capturedPointerId === pointerId,
      releasePointerCapture: () => { capturedPointerId = null; }
    },
    options: {
      onMapClick: () => { mapClickCount += 1; },
      onViewChange: () => { viewChangeCount += 1; }
    },
    centerWorld: () => ({ x: 1200, y: 900 }),
    pixelFromClient: (x, y) => ({ x, y }),
    hidePointPreview: () => { map.previewHidden = true; },
    locationAtPixel: () => ({ latitude: 1, longitude: 2 }),
    scheduleRender: () => {}
  });
  const pointerId = 7;
  map.handlePointerDown({
    button: 0,
    pointerId,
    clientX: 100,
    clientY: 100,
    target: { closest: () => startedOnMarker ? {} : null }
  });
  const capturedOnDown = capturedPointerId === pointerId;
  if (moved) {
    map.handlePointerMove({ pointerId, clientX: 138, clientY: 124 });
  }
  map.handlePointerUp({ pointerId });
  return {
    capturedOnDown,
    center: map.center,
    mapClickCount,
    previewHidden: Boolean(map.previewHidden),
    suppressMarkerClick: map.suppressMarkerClick,
    viewChangeCount
  };
}

test('dragging from a marker pans the map like dragging from empty space', () => {
  const fromMarker = runMapPointerGesture({ startedOnMarker: true, moved: true });
  const fromMap = runMapPointerGesture({ startedOnMarker: false, moved: true });

  assert.deepEqual(fromMarker.center, fromMap.center);
  assert.equal(fromMarker.capturedOnDown, false);
  assert.equal(fromMap.capturedOnDown, true);
  assert.equal(fromMarker.previewHidden, true);
  assert.equal(fromMarker.suppressMarkerClick, true);
  assert.equal(fromMarker.mapClickCount, 0);
  assert.equal(fromMarker.viewChangeCount, 1);
});

test('pressing a marker without moving keeps the marker click available', () => {
  const result = runMapPointerGesture({ startedOnMarker: true, moved: false });

  assert.equal(result.capturedOnDown, false);
  assert.equal(result.mapClickCount, 0);
  assert.equal(result.suppressMarkerClick, false);
  assert.equal(result.viewChangeCount, 0);
});

test('map playback builds one chronological frame per located photo day', () => {
  const frames = buildMapPlaybackFrames([{
    id: 'later-default',
    date: '2026-06-15',
    latitude: 41.7151,
    longitude: 44.8271,
    src: '/later-default.jpg'
  }, {
    id: 'first',
    date: '2024-01-02',
    latitude: 55.7558,
    longitude: 37.6173,
    src: '/first.jpg'
  }, {
    id: 'later-selected',
    date: '2026-06-15',
    latitude: 41.716,
    longitude: 44.828,
    src: '/later-selected.jpg'
  }, {
    id: 'without-location',
    date: '2025-03-10',
    src: '/without-location.jpg'
  }, {
    id: 'invalid-date',
    date: 'не дата',
    latitude: 48.8566,
    longitude: 2.3522,
    src: '/invalid.jpg'
  }], new Map([
    ['2026-06-15', 'later-selected'],
    ['2024-01-02', 'missing-selection']
  ]));

  assert.deepEqual(frames.map((frame) => ({
    date: frame.date,
    photo: frame.photo.id,
    photos: frame.photos.map((photo) => photo.id)
  })), [{
    date: '2024-01-02',
    photo: 'first',
    photos: ['first']
  }, {
    date: '2026-06-15',
    photo: 'later-selected',
    photos: ['later-default', 'later-selected']
  }]);
});

test('map playback delay follows the selected speed', () => {
  assert.equal(mapPlaybackDelay(0.5), 3200);
  assert.equal(mapPlaybackDelay(1), 1600);
  assert.equal(mapPlaybackDelay(2), 800);
  assert.equal(mapPlaybackDelay(4), 400);
  assert.equal(mapPlaybackDelay(0), 1600);
});

test('points joined at maximum zoom count as one place and share suggestion frequency', () => {
  const place = {
    id: 'moscow-center',
    name: 'Центр Москвы',
    latitude: 55.7558,
    longitude: 37.6173
  };
  const nearbyPhoto = {
    id: 'nearby-photo',
    date: '2026-02-01',
    latitude: 55.7559,
    longitude: 37.6174,
    mapPointType: 'photo'
  };
  const nearbyPlace = {
    id: 'red-square',
    name: 'Красная площадь',
    latitude: nearbyPhoto.latitude,
    longitude: nearbyPhoto.longitude
  };
  const distantPhoto = {
    id: 'distant-photo',
    date: '2026-03-01',
    latitude: 55.7658,
    longitude: 37.6273,
    mapPointType: 'photo'
  };

  assert.equal(clusterProjectedPoints([place, nearbyPhoto], MAX_ZOOM, 42).length, 1);
  assert.equal(distinctMapPointCount([place, nearbyPlace, nearbyPhoto, distantPhoto]), 2);
  const suggestions = referencePlaceSuggestions([place, nearbyPlace], [
    { ...place, id: 'exact-photo', date: '2026-01-01', mapPointType: 'photo' },
    nearbyPhoto,
    distantPhoto
  ], 1);
  assert.deepEqual(
    suggestions.popular.map(({ place: suggestionPlace, photoCount }) => ({
      id: suggestionPlace.id,
      photoCount
    })),
    [{ id: 'moscow-center', photoCount: 2 }]
  );
});

test('map replaces a selected reference marker with the linked photo marker', () => {
  const photos = [{
    id: 'linked-photo',
    latitude: 55.7558,
    longitude: 37.6173,
    locationReferenceId: 'linked-place'
  }, {
    id: 'unlinked-photo',
    latitude: 41.7151,
    longitude: 44.8271
  }];
  const places = [{
    id: 'linked-place',
    name: 'Москва',
    latitude: 55.7558001,
    longitude: 37.6173001
  }, {
    id: 'duplicate-unlinked-place',
    name: 'Тбилиси',
    latitude: 41.7151001,
    longitude: 44.8271001
  }, {
    id: 'independent-place',
    name: 'Батуми',
    latitude: 41.6168,
    longitude: 41.6367
  }];

  assert.deepEqual(
    visibleReferencePoints(places, []).map(({ id }) => id),
    ['linked-place', 'duplicate-unlinked-place', 'independent-place']
  );
  assert.deepEqual(
    visibleReferencePoints(places, photos).map(({ id, mapPointType }) => ({
      id,
      mapPointType
    })),
    [{
      id: 'independent-place',
      mapPointType: 'reference'
    }]
  );
  assert.deepEqual(
    linkedReferencePlaces(places, photos).map(({ id }) => id),
    ['linked-place']
  );
});

test('place suggestions use selection history for recent and photo counts for popular', () => {
  const places = [{
    id: 'popular',
    name: 'Популярное место',
    latitude: 55.7558,
    longitude: 37.6173
  }, {
    id: 'recent',
    name: 'Недавнее место',
    latitude: 41.7151,
    longitude: 44.8271
  }, {
    id: 'empty',
    name: 'Без фотографий',
    latitude: 48.8566,
    longitude: 2.3522
  }];
  const photos = [{
    id: 'popular-linked',
    date: '2024-01-01',
    locationReferenceId: 'popular',
    latitude: 55.7558,
    longitude: 37.6173
  }, {
    id: 'popular-coordinate',
    date: '2023-01-01',
    latitude: 55.7558001,
    longitude: 37.6173001
  }, {
    id: 'popular-older',
    date: '2022-01-01',
    locationReferenceId: 'popular',
    latitude: 55.7558,
    longitude: 37.6173
  }, {
    id: 'recent-linked',
    date: '2026-06-15',
    locationReferenceId: 'recent',
    latitude: 41.7151,
    longitude: 44.8271
  }, {
    id: 'recent-coordinate',
    date: '2025-08-20',
    latitude: 41.7151001,
    longitude: 44.8271001
  }, {
    id: 'unrelated',
    date: '2026-07-01',
    latitude: 35.6762,
    longitude: 139.6503
  }];

  const suggestions = referencePlaceSuggestions(places, photos, 2, [
    'empty',
    'popular',
    'missing',
    'recent'
  ]);
  assert.deepEqual(
    suggestions.all.map(({ place, photoCount, latestDate }) => ({
      id: place.id,
      photoCount,
      latestDate
    })),
    [{
      id: 'empty',
      photoCount: 0,
      latestDate: ''
    }, {
      id: 'recent',
      photoCount: 2,
      latestDate: '2026-06-15'
    }, {
      id: 'popular',
      photoCount: 3,
      latestDate: '2024-01-01'
    }]
  );
  assert.deepEqual(
    suggestions.recent.map(({ place }) => place.id),
    ['empty', 'popular']
  );
  assert.deepEqual(
    suggestions.popular.map(({ place, photoCount }) => [place.id, photoCount]),
    [['popular', 3], ['recent', 2]]
  );
});

test('popular suggestions include large photo clusters without a saved place', () => {
  const savedPlace = {
    id: 'saved-place',
    name: 'Сохранённое место',
    latitude: 41.7151,
    longitude: 44.8271
  };
  const savedPlacePhotos = Array.from({ length: 64 }, (_, index) => ({
    id: `saved-${index}`,
    date: '2024-01-01',
    latitude: savedPlace.latitude,
    longitude: savedPlace.longitude
  }));
  const frequentPhotos = Array.from({ length: 320 }, (_, index) => ({
    id: `frequent-${index}`,
    date: '2025-01-01',
    latitude: 55.74062,
    longitude: 37.6214,
    locationPlace: 'Дом',
    locationCountry: 'Россия'
  }));

  assert.deepEqual(
    referencePlaceSuggestions(
      [savedPlace],
      [...savedPlacePhotos, ...frequentPhotos],
      2
    ).popular.map(({ place, photoCount }) => ({
      id: place.id,
      name: place.name,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      photoCount
    })),
    [{
      id: undefined,
      name: 'Дом',
      country: 'Россия',
      latitude: 55.74062,
      longitude: 37.6214,
      photoCount: 320
    }, {
      id: 'saved-place',
      name: 'Сохранённое место',
      country: undefined,
      latitude: 41.7151,
      longitude: 44.8271,
      photoCount: 64
    }]
  );
});

test('photo stacks include every photo below the preview limit', () => {
  const sameLocation = [
    {
      id: 'reference',
      latitude: 55.7558,
      longitude: 37.6173,
      mapPointType: 'reference'
    },
    {
      id: 'older',
      date: '2024-01-01',
      latitude: 55.7558,
      longitude: 37.6173,
      mapPointType: 'photo',
      thumbnailSrc: '/older.jpg'
    },
    {
      id: 'newer',
      date: '2025-01-01',
      latitude: 55.7558,
      longitude: 37.6173,
      mapPointType: 'photo',
      thumbnailSrc: '/newer.jpg'
    },
    {
      id: 'newest',
      date: '2026-01-01',
      latitude: 55.7558,
      longitude: 37.6173,
      mapPointType: 'photo',
      thumbnailSrc: '/newest.jpg'
    },
    {
      id: 'extra',
      date: '2023-01-01',
      latitude: 55.7558,
      longitude: 37.6173,
      mapPointType: 'photo',
      thumbnailSrc: '/extra.jpg'
    }
  ];
  assert.deepEqual(
    photoStackPoints(sameLocation).map((point) => point.id),
    ['newest', 'newer', 'older', 'extra']
  );
  assert.deepEqual(photoStackPoints(sameLocation.slice(0, 2)), []);
  assert.deepEqual(
    photoStackPoints([
      ...sameLocation.slice(0, 3),
      {
        id: 'nearby',
        date: '2026-02-01',
        latitude: 55.7568,
        longitude: 37.6173,
        mapPointType: 'photo',
        thumbnailSrc: '/nearby.jpg'
      }
    ]).map((point) => point.id),
    ['nearby', 'newer', 'older']
  );
});

test('photo stacks show at most 30 randomly selected photos without duplicates', () => {
  const photos = Array.from({ length: 40 }, (_, index) => ({
    id: `photo-${index}`,
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    latitude: 55.7558,
    longitude: 37.6173,
    mapPointType: 'photo',
    thumbnailSrc: `/photo-${index}.jpg`
  }));

  const firstSample = photoStackPoints(photos, () => 0);
  const lastSample = photoStackPoints(photos, () => 0.999999);

  assert.equal(firstSample.length, 30);
  assert.equal(new Set(firstSample.map((photo) => photo.id)).size, 30);
  assert.notDeepEqual(
    firstSample.map((photo) => photo.id),
    lastSample.map((photo) => photo.id)
  );
});

test('photo fan uses exact circular sectors and additional rings without dropping photos', () => {
  const fivePhotoFan = Array.from({ length: 5 }, (_, index) => photoFanLayout(5, index));
  const radii = fivePhotoFan.map(({ x, y }) => Math.hypot(x, y));
  assert.ok(radii.every((radius) => Math.abs(radius - 124) < 1e-8));
  assert.ok(fivePhotoFan[0].x < fivePhotoFan[1].x);
  assert.ok(Math.abs(fivePhotoFan[2].x) < 1e-8);
  assert.ok(fivePhotoFan[4].x > fivePhotoFan[3].x);

  const fifteenPhotoFan = Array.from({ length: 15 }, (_, index) => photoFanLayout(15, index));
  assert.equal(fifteenPhotoFan.length, 15);
  assert.deepEqual(new Set(fifteenPhotoFan.map(({ ring }) => ring)), new Set([0, 1]));
  assert.ok(fifteenPhotoFan.every(({ x, y, angle }) => (
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(angle)
  )));
});
