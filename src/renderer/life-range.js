(function exposeLifeRange(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhotoDayLifeRange = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const MIN_LIFESPAN_YEARS = 80;
  const MIN_REMAINING_YEARS = 20;

  function utcDayNumber(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function completedYears(birthDate, currentDate) {
    let years = currentDate.getFullYear() - birthDate.getFullYear();
    if (currentDate.getMonth() < birthDate.getMonth()
      || (currentDate.getMonth() === birthDate.getMonth()
        && currentDate.getDate() < birthDate.getDate())) {
      years -= 1;
    }
    return Math.max(0, years);
  }

  function calculateLifeRange(birthDate, currentDate, showRemainingLife = false) {
    const todayIndex = utcDayNumber(currentDate) - utcDayNumber(birthDate);
    const ageYears = completedYears(birthDate, currentDate);
    if (!showRemainingLife) {
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 1);
      return {
        ageYears,
        endDate,
        horizonAgeYears: ageYears,
        todayIndex,
        totalDays: Math.max(1, todayIndex + 1)
      };
    }

    const horizonAgeYears = Math.max(
      MIN_LIFESPAN_YEARS,
      ageYears + MIN_REMAINING_YEARS
    );
    const endDate = new Date(birthDate);
    endDate.setFullYear(birthDate.getFullYear() + horizonAgeYears);
    return {
      ageYears,
      endDate,
      horizonAgeYears,
      todayIndex,
      totalDays: Math.max(
        todayIndex + 1,
        utcDayNumber(endDate) - utcDayNumber(birthDate)
      )
    };
  }

  function parseDateKey(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function filterLifePhotoEntries(entries, birthDate) {
    const birthDay = utcDayNumber(birthDate);
    return entries.filter(([value]) => utcDayNumber(parseDateKey(value)) >= birthDay);
  }

  return {
    MIN_LIFESPAN_YEARS,
    MIN_REMAINING_YEARS,
    calculateLifeRange,
    completedYears,
    filterLifePhotoEntries
  };
}));
