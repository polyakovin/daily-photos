const assert = require('node:assert/strict');
const test = require('node:test');
const {
  clusterProjectedPoints,
  linkedReferencePlaces,
  normalizeCoordinates,
  normalizeLongitude,
  parseCoordinateQuery,
  photoFanLayout,
  photoStackPoints,
  project,
  referencePlaceSuggestions,
  unproject,
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
