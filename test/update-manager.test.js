const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const {
  INITIAL_UPDATE_CHECK_DELAY_MS,
  UPDATE_CHECK_INTERVAL_MS,
  createUpdateManager,
  nextUpdateCheckDelay
} = require('../src/electron/update-manager');

const DAY_MS = 24 * 60 * 60 * 1000;

function createHarness({ packaged = true, now = 1_800_000_000_000 } = {}) {
  const messages = [];
  const timers = [];
  const updater = new EventEmitter();
  let lastCheckAt = 0;
  updater.checkForUpdates = async () => {
    updater.emit('update-not-available');
  };
  updater.downloadUpdate = async () => {};
  updater.quitAndInstall = () => {};

  const manager = createUpdateManager({
    app: {
      isPackaged: packaged,
      getVersion: () => '1.1.0'
    },
    autoUpdater: updater,
    dialog: {
      showMessageBox: async (options) => {
        messages.push(options);
        return { response: 1 };
      }
    },
    getWindow: () => null,
    getLastCheckAt: () => lastCheckAt,
    setLastCheckAt: (value) => { lastCheckAt = value; },
    logger: { error: () => {} },
    now: () => now,
    setTimer: (callback, delay) => {
      const timer = { callback, delay, unref: () => {} };
      timers.push(timer);
      return timer;
    },
    clearTimer: () => {}
  });

  return {
    getLastCheckAt: () => lastCheckAt,
    manager,
    messages,
    timers,
    updater
  };
}

test('первая автоматическая проверка планируется вскоре после запуска', () => {
  assert.equal(nextUpdateCheckDelay(0, 1_800_000_000_000), INITIAL_UPDATE_CHECK_DELAY_MS);
});

test('повторная автоматическая проверка выполняется через оставшуюся часть недели', () => {
  const now = 1_800_000_000_000;
  assert.equal(nextUpdateCheckDelay(now - (2 * DAY_MS), now), 5 * DAY_MS);
  assert.equal(nextUpdateCheckDelay(now, now), UPDATE_CHECK_INTERVAL_MS);
  assert.equal(nextUpdateCheckDelay(now + DAY_MS, now), UPDATE_CHECK_INTERVAL_MS);
});

test('ручная проверка сохраняет дату и сообщает, что обновлений нет', async () => {
  const harness = createHarness();
  harness.manager.start();

  assert.equal(harness.timers[0].delay, INITIAL_UPDATE_CHECK_DELAY_MS);
  assert.equal(await harness.manager.checkNow(), true);
  assert.equal(harness.getLastCheckAt(), 1_800_000_000_000);
  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].title, 'Обновлений нет');
  assert.equal(harness.timers.at(-1).delay, UPDATE_CHECK_INTERVAL_MS);

  harness.manager.stop();
});

test('в режиме разработки проверка не обращается к серверу обновлений', async () => {
  const harness = createHarness({ packaged: false });
  let checks = 0;
  harness.updater.checkForUpdates = async () => { checks += 1; };
  harness.manager.start();

  assert.equal(await harness.manager.checkNow(), false);
  assert.equal(checks, 0);
  assert.equal(harness.messages[0].title, 'Проверка обновлений');

  harness.manager.stop();
});
