const https = require('https');
const { version } = require('../../package.json');

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = `PhotoDayCalendar/${version} (+https://github.com/polyakovin/daily-photos)`;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function normalizeSearchQuery(value) {
  if (typeof value !== 'string') return null;
  const query = value.trim().replace(/\s+/g, ' ');
  return query.length >= 2 && query.length <= 200 ? query : null;
}

function validCoordinate(value, minimum, maximum) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

function normalizeBoundingBox(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const south = validCoordinate(value[0], -90, 90);
  const north = validCoordinate(value[1], -90, 90);
  const west = validCoordinate(value[2], -180, 180);
  const east = validCoordinate(value[3], -180, 180);
  return [south, north, west, east].every((coordinate) => coordinate !== null)
    ? { south, north, west, east }
    : null;
}

function normalizeSearchResults(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).flatMap((result, index) => {
    const latitude = validCoordinate(result?.lat, -90, 90);
    const longitude = validCoordinate(result?.lon, -180, 180);
    const displayName = typeof result?.display_name === 'string'
      ? result.display_name.trim().slice(0, 500)
      : '';
    if (latitude === null || longitude === null || !displayName) return [];
    const address = result.address && typeof result.address === 'object' ? result.address : {};
    return [{
      id: `${result.osm_type || 'place'}:${result.osm_id || result.place_id || index}`,
      latitude,
      longitude,
      displayName,
      country: typeof address.country === 'string' ? address.country.slice(0, 120) : null,
      category: typeof result.category === 'string' ? result.category.slice(0, 80) : null,
      type: typeof result.type === 'string' ? result.type.slice(0, 80) : null,
      boundingBox: normalizeBoundingBox(result.boundingbox)
    }];
  });
}

function requestNominatim(query) {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');
  url.searchParams.set('accept-language', 'ru,en');

  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ru,en;q=0.8',
        Referer: 'https://polyakovin.github.io/daily-photos/',
        'User-Agent': USER_AGENT
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Сервис поиска вернул код ${response.statusCode}`));
        return;
      }
      response.setEncoding('utf8');
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_RESPONSE_BYTES) request.destroy(new Error('Слишком большой ответ поиска'));
      });
      response.on('end', () => {
        try {
          resolve(normalizeSearchResults(JSON.parse(body)));
        } catch {
          reject(new Error('Сервис поиска вернул неверный ответ'));
        }
      });
    });
    request.setTimeout(10000, () => request.destroy(new Error('Поиск места не ответил вовремя')));
    request.on('error', reject);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createPlaceSearch({
  requestSearch = requestNominatim,
  now = Date.now,
  wait = delay,
  minimumInterval = 1000,
  maximumCacheSize = 100
} = {}) {
  const cache = new Map();
  let queue = Promise.resolve();
  let lastRequestAt = Number.NEGATIVE_INFINITY;

  return function searchPlaces(value) {
    const query = normalizeSearchQuery(value);
    if (!query) return Promise.reject(new Error('Введите не менее двух символов'));
    const cacheKey = query.toLocaleLowerCase('ru-RU');
    if (cache.has(cacheKey)) return Promise.resolve(cache.get(cacheKey));

    const run = async () => {
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const waitTime = Math.max(0, minimumInterval - (now() - lastRequestAt));
      if (waitTime) await wait(waitTime);
      lastRequestAt = now();
      const results = await requestSearch(query);
      cache.set(cacheKey, results);
      while (cache.size > maximumCacheSize) cache.delete(cache.keys().next().value);
      return results;
    };
    const result = queue.then(run, run);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
}

module.exports = {
  NOMINATIM_ENDPOINT,
  USER_AGENT,
  createPlaceSearch,
  normalizeBoundingBox,
  normalizeSearchQuery,
  normalizeSearchResults,
  requestNominatim
};
