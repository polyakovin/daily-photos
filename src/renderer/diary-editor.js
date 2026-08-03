(function exposePhotoDayDiaryEditor(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  root.PhotoDayDiaryEditor = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const DIARY_AUTOSAVE_INTERVAL_MS = 10_000;

  function diaryDraftChanged(content, savedContent) {
    return String(content || '') !== String(savedContent || '');
  }

  function createDiaryAutosave(save, scheduler = globalThis) {
    if (typeof save !== 'function') throw new TypeError('Diary autosave requires a save callback');
    let timer = null;

    const stop = () => {
      if (timer === null) return;
      scheduler.clearInterval(timer);
      timer = null;
    };

    return {
      get active() {
        return timer !== null;
      },
      start() {
        stop();
        timer = scheduler.setInterval(save, DIARY_AUTOSAVE_INTERVAL_MS);
      },
      stop
    };
  }

  return {
    createDiaryAutosave,
    diaryDraftChanged,
    DIARY_AUTOSAVE_INTERVAL_MS
  };
}));
