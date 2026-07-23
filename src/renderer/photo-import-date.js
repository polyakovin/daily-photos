(function exposePhotoImportDate(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhotoDayImportDate = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const SUPPORTED_FOCUSES = new Set(['year', 'month', 'week']);

  function startOfDay(value) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  function dateKey(value) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }

  function periodBounds(focus, visibleDate) {
    const year = visibleDate.getFullYear();
    const month = visibleDate.getMonth();
    if (focus === 'year') {
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31)
      };
    }
    if (focus === 'month') {
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0)
      };
    }
    const start = startOfDay(visibleDate);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  }

  function suggestCalendarImportDate({
    view,
    focus,
    visibleDate,
    occupiedDates,
    today = new Date()
  } = {}) {
    if (view !== 'calendar' || !SUPPORTED_FOCUSES.has(focus) || !(visibleDate instanceof Date)) {
      return null;
    }

    const todayStart = startOfDay(today);
    const { start, end } = periodBounds(focus, visibleDate);
    const lastAvailableDay = end < todayStart ? end : todayStart;
    if (lastAvailableDay < start) return null;

    const occupied = occupiedDates instanceof Set
      ? occupiedDates
      : new Set(occupiedDates || []);
    for (
      const candidate = new Date(lastAvailableDay);
      candidate >= start;
      candidate.setDate(candidate.getDate() - 1)
    ) {
      const candidateKey = dateKey(candidate);
      if (!occupied.has(candidateKey)) return candidateKey;
    }
    return null;
  }

  return {
    SUPPORTED_FOCUSES,
    periodBounds,
    suggestCalendarImportDate
  };
}));
