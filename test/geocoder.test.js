const assert = require('node:assert/strict');
const test = require('node:test');
const {
  USER_AGENT,
  createPlaceSearch,
  normalizeSearchQuery,
  normalizeSearchResults
} = require('../src/server/geocoder');

test('geocoder validates queries and sanitizes Nominatim results', () => {
  assert.equal(normalizeSearchQuery('  Красная   площадь  '), 'Красная площадь');
  assert.equal(normalizeSearchQuery('x'), null);
  assert.equal(normalizeSearchQuery('x'.repeat(201)), null);
  assert.match(USER_AGENT, /^PhotoDayCalendar\/\d+\.\d+\.\d+/);

  assert.deepEqual(normalizeSearchResults([
    {
      osm_type: 'way',
      osm_id: 123,
      lat: '55.7539',
      lon: '37.6208',
      display_name: 'Красная площадь, Москва, Россия',
      category: 'place',
      type: 'square',
      boundingbox: ['55.752', '55.755', '37.618', '37.623'],
      address: { country: 'Россия' }
    },
    { lat: '500', lon: '37', display_name: 'Неверная точка' }
  ]), [{
    id: 'way:123',
    latitude: 55.7539,
    longitude: 37.6208,
    displayName: 'Красная площадь, Москва, Россия',
    country: 'Россия',
    category: 'place',
    type: 'square',
    boundingBox: {
      south: 55.752,
      north: 55.755,
      west: 37.618,
      east: 37.623
    }
  }]);
});

test('geocoder caches exact requests and keeps remote calls one second apart', async () => {
  let clock = 1000;
  const waits = [];
  const calls = [];
  const searchPlaces = createPlaceSearch({
    requestSearch: async (query) => {
      calls.push(query);
      return [{ displayName: query }];
    },
    now: () => clock,
    wait: async (milliseconds) => {
      waits.push(milliseconds);
      clock += milliseconds;
    }
  });

  assert.deepEqual(await searchPlaces('Москва'), [{ displayName: 'Москва' }]);
  assert.deepEqual(await searchPlaces('  москва  '), [{ displayName: 'Москва' }]);
  assert.deepEqual(await searchPlaces('Тбилиси'), [{ displayName: 'Тбилиси' }]);
  assert.deepEqual(calls, ['Москва', 'Тбилиси']);
  assert.deepEqual(waits, [1000]);
});
