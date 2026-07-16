const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calculateLifeRange,
  filterLifePhotoEntries
} = require('../src/renderer/life-range');

test('без оставшейся жизни диапазон заканчивается сегодняшним днём', () => {
  const birthDate = new Date(1944, 6, 16);
  const today = new Date(2026, 6, 16);
  const range = calculateLifeRange(birthDate, today, false);

  assert.equal(range.ageYears, 82);
  assert.equal(range.horizonAgeYears, 82);
  assert.equal(range.totalDays, range.todayIndex + 1);
});

test('оставшаяся жизнь показывает минимум до 80 лет и минимум 20 будущих лет', () => {
  const youngRange = calculateLifeRange(
    new Date(1981, 6, 16),
    new Date(2026, 6, 16),
    true
  );
  const age65Range = calculateLifeRange(
    new Date(1961, 6, 16),
    new Date(2026, 6, 16),
    true
  );
  const age82Range = calculateLifeRange(
    new Date(1944, 6, 16),
    new Date(2026, 6, 16),
    true
  );

  assert.equal(youngRange.horizonAgeYears, 80);
  assert.equal(age65Range.horizonAgeYears, 85);
  assert.equal(age82Range.horizonAgeYears, 102);
});

test('фотографии после восьмидесятилетия не отбрасываются', () => {
  const entries = [
    ['1943-07-16', ['до рождения']],
    ['2024-07-16', ['80 лет']],
    ['2026-07-16', ['82 года']]
  ];

  assert.deepEqual(
    filterLifePhotoEntries(entries, new Date(1944, 6, 16)),
    entries.slice(1)
  );
});
