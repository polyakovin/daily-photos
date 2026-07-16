const UPDATE_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const INITIAL_UPDATE_CHECK_DELAY_MS = 15 * 1000;

function nextUpdateCheckDelay(lastCheckAt, now = Date.now()) {
  if (!Number.isFinite(lastCheckAt) || lastCheckAt <= 0) {
    return INITIAL_UPDATE_CHECK_DELAY_MS;
  }
  const remaining = lastCheckAt + UPDATE_CHECK_INTERVAL_MS - now;
  return Math.min(
    UPDATE_CHECK_INTERVAL_MS,
    Math.max(INITIAL_UPDATE_CHECK_DELAY_MS, remaining)
  );
}

function createUpdateManager({
  app,
  autoUpdater,
  dialog,
  getWindow,
  getLastCheckAt,
  setLastCheckAt,
  logger = console,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout
}) {
  let started = false;
  let checkInProgress = false;
  let manualCheckInProgress = false;
  let updatePromptInProgress = false;
  let restartPromptInProgress = false;
  let nextCheckTimer = null;

  function showMessage(options) {
    const window = getWindow();
    return window && !window.isDestroyed()
      ? dialog.showMessageBox(window, options)
      : dialog.showMessageBox(options);
  }

  async function showUpdateError(error) {
    await showMessage({
      type: 'error',
      title: 'Не удалось обновить приложение',
      message: 'Проверка или загрузка обновления завершилась с ошибкой.',
      detail: error?.message || String(error)
    });
  }

  function scheduleNextCheck() {
    if (!started || !app.isPackaged) return;
    if (nextCheckTimer) clearTimer(nextCheckTimer);
    const delay = nextUpdateCheckDelay(getLastCheckAt(), now());
    nextCheckTimer = setTimer(() => {
      nextCheckTimer = null;
      void checkForUpdates(false);
    }, delay);
    nextCheckTimer.unref?.();
  }

  async function handleUpdateAvailable(info) {
    if (updatePromptInProgress) return;
    updatePromptInProgress = true;
    try {
      const result = await showMessage({
        type: 'info',
        title: 'Доступно обновление',
        message: `Доступна новая версия «Фото дня» — ${info.version}.`,
        detail: 'Скачать обновление сейчас? Во время загрузки можно продолжать пользоваться приложением.',
        buttons: ['Скачать', 'Позже'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (result.response !== 0) return;
      try {
        await autoUpdater.downloadUpdate();
      } catch (error) {
        logger.error(`Не удалось загрузить обновление: ${error.message}`);
        await showUpdateError(error);
      }
    } finally {
      updatePromptInProgress = false;
    }
  }

  async function handleUpdateDownloaded(info) {
    if (restartPromptInProgress) return;
    restartPromptInProgress = true;
    try {
      const result = await showMessage({
        type: 'info',
        title: 'Обновление готово',
        message: `Версия ${info.version} загружена и готова к установке.`,
        detail: 'Перезапустить «Фото дня» сейчас? Если выбрать «Позже», обновление установится после выхода из приложения.',
        buttons: ['Перезапустить', 'Позже'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (result.response === 0) autoUpdater.quitAndInstall(false, true);
    } finally {
      restartPromptInProgress = false;
    }
  }

  const onUpdateAvailable = (info) => {
    void handleUpdateAvailable(info).catch(onUpdaterError);
  };
  const onUpdateNotAvailable = () => {
    if (!manualCheckInProgress) return;
    void showMessage({
      type: 'info',
      title: 'Обновлений нет',
      message: 'У вас установлена последняя версия «Фото дня».',
      detail: `Текущая версия — ${app.getVersion()}.`
    }).catch(onUpdaterError);
  };
  const onUpdateDownloaded = (info) => {
    void handleUpdateDownloaded(info).catch(onUpdaterError);
  };
  const onUpdaterError = (error) => {
    logger.error(`Ошибка автоматического обновления: ${error.message}`);
  };

  async function checkForUpdates(manual) {
    if (!app.isPackaged) {
      if (manual) {
        await showMessage({
          type: 'info',
          title: 'Проверка обновлений',
          message: 'Проверка обновлений доступна только в установленной версии приложения.'
        });
      }
      return false;
    }
    if (checkInProgress || updatePromptInProgress || restartPromptInProgress) {
      if (manual) {
        await showMessage({
          type: 'info',
          title: 'Проверка обновлений',
          message: 'Обновление уже проверяется или устанавливается.'
        });
      }
      return false;
    }

    checkInProgress = true;
    manualCheckInProgress = manual;
    const checkedAt = now();
    try {
      try {
        setLastCheckAt(checkedAt);
      } catch (error) {
        logger.error(`Не удалось сохранить дату проверки обновлений: ${error.message}`);
      }
      await autoUpdater.checkForUpdates();
      return true;
    } catch (error) {
      if (manual) await showUpdateError(error);
      return false;
    } finally {
      checkInProgress = false;
      manualCheckInProgress = false;
      scheduleNextCheck();
    }
  }

  function start() {
    if (started) return;
    started = true;
    if (!app.isPackaged) return;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on('update-available', onUpdateAvailable);
    autoUpdater.on('update-not-available', onUpdateNotAvailable);
    autoUpdater.on('update-downloaded', onUpdateDownloaded);
    autoUpdater.on('error', onUpdaterError);
    scheduleNextCheck();
  }

  function stop() {
    started = false;
    if (nextCheckTimer) clearTimer(nextCheckTimer);
    nextCheckTimer = null;
  }

  return {
    start,
    stop,
    checkNow: () => checkForUpdates(true)
  };
}

module.exports = {
  INITIAL_UPDATE_CHECK_DELAY_MS,
  UPDATE_CHECK_INTERVAL_MS,
  createUpdateManager,
  nextUpdateCheckDelay
};
