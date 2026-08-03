const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createDiaryAutosave,
  diaryDraftChanged,
  DIARY_AUTOSAVE_INTERVAL_MS
} = require('../src/renderer/diary-editor');

test('редактор отличает сохранённый текст от изменённого', () => {
  assert.equal(diaryDraftChanged('# День', '# День'), false);
  assert.equal(diaryDraftChanged('# Новый день', '# День'), true);
  assert.equal(diaryDraftChanged('', null), false);
});

test('автосохранение запускается каждые десять секунд и останавливается при выходе', () => {
  const scheduled = [];
  const cleared = [];
  let saves = 0;
  const scheduler = {
    setInterval(callback, delay) {
      const timer = { callback, delay };
      scheduled.push(timer);
      return timer;
    },
    clearInterval(timer) {
      cleared.push(timer);
    }
  };
  const autosave = createDiaryAutosave(() => { saves += 1; }, scheduler);

  autosave.start();
  assert.equal(autosave.active, true);
  assert.equal(scheduled[0].delay, DIARY_AUTOSAVE_INTERVAL_MS);
  assert.equal(DIARY_AUTOSAVE_INTERVAL_MS, 10_000);
  scheduled[0].callback();
  assert.equal(saves, 1);

  autosave.start();
  assert.deepEqual(cleared, [scheduled[0]]);
  autosave.stop();
  assert.deepEqual(cleared, [scheduled[0], scheduled[1]]);
  assert.equal(autosave.active, false);
});
