import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildArchiveMapGroups,
  buildArchiveOverviewMapHtml,
  buildMiniMapTiles,
  buildPhotoLocationMapHtml,
  clusterArchiveMapGroups
} from '../src/map.ts';

const photos = [
  { date: '2024-01-01', name: 'a.jpg', relativePath: '2024/01/01 a.jpg', uri: 'file:///a.jpg' },
  { date: '2024-01-02', name: 'b.jpg', relativePath: '2024/01/02 b.jpg', uri: 'file:///b.jpg' },
  { date: '2024-01-03', name: 'c.jpg', relativePath: '2024/01/03 c.jpg', uri: 'file:///c.jpg' }
];

test('builds map groups only for photos with valid coordinates', () => {
  const groups = buildArchiveMapGroups(photos, {
    '2024/01/01 a.jpg': { latitude: 55.751241, longitude: 37.618421, place: 'Москва' },
    '2024/01/02 b.jpg': { latitude: 55.751244, longitude: 37.618424 },
    '2024/01/03 c.jpg': { latitude: 120, longitude: 37.6 },
    'missing.jpg': { latitude: 59.93, longitude: 30.31 }
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'Москва');
  assert.deepEqual(groups[0].photos.map((photo) => photo.name), ['a.jpg', 'b.jpg']);
  assert.equal(groups[0].latitude, (55.751241 + 55.751244) / 2);
  assert.equal(groups[0].longitude, (37.618421 + 37.618424) / 2);
});

test('keeps distinct places separate and supplies a coordinate label', () => {
  const groups = buildArchiveMapGroups(photos.slice(0, 2), {
    '2024/01/01 a.jpg': { latitude: 0, longitude: -0.000001 },
    '2024/01/02 b.jpg': { latitude: 1, longitude: 2, country: 'Россия' }
  });

  assert.deepEqual(groups.map((group) => group.label), ['0.0000, -0.0000', 'Россия']);
  assert.deepEqual(groups.map((group) => group.photos.length), [1, 1]);
});

test('rejects unsafe grouping precision', () => {
  assert.throws(() => buildArchiveMapGroups([], {}, 9), /от 0 до 8/);
});

test('clusters map markers on the same stable world grid as the desktop app', () => {
  const groups = buildArchiveMapGroups(photos, {
    '2024/01/01 a.jpg': { latitude: 55.7558, longitude: 37.6173 },
    '2024/01/02 b.jpg': { latitude: 55.75581, longitude: 37.61731 },
    '2024/01/03 c.jpg': { latitude: 41.7151, longitude: 44.8271 }
  });

  const first = clusterArchiveMapGroups(groups, 8);
  const second = clusterArchiveMapGroups(groups, 8);
  assert.deepEqual(
    first.map((cluster) => [cluster.key, cluster.groups.map((group) => group.id)]),
    second.map((cluster) => [cluster.key, cluster.groups.map((group) => group.id)])
  );
  assert.equal(first.length, 2);
  assert.equal(
    first.find((cluster) => cluster.groups.some((group) => group.id.startsWith('55.7558')))
      ?.photoCount,
    2
  );
});

test('builds self-contained mini-map tiles around a photo coordinate', () => {
  const tiles = buildMiniMapTiles(
    { latitude: 59.9343, longitude: 30.3351 },
    128,
    92,
    12
  );
  assert.ok(tiles.length >= 1 && tiles.length <= 4);
  assert.ok(tiles.every((tile) => (
    /^https:\/\/tile\.openstreetmap\.org\/12\/\d+\/\d+\.png$/.test(tile.url)
    && Number.isFinite(tile.left)
    && Number.isFinite(tile.top)
  )));
});

test('mini-map tiles reject invalid locations and unsafe zoom', () => {
  assert.deepEqual(buildMiniMapTiles(
    { latitude: 120, longitude: 30 },
    128,
    92
  ), []);
  assert.throws(() => buildMiniMapTiles(
    { latitude: 59.9, longitude: 30.3 },
    128,
    92,
    20
  ), /от 0 до 19/);
});

test('overview map embeds the Leaflet layout styles needed by a WebView', () => {
  const html = buildArchiveOverviewMapHtml(buildArchiveMapGroups(photos.slice(0, 1), {
    '2024/01/01 a.jpg': { latitude: 55.751241, longitude: 37.618421 }
  }), {
    accent: '#28745c',
    emptyCell: '#edf3ef',
    mapTileFilter: 'none',
    muted: '#607068',
    onAccent: '#ffffff'
  });

  assert.doesNotMatch(html, /<link[^>]+leaflet[^>]+\.css/);
  assert.match(html, /\.leaflet-pane,\.leaflet-tile,\.leaflet-marker-icon/);
  assert.match(html, /\.leaflet-container\.leaflet-touch-drag\.leaflet-touch-zoom\{touch-action:none\}/);
  assert.match(html, /\.leaflet-zoom-anim \.leaflet-zoom-animated\{transition:transform \.25s/);
  assert.match(html, /"latitude":55\.751241/);
});

test('overview map keeps Leaflet synchronized with WebView layout changes', () => {
  const html = buildArchiveOverviewMapHtml([], {
    accent: '#28745c',
    emptyCell: '#edf3ef',
    mapTileFilter: 'none',
    muted: '#607068',
    onAccent: '#ffffff'
  });

  assert.match(html, /window\.__photoDayMapInvalidate=syncMapSize/);
  assert.match(html, /new ResizeObserver\(syncMapSize\)/);
  assert.match(html, /map\.invalidateSize\(\{animate:false,pan:false\}\)/);
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript);
  assert.doesNotThrow(() => new Function(inlineScript));
});

test('overview map renders only visible clusters after map movement', () => {
  const html = buildArchiveOverviewMapHtml([], {
    accent: '#28745c',
    emptyCell: '#edf3ef',
    mapTileFilter: 'none',
    muted: '#607068',
    onAccent: '#ffffff'
  });

  assert.match(html, /const markerNodes=new Map\(\)/);
  assert.match(html, /function clusterProjectedPoints\(zoom,cellSize\)/);
  assert.match(html, /map\.latLngToContainerPoint\(latLng\)/);
  assert.match(html, /map\.on\('moveend zoomend',scheduleMarkerRender\)/);
  assert.match(html, /markerFrame=requestAnimationFrame\(renderMarkers\)/);
  assert.match(html, /if\(!visibleKeys\.has\(key\)\)\{marker\.remove\(\);markerNodes\.delete\(key\)\}/);
  assert.doesNotMatch(html, /points\.forEach\(function\(point\)\{\s*const count=/);
});

test('photo location map opens interactively with its marker at the initial center', () => {
  const html = buildPhotoLocationMapHtml({
    latitude: 59.9343,
    longitude: 30.3351
  }, false, {
    accent: '#28745c',
    emptyCell: '#edf3ef',
    mapTileFilter: 'none',
    muted: '#607068',
    onAccent: '#ffffff'
  });

  assert.match(html, /setView\(\[59\.9343,30\.3351\],13\)/);
  assert.match(html, /L\.marker\(\[59\.9343,30\.3351\]/);
  assert.match(html, /zoomControl:true/);
  assert.doesNotMatch(html, /<link[^>]+leaflet[^>]+\.css/);
  assert.match(html, /\.leaflet-pane,\.leaflet-tile,\.leaflet-marker-icon/);
  assert.doesNotMatch(html, /dragging\.disable|touchZoom\.disable/);
  assert.doesNotMatch(html, /map\.on\('click'/);
});
