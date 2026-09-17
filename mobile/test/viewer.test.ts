import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatViewerDate,
  moveViewerMetadata,
  normalizePlaceSearchResults,
  normalizeViewerMetadata,
  parseCoordinateQuery,
  parseViewerDate,
  retargetPhotoPath
} from '../src/viewer.ts';

test('formats the viewer date with a Russian month name', () => {
  assert.equal(formatViewerDate('2026-08-12'), '12 августа 2026г.');
  assert.equal(formatViewerDate('2024-07-05'), '5 июля 2024г.');
  assert.equal(formatViewerDate('unknown'), 'unknown');
});

test('parses desktop and mobile viewer date input without accepting future dates', () => {
  assert.equal(parseViewerDate('21.07.2024'), '2024-07-21');
  assert.equal(parseViewerDate('2024-7-5'), '2024-07-05');
  assert.equal(parseViewerDate('31.02.2024'), null);
  assert.equal(parseViewerDate('2099-01-01'), null);
});

test('accepts coordinates and sanitizes place-search results', () => {
  assert.deepEqual(parseCoordinateQuery('55,75; 37,61'), { latitude: 55.75, longitude: 37.61 });
  assert.equal(parseCoordinateQuery('95, 37'), null);
  assert.deepEqual(normalizePlaceSearchResults([
    { lat: '55.75', lon: '37.61', display_name: ' Москва ', osm_type: 'relation', osm_id: 1 },
    { lat: 'invalid', lon: '37.61', display_name: 'Ошибка' }
  ]), [{
    id: 'relation:1',
    label: 'Москва',
    latitude: 55.75,
    longitude: 37.61,
    place: 'Москва'
  }]);
});

test('retargets common portable archive layouts without stacking date prefixes', () => {
  assert.equal(retargetPhotoPath('2024/07/21 Summer.jpg', '2024-08-03'), '2024/08/03 Summer.jpg');
  assert.equal(retargetPhotoPath('2024/07/21.jpg', '2024-08-03'), '2024/08/03.jpg');
  assert.equal(retargetPhotoPath('family/2024-07-21 Summer.jpg', '2024-08-03'), 'family/2024-08-03 Summer.jpg');
  assert.equal(retargetPhotoPath('family/Summer.jpg', '2024-08-03'), 'family/2024-08-03 Summer.jpg');
});

test('moves portable viewer metadata together with a dated photo', () => {
  const next = moveViewerMetadata(normalizeViewerMetadata({
    blurDates: ['2024-07-21'],
    diaries: { '2024-07-21': 'day note' },
    highlights: {
      months: { '2024-07': '2024-07-21' },
      years: { '2024': '2024-07-21' }
    },
    locations: {
      '2024/07/21 Summer.jpg': { latitude: 55.75, longitude: 37.61, place: 'Москва' }
    }
  }), '2024/07/21 Summer.jpg', '2024/08/03 Summer.jpg', '2024-07-21', '2024-08-03');

  assert.deepEqual(next.blurDates, ['2024-08-03']);
  assert.deepEqual(next.highlights.months, { '2024-08': '2024-08-03' });
  assert.deepEqual(next.highlights.years, { '2024': '2024-08-03' });
  assert.equal(next.locations['2024/08/03 Summer.jpg'].place, 'Москва');
  assert.equal(next.locations['2024/07/21 Summer.jpg'], undefined);
  assert.equal(next.diaries['2024-07-21'], 'day note');
});

test('keeps date-level metadata when moving a non-preferred alternative', () => {
  const next = moveViewerMetadata(normalizeViewerMetadata({
    blurDates: ['2024-07-21'],
    highlights: {
      months: { '2024-07': '2024-07-21' },
      years: { '2024': '2024-07-21' }
    }
  }), '2024/07/21 second.jpg', '2024/08/03 second.jpg', '2024-07-21', '2024-08-03', {
    moveBlurDate: false,
    moveHighlights: false
  });

  assert.deepEqual(next.blurDates, ['2024-07-21']);
  assert.deepEqual(next.highlights.months, { '2024-07': '2024-07-21' });
  assert.deepEqual(next.highlights.years, { '2024': '2024-07-21' });
});
