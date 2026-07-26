const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildDateLocations,
  homeOfficeDateCandidates,
  locationReference,
  mediaDate,
  parseHomeOfficeLocations,
  parseKmlPlacemarks
} = require('../scripts/build-photo-geodata');

test('home-office travel locations expose dates only from dated media names', () => {
  const locations = parseHomeOfficeLocations(`
locations:
  - name: "Ереван"
    country: "Армения"
    location:
      - 40.177615
      - 44.512594
    visited: true
    media:
      - name: "2022-01-04 21-15-27.webp"
      - name: "Снимок экрана 2024-04-30.webp"
  - name: "Гарни"
    country: "Армения"
    location:
      - 40.12
      - 44.73
    media:
      - name: "2022-01-04 13-30-36.webp"
`);
  assert.equal(locations.length, 2);
  assert.equal(mediaDate('2022-01-04 21-15-27.webp'), '2022-01-04');
  assert.equal(mediaDate('Снимок экрана 2024-04-30.webp'), null);
  assert.deepEqual(
    homeOfficeDateCandidates(locations).get('2022-01-04').map((candidate) => candidate.name),
    ['Ереван', 'Гарни']
  );
});

test('location reference keeps all Obsidian places, including undated media and bare references', () => {
  const homeOfficeLocations = parseHomeOfficeLocations(`
locations:
  - name: "Тунис"
    country: "Тунис"
    location:
      - 36.8002
      - 10.185765
    visited: true
  - name: "Сус"
    country: "Тунис"
    location:
      - 35.82883
      - 10.640539
    media:
      - name: "P1300627.webp"
  - name: "Sidi Bou Saïd"
    country: "Тунис"
    location:
      - 36.871093
      - 10.349053
  `);
  const reference = locationReference(homeOfficeLocations, [], '2026-07-24T00:00:00.000Z');
  assert.equal(reference.places.length, 3);
  assert.deepEqual(
    reference.places.map(({ name, evidence }) => ({ name, evidence })),
    [
      { name: 'Тунис', evidence: 'visited' },
      { name: 'Сус', evidence: 'media' },
      { name: 'Sidi Bou Saïd', evidence: 'reference' }
    ]
  );
});

test('Organic Maps KML parser reads point names, dates, and longitude-first coordinates', () => {
  const places = parseKmlPlacemarks(`
    <kml><Document><Placemark>
      <name>Václavské náměstí</name>
      <TimeStamp><when>2018-07-04T20:26:57Z</when></TimeStamp>
      <Point><coordinates>14.429886,50.07948,0</coordinates></Point>
    </Placemark></Document></kml>
  `, 'Мои метки');
  assert.deepEqual(places, [{
    name: 'Václavské náměstí',
    latitude: 50.07948,
    longitude: 14.429886,
    observedAt: '2018-07-04',
    timestamp: '2018-07-04T20:26:57Z',
    collection: 'Мои метки'
  }]);
});

test('date matcher leaves ambiguous home-office dates unresolved without a decision', () => {
  const archiveDates = new Set(['2022-01-04', '2022-01-05']);
  const homeOfficeByDate = new Map([
    ['2022-01-04', [
      { name: 'Гарни', country: 'Армения', latitude: 40.12, longitude: 44.73 },
      { name: 'Ереван', country: 'Армения', latitude: 40.17, longitude: 44.51 }
    ]],
    ['2022-01-05', [
      { name: 'Ереван', country: 'Армения', latitude: 40.17, longitude: 44.51 }
    ]]
  ]);
  const organicByDate = new Map([
    ['2022-01-05', [{
      name: 'Ереван',
      latitude: 40.171,
      longitude: 44.511,
      observedAt: '2022-01-05'
    }]]
  ]);

  const unresolved = buildDateLocations({
    archiveDates,
    homeOfficeByDate,
    organicByDate
  });
  assert.deepEqual(unresolved.ambiguous['2022-01-04'], ['Гарни', 'Ереван']);
  assert.equal(unresolved.locations.get('2022-01-05').source, 'home-office+organic-maps');

  const resolved = buildDateLocations({
    archiveDates,
    homeOfficeByDate,
    organicByDate,
    decisions: { '2022-01-04': 'Гарни' }
  });
  assert.equal(resolved.locations.get('2022-01-04').place, 'Гарни');

  const visuallyResolved = buildDateLocations({
    archiveDates,
    homeOfficeByDate,
    organicByDate,
    decisions: {
      '2022-01-04': {
        place: 'Точка на фотографии',
        latitude: 40.1,
        longitude: 44.7,
        source: 'photo'
      }
    }
  });
  assert.equal(visuallyResolved.locations.get('2022-01-04').source, 'photo');
  assert.equal(visuallyResolved.counts.reviewedMatches, 1);
});
