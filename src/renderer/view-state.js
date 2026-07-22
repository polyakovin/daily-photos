(function exposePhotoDayViewState(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhotoDayViewState = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const STORAGE_KEY = 'photo-day:view-state';
  const DATE_KEY_PATTERN = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
  const VIEWS = new Set(['calendar', 'timeline', 'life', 'random']);
  const CALENDAR_FOCUSES = new Set(['years', 'year', 'month', 'week']);

  function normalizeDateKey(value) {
    if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
      ? value
      : null;
  }

  function normalizeProgress(value) {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
  }

  function normalizeViewer(value) {
    const date = normalizeDateKey(value?.date);
    if (!date) return null;
    return {
      date,
      diaryVisible: value?.diaryVisible === true,
      photoId: typeof value?.photoId === 'string' && value.photoId ? value.photoId : null
    };
  }

  function normalizeViewState(value) {
    const calendarDate = normalizeDateKey(value?.calendar?.date);
    const timelineDate = normalizeDateKey(value?.timeline?.date);
    return {
      version: 1,
      updatedAt: Number.isFinite(value?.updatedAt) && value.updatedAt > 0 ? value.updatedAt : 0,
      view: VIEWS.has(value?.view) ? value.view : 'calendar',
      calendar: {
        focus: CALENDAR_FOCUSES.has(value?.calendar?.focus) ? value.calendar.focus : 'month',
        date: calendarDate
      },
      timeline: {
        date: timelineDate,
        progress: normalizeProgress(value?.timeline?.progress)
      },
      viewer: normalizeViewer(value?.viewer)
    };
  }

  function readViewState(storage) {
    try {
      const rawValue = storage?.getItem(STORAGE_KEY);
      return rawValue ? normalizeViewState(JSON.parse(rawValue)) : normalizeViewState(null);
    } catch {
      return normalizeViewState(null);
    }
  }

  function storeViewState(storage, value) {
    const state = normalizeViewState(value);
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Состояние остаётся доступно в памяти до следующей перезагрузки.
    }
    return state;
  }

  function newestViewState(...values) {
    return values
      .filter(Boolean)
      .map(normalizeViewState)
      .reduce((newest, candidate) => (
        candidate.updatedAt > newest.updatedAt ? candidate : newest
      ), normalizeViewState(null));
  }

  return {
    CALENDAR_FOCUSES,
    STORAGE_KEY,
    VIEWS,
    newestViewState,
    normalizeDateKey,
    normalizeViewState,
    readViewState,
    storeViewState
  };
}));
