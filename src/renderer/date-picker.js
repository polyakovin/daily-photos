(function exposeDatePicker(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhotoDayDatePicker = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const DATE_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  const WEEKDAYS = [
    ['Пн', 'Понедельник'],
    ['Вт', 'Вторник'],
    ['Ср', 'Среда'],
    ['Чт', 'Четверг'],
    ['Пт', 'Пятница'],
    ['Сб', 'Суббота'],
    ['Вс', 'Воскресенье']
  ];
  const LONG_DATE_FORMATTER = typeof Intl === 'object'
    ? new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    : null;
  let pickerSequence = 0;
  let openPicker = null;

  function dateKey(value) {
    return [
      String(value.getFullYear()).padStart(4, '0'),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }

  function dateFromKey(value) {
    const match = typeof value === 'string' ? value.match(DATE_KEY_PATTERN) : null;
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const result = new Date(year, month - 1, day);
    return result.getFullYear() === year
      && result.getMonth() === month - 1
      && result.getDate() === day
      ? result
      : null;
  }

  function dateWithinBounds(value, { min = '', max = '' } = {}) {
    if (min && value < min) return false;
    if (max && value > max) return false;
    return true;
  }

  function parseDateText(value, bounds = {}) {
    const text = String(value || '').trim();
    if (!text) return '';

    let candidate = '';
    if (DATE_KEY_PATTERN.test(text)) {
      candidate = text;
    } else {
      const digits = text.replace(/\D/g, '');
      let parts = null;
      if (/^\d{8}$/.test(text)) {
        parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)];
      } else {
        const match = text.match(/^(\d{1,2})\s*[./\-\s]\s*(\d{1,2})\s*[./\-\s]\s*(\d{4})$/);
        if (match) parts = match.slice(1);
      }
      if (parts) {
        const [day, month, year] = parts;
        candidate = `${year}-${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`;
      }
    }

    return dateFromKey(candidate) && dateWithinBounds(candidate, bounds) ? candidate : '';
  }

  function formatDateKey(value) {
    const parsed = dateFromKey(value);
    if (!parsed) return '';
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
  }

  function addCalendarMonths(value, amount) {
    const parsed = dateFromKey(value);
    if (!parsed) return '';
    const day = parsed.getDate();
    parsed.setDate(1);
    parsed.setMonth(parsed.getMonth() + amount);
    const lastDay = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate();
    parsed.setDate(Math.min(day, lastDay));
    return dateKey(parsed);
  }

  function moveCalendarViewByArrow(value, key) {
    const monthOffset = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: 12,
      ArrowDown: -12
    }[key];
    return monthOffset ? addCalendarMonths(value, monthOffset) : '';
  }

  function normalizePhotoDates(values) {
    if (!values || typeof values[Symbol.iterator] !== 'function') return new Set();
    return new Set([...values].filter((value) => dateFromKey(value)));
  }

  function normalizePhotoPreviews(values) {
    if (!values || typeof values[Symbol.iterator] !== 'function') return new Map();
    const previews = new Map();
    for (const entry of values) {
      if (!Array.isArray(entry) || entry.length < 2 || !dateFromKey(entry[0])) continue;
      const rawPreview = typeof entry[1] === 'string' ? { src: entry[1] } : entry[1];
      const src = typeof rawPreview?.src === 'string' ? rawPreview.src.trim() : '';
      if (!src) continue;
      const fallbackSrc = typeof rawPreview.fallbackSrc === 'string'
        ? rawPreview.fallbackSrc.trim()
        : '';
      const count = Number.isInteger(rawPreview.count) && rawPreview.count > 0
        ? rawPreview.count
        : 1;
      previews.set(entry[0], { src, fallbackSrc, count });
    }
    return previews;
  }

  function buildCalendarMonth(year, month) {
    const firstDay = new Date(year, month, 1);
    firstDay.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(firstDay);
      current.setDate(firstDay.getDate() + index);
      return {
        date: dateKey(current),
        inMonth: current.getMonth() === month
      };
    });
  }

  function clampDate(value, bounds) {
    if (bounds.min && value < bounds.min) return bounds.min;
    if (bounds.max && value > bounds.max) return bounds.max;
    return value;
  }

  function longDateLabel(value) {
    const parsed = dateFromKey(value);
    if (!parsed) return value;
    return LONG_DATE_FORMATTER?.format(parsed) || formatDateKey(value);
  }

  class DatePicker {
    constructor(input) {
      if (!input) throw new Error('Для календаря нужно поле ввода');
      this.input = input;
      this.wrapper = input.closest('.date-picker');
      this.toggleButton = this.wrapper?.querySelector('.date-picker-toggle');
      if (!this.wrapper || !this.toggleButton) {
        throw new Error('Поле даты должно находиться внутри .date-picker с кнопкой календаря');
      }

      this.id = `date-picker-${++pickerSequence}`;
      this._value = '';
      this.viewDate = '';
      this.photoDates = null;
      this.photoPreviews = new Map();
      this.photoPreviewDay = null;
      this.createPopover();
      this.bindEvents();
      this.setValue(input.dataset.value || input.value);
    }

    createPopover() {
      this.popover = document.createElement('div');
      this.popover.id = `${this.id}-popover`;
      this.popover.className = 'date-picker-popover';
      this.popover.setAttribute('role', 'dialog');
      this.popover.setAttribute('aria-label', this.input.dataset.pickerLabel || 'Выбор даты');
      this.popover.setAttribute('popover', 'manual');
      this.popover.hidden = true;
      this.popover.innerHTML = `
        <div class="date-picker-header">
          <button class="date-picker-nav date-picker-previous" type="button" aria-label="Предыдущий месяц">←</button>
          <strong class="date-picker-month" aria-live="polite"></strong>
          <button class="date-picker-nav date-picker-next" type="button" aria-label="Следующий месяц">→</button>
        </div>
        <div class="date-picker-weekdays" role="row"></div>
        <div class="date-picker-grid" role="grid"></div>
        <div class="date-picker-footer">
          <button class="date-picker-today" type="button">Сегодня</button>
          <button class="date-picker-clear" type="button">Очистить</button>
        </div>
        <p class="date-picker-help" id="${this.id}-help">В сетке: ←/→ — месяцы · ↑/↓ — годы</p>
        <div class="date-picker-photo-tooltip" role="tooltip" hidden>
          <img alt="" />
          <span></span>
        </div>
      `;
      this.monthLabel = this.popover.querySelector('.date-picker-month');
      this.grid = this.popover.querySelector('.date-picker-grid');
      this.previousButton = this.popover.querySelector('.date-picker-previous');
      this.nextButton = this.popover.querySelector('.date-picker-next');
      this.todayButton = this.popover.querySelector('.date-picker-today');
      this.clearButton = this.popover.querySelector('.date-picker-clear');
      this.help = this.popover.querySelector('.date-picker-help');
      this.photoPreview = this.popover.querySelector('.date-picker-photo-tooltip');
      this.photoPreviewImage = this.photoPreview.querySelector('img');
      this.photoPreviewCaption = this.photoPreview.querySelector('span');
      this.grid.setAttribute('aria-describedby', `${this.id}-help`);
      this.clearButton.hidden = this.input.required;

      const buttonIcons = globalThis.PhotoDayButtonIcons;
      buttonIcons?.setIconButton(this.previousButton, {
        icon: 'chevron-left',
        label: 'Предыдущий месяц'
      });
      buttonIcons?.setIconButton(this.nextButton, {
        icon: 'chevron-right',
        label: 'Следующий месяц'
      });
      buttonIcons?.setIconButton(this.todayButton, {
        icon: 'target',
        label: 'Выбрать сегодня'
      });
      buttonIcons?.setIconButton(this.clearButton, {
        icon: 'trash',
        label: 'Очистить дату'
      });

      const formatDescription = document.createElement('span');
      formatDescription.id = `${this.id}-format`;
      formatDescription.className = 'sr-only';
      formatDescription.textContent = 'Формат даты: день, месяц и год. Например, 9.7.1990.';
      this.wrapper.append(formatDescription);
      const describedBy = (this.input.getAttribute('aria-describedby') || '').trim();
      this.input.setAttribute('aria-describedby', [describedBy, formatDescription.id].filter(Boolean).join(' '));

      const weekdays = this.popover.querySelector('.date-picker-weekdays');
      for (const [shortLabel, fullLabel] of WEEKDAYS) {
        const label = document.createElement('span');
        label.setAttribute('role', 'columnheader');
        label.setAttribute('aria-label', fullLabel);
        label.textContent = shortLabel;
        weekdays.append(label);
      }

      (this.input.closest('dialog') || document.body).append(this.popover);
      this.toggleButton.setAttribute('aria-controls', this.popover.id);
      this.toggleButton.setAttribute('aria-expanded', 'false');
      this.toggleButton.setAttribute('aria-haspopup', 'dialog');
    }

    bindEvents() {
      this.input.addEventListener('input', () => this.readInput());
      this.input.addEventListener('change', () => this.commitInput());
      this.input.addEventListener('blur', () => this.commitInput());
      this.input.addEventListener('keydown', (event) => {
        if (event.altKey && event.key === 'ArrowDown') {
          event.preventDefault();
          this.open();
        } else if (event.key === 'Escape' && this.isOpen()) {
          event.preventDefault();
          event.stopPropagation();
          this.close();
        } else if (event.key === 'Enter') {
          this.commitInput();
        }
      });

      this.toggleButton.addEventListener('click', () => {
        if (this.isOpen()) this.close();
        else this.open();
      });
      this.previousButton.addEventListener('click', () => this.changeMonth(-1));
      this.nextButton.addEventListener('click', () => this.changeMonth(1));
      this.todayButton.addEventListener('click', () => this.select(dateKey(new Date())));
      this.clearButton.addEventListener('click', () => this.select(''));
      this.grid.addEventListener('keydown', (event) => this.handleGridKeydown(event));
      this.photoPreviewImage.addEventListener('error', () => {
        const fallbackSrc = this.photoPreviewImage.dataset.fallbackSrc;
        if (fallbackSrc && this.photoPreviewImage.src !== new URL(fallbackSrc, window.location.href).href) {
          this.photoPreviewImage.src = fallbackSrc;
          return;
        }
        this.hidePhotoPreview();
      });
      this.popover.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.close({ restoreFocus: true });
        } else if (event.key === 'Tab') {
          this.trapTabKey(event);
        }
      });

      document.addEventListener('pointerdown', (event) => {
        if (!this.isOpen() || this.popover.contains(event.target) || this.wrapper.contains(event.target)) return;
        this.close();
      }, true);
      window.addEventListener('resize', () => {
        if (!this.isOpen()) return;
        this.positionPopover();
        if (this.photoPreviewDay) this.positionPhotoPreview(this.photoPreviewDay);
      });
    }

    bounds() {
      return {
        min: dateFromKey(this.input.getAttribute('min')) ? this.input.getAttribute('min') : '',
        max: dateFromKey(this.input.getAttribute('max')) ? this.input.getAttribute('max') : ''
      };
    }

    readInput() {
      const text = this.input.value.trim();
      this._value = parseDateText(text, this.bounds());
      if (!text || this._value) {
        this.input.setCustomValidity('');
        this.input.removeAttribute('aria-invalid');
      } else {
        this.input.setCustomValidity('Введите корректную дату в формате ДД.ММ.ГГГГ');
      }
    }

    commitInput() {
      this.readInput();
      if (this._value) {
        this.input.value = formatDateKey(this._value);
        this.input.setCustomValidity('');
        this.input.removeAttribute('aria-invalid');
      } else if (this.input.value.trim()) {
        this.input.setAttribute('aria-invalid', 'true');
      }
      return this._value;
    }

    setValue(value, { notify = false } = {}) {
      const nextValue = value ? parseDateText(value, this.bounds()) : '';
      this._value = nextValue;
      this.input.value = formatDateKey(nextValue);
      this.input.setCustomValidity('');
      this.input.removeAttribute('aria-invalid');
      if (notify) {
        this.input.dispatchEvent(new Event('input', { bubbles: true }));
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    setMin(value) {
      if (value) this.input.setAttribute('min', value);
      else this.input.removeAttribute('min');
      this.readInput();
    }

    setMax(value) {
      if (value) this.input.setAttribute('max', value);
      else this.input.removeAttribute('max');
      this.readInput();
    }

    setPhotoDates(values) {
      this.photoDates = values === null ? null : normalizePhotoDates(values);
      this.help.textContent = this.photoDates
        ? '● — есть фото · ←/→ — месяцы · ↑/↓ — годы'
        : 'В сетке: ←/→ — месяцы · ↑/↓ — годы';
      if (this.isOpen()) this.render(this.viewDate);
    }

    setPhotoPreviews(values) {
      this.photoPreviews = normalizePhotoPreviews(values);
      if (this.isOpen()) this.render(this.viewDate);
    }

    validate() {
      this.commitInput();
      return this.input.checkValidity();
    }

    isOpen() {
      if (typeof this.popover.matches === 'function') {
        try {
          if (this.popover.matches(':popover-open')) return true;
        } catch {
          // Старые браузеры не знают :popover-open и используют hidden.
        }
      }
      return !this.popover.hidden;
    }

    open() {
      if (this.disabled || this.isOpen()) return;
      if (openPicker && openPicker !== this) openPicker.close();
      openPicker = this;
      this.commitInput();
      const bounds = this.bounds();
      const today = clampDate(dateKey(new Date()), bounds);
      this.viewDate = this._value || today;
      this.render(this.viewDate);
      this.popover.hidden = false;
      if (typeof this.popover.showPopover === 'function') {
        try {
          this.popover.showPopover();
        } catch {
          // В браузерах с неполной реализацией остаётся обычный fixed-попап.
        }
      }
      this.toggleButton.setAttribute('aria-expanded', 'true');
      this.positionPopover();
      const focusedDay = this.grid.querySelector('.date-picker-day[tabindex="0"]');
      focusedDay?.focus({ preventScroll: true });
    }

    close({ restoreFocus = false } = {}) {
      if (!this.isOpen()) return;
      this.hidePhotoPreview();
      if (typeof this.popover.hidePopover === 'function') {
        try {
          this.popover.hidePopover();
        } catch {
          // Попап мог уже закрыться вместе с родительским диалогом.
        }
      }
      this.popover.hidden = true;
      this.toggleButton.setAttribute('aria-expanded', 'false');
      if (openPicker === this) openPicker = null;
      if (restoreFocus) this.toggleButton.focus();
    }

    positionPopover() {
      if (!this.isOpen()) return;
      const anchor = this.wrapper.getBoundingClientRect();
      const width = this.popover.offsetWidth || 320;
      const height = this.popover.offsetHeight || 392;
      const gap = 8;
      const viewportPadding = 12;
      let left = anchor.left;
      let top = anchor.bottom + gap;
      if (left + width > window.innerWidth - viewportPadding) {
        left = window.innerWidth - width - viewportPadding;
      }
      if (top + height > window.innerHeight - viewportPadding && anchor.top - height - gap >= viewportPadding) {
        top = anchor.top - height - gap;
      }
      this.popover.style.left = `${Math.max(viewportPadding, left)}px`;
      this.popover.style.top = `${Math.max(viewportPadding, top)}px`;
    }

    positionPhotoPreview(button) {
      const anchor = button.getBoundingClientRect();
      const width = this.photoPreview.offsetWidth || 176;
      const height = this.photoPreview.offsetHeight || 142;
      const gap = 9;
      const viewportPadding = 12;
      const right = anchor.right + gap;
      const left = anchor.left - width - gap;
      let previewLeft;
      let previewTop;

      if (right + width <= window.innerWidth - viewportPadding) {
        previewLeft = right;
        previewTop = anchor.top + (anchor.height - height) / 2;
      } else if (left >= viewportPadding) {
        previewLeft = left;
        previewTop = anchor.top + (anchor.height - height) / 2;
      } else {
        previewLeft = anchor.left + (anchor.width - width) / 2;
        previewTop = anchor.top - height - gap;
        if (previewTop < viewportPadding) previewTop = anchor.bottom + gap;
      }

      this.photoPreview.style.left = `${Math.max(
        viewportPadding,
        Math.min(previewLeft, window.innerWidth - width - viewportPadding)
      )}px`;
      this.photoPreview.style.top = `${Math.max(
        viewportPadding,
        Math.min(previewTop, window.innerHeight - height - viewportPadding)
      )}px`;
    }

    showPhotoPreview(button, date) {
      const preview = this.photoPreviews.get(date);
      if (!preview || !this.isOpen()) return;
      this.photoPreviewDay = button;
      this.photoPreviewImage.dataset.fallbackSrc = preview.fallbackSrc;
      this.photoPreviewImage.src = preview.src;
      this.photoPreviewCaption.textContent = preview.count > 1
        ? `${longDateLabel(date)} · ${preview.count} фото`
        : longDateLabel(date);
      this.photoPreview.hidden = false;
      this.positionPhotoPreview(button);
    }

    hidePhotoPreview() {
      this.photoPreview.hidden = true;
      this.photoPreviewDay = null;
    }

    render(focusDate = '') {
      this.hidePhotoPreview();
      const reference = dateFromKey(focusDate)
        || dateFromKey(this.viewDate)
        || dateFromKey(this._value)
        || new Date();
      const year = reference.getFullYear();
      const month = reference.getMonth();
      const bounds = this.bounds();
      const today = dateKey(new Date());
      const days = buildCalendarMonth(year, month);
      const availableDays = days.filter((day) => dateWithinBounds(day.date, bounds));
      const requestedFocus = focusDate && availableDays.some((day) => day.date === focusDate)
        ? focusDate
        : '';
      const selectedFocus = this._value && availableDays.some((day) => day.date === this._value)
        ? this._value
        : '';
      const todayFocus = availableDays.some((day) => day.date === today) ? today : '';
      const fallbackFocus = availableDays.find((day) => day.inMonth)?.date || availableDays[0]?.date || '';
      const activeFocus = requestedFocus || selectedFocus || todayFocus || fallbackFocus;

      this.viewDate = dateKey(new Date(year, month, 1));
      this.monthLabel.textContent = `${MONTHS[month]} ${year}`;
      this.grid.setAttribute('aria-label', `${MONTHS[month]} ${year}`);
      this.grid.replaceChildren();

      for (let rowIndex = 0; rowIndex < 6; rowIndex += 1) {
        const row = document.createElement('div');
        row.className = 'date-picker-week';
        row.setAttribute('role', 'row');
        for (const day of days.slice(rowIndex * 7, rowIndex * 7 + 7)) {
          const hasPhoto = Boolean(this.photoDates?.has(day.date));
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'date-picker-day';
          button.dataset.date = day.date;
          button.setAttribute('role', 'gridcell');
          button.setAttribute('aria-label', [
            longDateLabel(day.date),
            this.photoDates ? (hasPhoto ? 'есть фотографии' : 'фотографий нет') : ''
          ].filter(Boolean).join(', '));
          button.setAttribute('aria-selected', String(day.date === this._value));
          button.tabIndex = day.date === activeFocus ? 0 : -1;
          button.textContent = String(Number(day.date.slice(-2)));
          button.disabled = !dateWithinBounds(day.date, bounds);
          button.classList.toggle('is-outside', !day.inMonth);
          button.classList.toggle('is-today', day.date === today);
          button.classList.toggle('is-selected', day.date === this._value);
          button.classList.toggle('has-photo', hasPhoto);
          if (this.photoPreviews.has(day.date)) {
            button.addEventListener('mouseenter', () => this.showPhotoPreview(button, day.date));
            button.addEventListener('mouseleave', () => this.hidePhotoPreview());
          }
          button.addEventListener('click', () => this.select(day.date));
          row.append(button);
        }
        this.grid.append(row);
      }

      const previousMonthEnd = dateKey(new Date(year, month, 0));
      const nextMonthStart = dateKey(new Date(year, month + 1, 1));
      this.previousButton.disabled = Boolean(bounds.min && previousMonthEnd < bounds.min);
      this.nextButton.disabled = Boolean(bounds.max && nextMonthStart > bounds.max);
      this.todayButton.disabled = !dateWithinBounds(today, bounds);
    }

    changeMonth(amount, { focus = false } = {}) {
      const reference = this.viewDate || this._value || dateKey(new Date());
      const next = clampDate(addCalendarMonths(reference, amount), this.bounds());
      this.render(next);
      if (focus) this.focusDate(next);
    }

    focusDate(value) {
      const next = clampDate(value, this.bounds());
      const parsed = dateFromKey(next);
      const current = dateFromKey(this.viewDate);
      if (!parsed) return;
      if (!current || parsed.getFullYear() !== current.getFullYear() || parsed.getMonth() !== current.getMonth()) {
        this.render(next);
      } else {
        this.grid.querySelectorAll('.date-picker-day').forEach((button) => {
          button.tabIndex = button.dataset.date === next ? 0 : -1;
        });
      }
      this.grid.querySelector(`.date-picker-day[data-date="${next}"]`)?.focus();
    }

    handleGridKeydown(event) {
      const target = event.target.closest('.date-picker-day');
      if (!target) return;
      const value = target.dataset.date;
      const next = moveCalendarViewByArrow(value, event.key);
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        this.select(value);
        return;
      }
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      this.focusDate(next);
    }

    trapTabKey(event) {
      const controls = [
        this.previousButton,
        this.nextButton,
        this.grid.querySelector('.date-picker-day[tabindex="0"]'),
        this.todayButton,
        this.clearButton.hidden ? null : this.clearButton
      ].filter((control) => control && !control.disabled);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    select(value) {
      this.setValue(value);
      this.close({ restoreFocus: true });
      this.input.dispatchEvent(new Event('input', { bubbles: true }));
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
      this.input.dispatchEvent(new CustomEvent('date-picker-select', {
        bubbles: true,
        detail: { value: this._value }
      }));
    }

    focus() {
      this.input.focus();
    }

    get value() {
      return this._value;
    }

    set value(value) {
      this.setValue(value);
    }

    get disabled() {
      return this.input.disabled;
    }

    set disabled(value) {
      const disabled = Boolean(value);
      this.input.disabled = disabled;
      this.toggleButton.disabled = disabled;
      if (disabled) this.close();
    }
  }

  function createDatePicker(input) {
    return new DatePicker(input);
  }

  return {
    DatePicker,
    addCalendarMonths,
    buildCalendarMonth,
    createDatePicker,
    formatDateKey,
    moveCalendarViewByArrow,
    normalizePhotoDates,
    normalizePhotoPreviews,
    parseDateText
  };
}));
