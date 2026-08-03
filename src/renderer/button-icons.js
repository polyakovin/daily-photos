(function exposePhotoDayButtonIcons(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  root.PhotoDayButtonIcons = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const ICONS = Object.freeze({
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    calendar: '<path d="M7 3v3M17 3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="M8 13h3v3H8z"/>',
    timeline: '<path d="M4 6h11M4 12h16M4 18h8"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>',
    map: '<path d="m3.5 6 5-2.5 7 3 5-2.5v14l-5 2.5-7-3-5 2.5Z"/><path d="M8.5 3.5v14M15.5 6.5v14"/>',
    life: '<path d="M4 13h3l2-6 4 11 2-5h5"/>',
    shuffle: '<path d="M4 7h3.5c4.5 0 5 10 9.5 10H20M17 4l3 3-3 3M4 17h3.5c1.4 0 2.4-1 3.2-2.3M15.3 9.3C16 8 16.8 7 18 7h2M17 14l3 3-3 3"/>',
    theme: '<path d="M12 3a9 9 0 1 0 0 18Z"/><path d="M12 3a9 9 0 0 1 0 18" opacity=".35"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 10.5v6"/><circle cx="12" cy="7.5" r=".7"/>',
    presentation: '<path d="M4 5h16v11H4Z"/><path d="m9 21 3-5 3 5M8 21h8"/>',
    years: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/>',
    year: '<path d="M7 3v3M17 3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="M8 13h2M14 13h2M8 17h2M14 17h2"/>',
    week: '<path d="M7 3v3M17 3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="M8 13h8M8 17h5"/>',
    target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    'chevron-left': '<path d="m15 5-7 7 7 7"/>',
    'chevron-right': '<path d="m9 5 7 7-7 7"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 0-6h2a3 3 0 0 0 3-3V8"/>',
    'pin-plus': '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/><path d="M19 3v5M16.5 5.5h5"/>',
    locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    play: '<path d="m8 5 11 7-11 7Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    places: '<path d="M10 9c0 3.5-5 8-5 8s-5-4.5-5-8a5 5 0 0 1 10 0Z" transform="translate(3 -2)"/><path d="M14 8.5h6M17 5.5v6"/>',
    skip: '<path d="m6 5 8 7-8 7ZM17 5v14"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
    pencil: '<path d="m4 20 4.2-1 10.7-10.7a2.2 2.2 0 0 0-3.2-3.2L5 15.8 4 20Z"/><path d="m14.5 6.3 3.2 3.2"/>',
    'image-plus': '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 4 4 2-2 5 5M17 6v6M14 9h6"/>',
    trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    'map-off': '<path d="m3.5 6 5-2.5 7 3 5-2.5v14l-5 2.5-7-3-5 2.5ZM8.5 3.5v14M15.5 6.5v14"/><path d="m3 3 18 18"/>',
    fullscreen: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
    'fullscreen-exit': '<path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/>',
    folder: '<path d="M3 6h7l2 2h9v11H3Z"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/><path d="M4 4v4.6h4.6M12 8v5l3 2"/>',
    note: '<path d="M6 3.5h9l3 3V20.5H6Z"/><path d="M15 3.5v3h3M9 10h6M9 14h6M9 18h4"/>',
    move: '<path d="M7 3v3M17 3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="m9 15 2 2 4-4"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 14v6h14v-6"/>',
    retry: '<path d="M20 7v5h-5M4 17v-5h5M18.5 10A7 7 0 0 0 6 7.5L4 12M5.5 14A7 7 0 0 0 18 16.5l2-4.5"/>',
    spinner: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/>'
  });

  const STATIC_BUTTONS = Object.freeze([
    ['#archiveSettingsButton', 'settings', 'Настройки источника фотографий'],
    ['[data-view="calendar"]', 'calendar', 'Календарь'],
    ['[data-view="timeline"]', 'timeline', 'Таймлайн'],
    ['[data-view="map"]', 'map', 'Карта'],
    ['[data-view="life"]', 'life', 'Жизнь'],
    ['[data-view="random"]', 'shuffle', 'Случайное фото'],
    ['#themeButton', 'theme', 'Изменить тему'],
    ['#aboutButton', 'info', 'О приложении'],
    ['#presentationButton', 'presentation', 'Включить режим презентации'],
    ['[data-calendar-focus="years"]', 'years', 'Все годы'],
    ['[data-calendar-focus="year"]', 'year', 'Год'],
    ['[data-calendar-focus="month"]', 'calendar', 'Месяц'],
    ['[data-calendar-focus="week"]', 'week', 'Неделя'],
    ['#todayButton', 'target', 'Сегодня'],
    ['#previousMonth', 'chevron-left', 'Предыдущий период'],
    ['#nextMonth', 'chevron-right', 'Следующий период'],
    ['#mapPlaybackButton', 'route', 'Анимация перемещений'],
    ['#mapAddPlaceButton', 'pin-plus', 'Добавить место'],
    ['#mapAssignButton', 'locate', 'Расставить фотографии без места'],
    ['#mapSearch button[type="submit"]', 'search', 'Найти место'],
    ['#mapZoomIn', 'plus', 'Приблизить карту'],
    ['#mapZoomOut', 'minus', 'Отдалить карту'],
    ['#mapPlaybackPlay', 'play', 'Запустить анимацию'],
    ['#mapPlaybackPrevious', 'chevron-left', 'Предыдущий день'],
    ['#mapPlaybackNext', 'chevron-right', 'Следующий день'],
    ['#mapPlaybackClose', 'close', 'Закрыть анимацию'],
    ['#mapAssignmentChoosePlace', 'places', 'Выбрать сохранённое место'],
    ['#mapAssignmentSkip', 'skip', 'Пропустить фотографию'],
    ['#mapAssignmentDone', 'check', 'Завершить расстановку'],
    ['#mapPlaceCancel', 'close', 'Отменить редактирование места'],
    ['#mapPlaceCancelSecondary', 'close', 'Отменить редактирование места'],
    ['#mapPlaceSave', 'check', 'Сохранить место'],
    ['#mapPhotoClose', 'close', 'Закрыть карточку'],
    ['#mapPhotoPrevious', 'chevron-left', 'Предыдущая фотография'],
    ['#mapPhotoChoosePlace', 'places', 'Выбрать место (M)'],
    ['#mapPlaceAttachPhoto', 'image-plus', 'Привязать фотографию'],
    ['#mapPointRename', 'pencil', 'Переименовать место'],
    ['#mapPointDelete', 'trash', 'Удалить местоположение (Delete / ⌫)'],
    ['#mapPhotoNext', 'chevron-right', 'Следующая фотография'],
    ['button.date-picker-toggle', 'calendar', 'Открыть календарь'],
    ['#randomToggle', 'pause', 'Поставить слайд-шоу на паузу'],
    ['#randomNext', 'chevron-right', 'Следующая случайная фотография'],
    ['#randomFullscreen', 'fullscreen', 'Включить полноэкранный режим'],
    ['#backgroundOperationClose', 'close', 'Скрыть статус'],
    ['#aboutClose', 'close', 'Закрыть окно «О приложении»'],
    ['#photoImportClose', 'close', 'Отменить добавление фотографий'],
    ['#photoImportCancel', 'close', 'Отменить добавление фотографий'],
    ['#photoImportSubmit', 'upload', 'Сохранить фотографии в папку'],
    ['#archiveSetupClose', 'close', 'Закрыть настройки'],
    ['#archiveRevealButton', 'folder', 'Открыть папку архива'],
    ['#mapPhotoPickerClose', 'close', 'Закрыть выбор фотографии'],
    ['#mapPlacePickerClose', 'close', 'Закрыть выбор места'],
    ['#mapPlaceSuggestionsToggle', 'history', 'Показать недавние и популярные места'],
    ['#viewer button[data-close]', 'close', 'Закрыть просмотр фотографии'],
    ['#viewerLocationClose', 'close', 'Закрыть редактор места'],
    ['#viewerLocationSearch button[type="submit"]', 'search', 'Найти место съёмки'],
    ['#viewerLocationSuggestionsToggle', 'history', 'Показать недавние и популярные места'],
    ['#viewerLocationZoomIn', 'plus', 'Приблизить карту'],
    ['#viewerLocationZoomOut', 'minus', 'Отдалить карту'],
    ['#viewerLocationRemove', 'trash', 'Удалить метку'],
    ['#viewerLocationSave', 'check', 'Сохранить место'],
    ['#viewerDiaryEdit', 'pencil', 'Редактировать заметку'],
    ['#viewerDiaryDelete', 'trash', 'Удалить заметку'],
    ['#viewerDiaryCancel', 'close', 'Сохранить и закрыть заметку'],
    ['#viewerDiarySave', 'check', 'Сохранить заметку'],
    ['#viewerDateEdit', 'calendar', 'Изменить дату фотографии'],
    ['#viewerDateSave', 'move', 'Перенести фотографию на выбранную дату'],
    ['#viewerDateCancel', 'close', 'Отменить изменение даты'],
    ['#viewerTrashButton', 'trash', 'Переместить фотографию в Корзину'],
    ['#viewerLocationButton', 'map', 'Добавить место'],
    ['#viewerDiaryToggle', 'note', 'Добавить заметку'],
    ['#viewerMonthHighlight', 'star', 'Отметить как фото месяца'],
    ['#viewerYearHighlight', 'star', 'Отметить как фото года'],
    ['#previousPhoto', 'chevron-left', 'Предыдущее фото'],
    ['#nextPhoto', 'chevron-right', 'Следующее фото']
  ].map(([selector, icon, label]) => Object.freeze({ selector, icon, label })));

  function createIcon(document, icon) {
    const markup = ICONS[icon];
    if (!markup) throw new Error(`Unknown button icon: ${icon}`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('app-button-icon');
    if (icon === 'spinner') svg.classList.add('is-spinning');
    svg.innerHTML = markup;
    return svg;
  }

  function setIconButton(button, { icon, label, tooltip = label } = {}) {
    if (!button) return null;
    if (!ICONS[icon]) throw new Error(`Unknown button icon: ${icon}`);
    const accessibleLabel = String(label || '').trim();
    if (!accessibleLabel) throw new Error('Icon button label is required');
    if (!button.classList.contains('app-icon-button')) {
      const view = button.ownerDocument?.defaultView;
      const position = view?.getComputedStyle?.(button).position || 'static';
      if (position === 'static') button.classList.add('app-icon-button-anchor');
    }
    button.replaceChildren(createIcon(button.ownerDocument, icon));
    button.classList.add('app-icon-button');
    button.dataset.icon = icon;
    button.dataset.tooltip = String(tooltip || accessibleLabel);
    button.setAttribute('aria-label', accessibleLabel);
    button.title = accessibleLabel;
    return button;
  }

  function installIconButtons(document) {
    for (const definition of STATIC_BUTTONS) {
      for (const button of document.querySelectorAll(definition.selector)) {
        setIconButton(button, definition);
      }
    }
  }

  return {
    ICONS,
    STATIC_BUTTONS,
    createIcon,
    installIconButtons,
    setIconButton
  };
}));
