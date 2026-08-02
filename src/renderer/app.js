const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];
const PRESENTATION_MODE_STORAGE_KEY = 'photo-day:presentation-mode';
const BLUR_DATES_STORAGE_KEY = 'photo-day:presentation-blur-dates';
const LIFE_BIRTH_DATE_STORAGE_KEY = 'photo-day:birth-date';
const RECENT_PLACE_STORAGE_KEY = 'photo-day:recent-places';
const RECENT_PLACE_LIMIT = 20;
const DATE_KEY_PATTERN = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const { calculateLifeRange, filterLifePhotoEntries } = window.PhotoDayLifeRange;
const { suggestCalendarImportDate } = window.PhotoDayImportDate;
const { createDatePicker } = window.PhotoDayDatePicker;
const {
  buildMapPlaybackFrames,
  distinctMapPointCount,
  InteractiveMap,
  mapCoordinateKey,
  mapPlaybackDelay,
  normalizeCoordinates: normalizeMapCoordinates,
  parseCoordinateQuery,
  referencePlaceSuggestions,
  relatedReferencePlaces,
  unlocatedPhotos,
  visibleReferencePoints
} = window.PhotoDayMap;
const {
  newestViewState,
  normalizeViewState,
  readViewState,
  storeViewState
} = window.PhotoDayViewState;

const grid = document.querySelector('#calendarGrid');
const monthTitle = document.querySelector('#monthTitle');
const monthCount = document.querySelector('#monthCount');
const yearSelect = document.querySelector('#yearSelect');
const timelineView = document.querySelector('#timelineView');
const timelineTrack = document.querySelector('#timelineTrack');
const timelineScrollbar = document.querySelector('#timelineScrollbar');
const timelineYears = document.querySelector('#timelineYears');
const mapView = document.querySelector('#mapView');
const mapStageWrap = document.querySelector('#mapStageWrap');
const photoMap = document.querySelector('#photoMap');
const mapSearch = document.querySelector('#mapSearch');
const mapSearchInput = document.querySelector('#mapSearchInput');
const mapSearchResults = document.querySelector('#mapSearchResults');
const mapSummary = document.querySelector('#mapSummary');
const mapEmpty = document.querySelector('#mapEmpty');
const mapPlaybackButton = document.querySelector('#mapPlaybackButton');
const mapPlayback = document.querySelector('#mapPlayback');
const mapPlaybackPlay = document.querySelector('#mapPlaybackPlay');
const mapPlaybackDate = document.querySelector('#mapPlaybackDate');
const mapPlaybackPosition = document.querySelector('#mapPlaybackPosition');
const mapPlaybackRange = document.querySelector('#mapPlaybackRange');
const mapPlaybackPrevious = document.querySelector('#mapPlaybackPrevious');
const mapPlaybackNext = document.querySelector('#mapPlaybackNext');
const mapPlaybackSpeed = document.querySelector('#mapPlaybackSpeed');
const mapPlaybackClose = document.querySelector('#mapPlaybackClose');
const mapAddPlaceButton = document.querySelector('#mapAddPlaceButton');
const mapAssignButton = document.querySelector('#mapAssignButton');
const mapAssignment = document.querySelector('#mapAssignment');
const mapAssignmentPreview = document.querySelector('#mapAssignmentPreview');
const mapAssignmentImage = document.querySelector('#mapAssignmentImage');
const mapAssignmentProgress = document.querySelector('#mapAssignmentProgress');
const mapAssignmentDate = document.querySelector('#mapAssignmentDate');
const mapAssignmentChoosePlace = document.querySelector('#mapAssignmentChoosePlace');
const mapAssignmentSkip = document.querySelector('#mapAssignmentSkip');
const mapAssignmentDone = document.querySelector('#mapAssignmentDone');
const mapPlaceEditor = document.querySelector('#mapPlaceEditor');
const mapPlaceEditorKicker = document.querySelector('#mapPlaceEditorKicker');
const mapPlaceEditorTitle = document.querySelector('#mapPlaceEditorTitle');
const mapPlaceName = document.querySelector('#mapPlaceName');
const mapPlaceCountry = document.querySelector('#mapPlaceCountry');
const mapPlaceCoordinates = document.querySelector('#mapPlaceCoordinates');
const mapPlaceError = document.querySelector('#mapPlaceError');
const mapPlaceSave = document.querySelector('#mapPlaceSave');
const mapPhotoCard = document.querySelector('#mapPhotoCard');
const mapPhotoPreview = document.querySelector('#mapPhotoPreview');
const mapPhotoImage = document.querySelector('#mapPhotoImage');
const mapPhotoPosition = document.querySelector('#mapPhotoPosition');
const mapPhotoDate = document.querySelector('#mapPhotoDate');
const mapPhotoSource = document.querySelector('#mapPhotoSource');
const mapPhotoChoosePlace = document.querySelector('#mapPhotoChoosePlace');
const mapPlaceAttachPhoto = document.querySelector('#mapPlaceAttachPhoto');
const mapPointRename = document.querySelector('#mapPointRename');
const mapPointDelete = document.querySelector('#mapPointDelete');
const mapPhotoPickerDialog = document.querySelector('#mapPhotoPickerDialog');
const mapPhotoPickerPlace = document.querySelector('#mapPhotoPickerPlace');
const mapPhotoPickerSearch = document.querySelector('#mapPhotoPickerSearch');
const mapPhotoPickerStatus = document.querySelector('#mapPhotoPickerStatus');
const mapPhotoPickerGrid = document.querySelector('#mapPhotoPickerGrid');
const mapPlacePickerDialog = document.querySelector('#mapPlacePickerDialog');
const mapPlacePickerPhoto = document.querySelector('#mapPlacePickerPhoto');
const mapPlacePickerSearch = document.querySelector('#mapPlacePickerSearch');
const mapPlacePickerStatus = document.querySelector('#mapPlacePickerStatus');
const mapPlaceSuggestionsToggle = document.querySelector('#mapPlaceSuggestionsToggle');
const mapPlacePickerGrid = document.querySelector('#mapPlacePickerGrid');
const lifeCanvas = document.querySelector('#lifeCanvas');
const lifeCanvasWrap = document.querySelector('#lifeCanvasWrap');
const lifeTooltip = document.querySelector('#lifeTooltip');
const lifeTooltipMedia = document.querySelector('#lifeTooltipMedia');
const lifeTooltipPreview = document.querySelector('#lifeTooltipPreview');
const lifeTooltipDate = document.querySelector('#lifeTooltipDate');
const lifeBirthDateInput = document.querySelector('#lifeBirthDate');
const lifeBirthDateStatus = document.querySelector('#lifeBirthDateStatus');
const lifeRemainingToggle = document.querySelector('#lifeRemainingToggle');
const lifeFutureLegend = document.querySelector('#lifeFutureLegend');
const randomView = document.querySelector('#randomView');
const randomLayers = [document.querySelector('#randomLayerA'), document.querySelector('#randomLayerB')];
const randomLoading = document.querySelector('#randomLoading');
const randomProgressBar = document.querySelector('#randomProgressBar');
const viewer = document.querySelector('#viewer');
const viewerPanel = viewer.querySelector('.viewer-panel');
const viewerMedia = viewer.querySelector('.viewer-media');
const viewerImage = document.querySelector('#viewerImage');
const viewerMiniMap = document.querySelector('#viewerMiniMap');
const viewerMiniMapCanvas = document.querySelector('#viewerMiniMapCanvas');
const viewerMiniMapOpen = document.querySelector('#viewerMiniMapOpen');
const imageLoader = document.querySelector('#imageLoader');
const viewerDateEdit = document.querySelector('#viewerDateEdit');
const viewerDateForm = document.querySelector('#viewerDateForm');
const viewerDateInput = document.querySelector('#viewerDateInput');
const viewerDateSave = document.querySelector('#viewerDateSave');
const viewerDateCancel = document.querySelector('#viewerDateCancel');
const viewerDateStatus = document.querySelector('#viewerDateStatus');
const viewerDiary = document.querySelector('#viewerDiary');
const viewerDiaryContent = document.querySelector('#viewerDiaryContent');
const viewerDiaryToggle = document.querySelector('#viewerDiaryToggle');
const presentationButton = document.querySelector('#presentationButton');
const aboutButton = document.querySelector('#aboutButton');
const aboutDialog = document.querySelector('#aboutDialog');
const aboutCard = document.querySelector('#aboutCard');
const aboutClose = document.querySelector('#aboutClose');
const aboutVersion = document.querySelector('#aboutVersion');
const aboutBuildDate = document.querySelector('#aboutBuildDate');
const aboutEnvironment = document.querySelector('#aboutEnvironment');
const aboutStatus = document.querySelector('#aboutStatus');
const aboutPhotoCount = document.querySelector('#aboutPhotoCount');
const aboutDayCount = document.querySelector('#aboutDayCount');
const aboutDiaryCount = document.querySelector('#aboutDiaryCount');
const aboutLocatedCount = document.querySelector('#aboutLocatedCount');
const aboutDataSource = document.querySelector('#aboutDataSource');
const aboutDateRange = document.querySelector('#aboutDateRange');
const aboutPlaces = document.querySelector('#aboutPlaces');
const aboutIndex = document.querySelector('#aboutIndex');
const aboutRuntime = document.querySelector('#aboutRuntime');
const viewerBlurToggle = document.querySelector('#viewerBlurToggle');
const viewerBlurControl = viewerBlurToggle.closest('.viewer-blur-toggle');
const viewerBlurStatus = document.querySelector('#viewerBlurStatus');
const viewerAlternatives = document.querySelector('#viewerAlternatives');
const viewerAlternativesTrack = document.querySelector('#viewerAlternativesTrack');
const viewerChoiceStatus = document.querySelector('#viewerChoiceStatus');
const viewerHighlightActions = document.querySelector('#viewerHighlightActions');
const viewerMonthHighlight = document.querySelector('#viewerMonthHighlight');
const viewerYearHighlight = document.querySelector('#viewerYearHighlight');
const viewerHighlightStatus = document.querySelector('#viewerHighlightStatus');
const viewerTrashButton = document.querySelector('#viewerTrashButton');
const viewerTrashStatus = document.querySelector('#viewerTrashStatus');
const viewerLocationButton = document.querySelector('#viewerLocationButton');
const viewerLocationButtonLabel = document.querySelector('#viewerLocationButtonLabel');
const viewerLocationEditor = document.querySelector('#viewerLocationEditor');
const viewerLocationMapElement = document.querySelector('#viewerLocationMap');
const viewerLocationSearch = document.querySelector('#viewerLocationSearch');
const viewerLocationSearchInput = document.querySelector('#viewerLocationSearchInput');
const viewerLocationSearchResults = document.querySelector('#viewerLocationSearchResults');
const viewerLocationSuggestionsToggle = document.querySelector('#viewerLocationSuggestionsToggle');
const viewerLocationTitle = document.querySelector('#viewerLocationTitle');
const viewerLocationStatus = document.querySelector('#viewerLocationStatus');
const viewerLocationRemove = document.querySelector('#viewerLocationRemove');
const viewerLocationSave = document.querySelector('#viewerLocationSave');
const desktopBridge = window.photoDayDesktop;
const archiveSettingsButton = document.querySelector('#archiveSettingsButton');
const archiveSettingsName = document.querySelector('#archiveSettingsName');
const archiveSetupDialog = document.querySelector('#archiveSetupDialog');
const archiveSetupKicker = document.querySelector('#archiveSetupKicker');
const archiveSetupTitle = document.querySelector('#archiveSetupTitle');
const archiveSetupLead = document.querySelector('#archiveSetupLead');
const archiveSetupPath = document.querySelector('#archiveSetupPath');
const archiveSetupError = document.querySelector('#archiveSetupError');
const archiveChooseButton = document.querySelector('#archiveChooseButton');
const archiveChooseLabel = document.querySelector('#archiveChooseLabel');
const archiveComputerButton = document.querySelector('#archiveComputerButton');
const archiveRevealButton = document.querySelector('#archiveRevealButton');
const archiveConvertToggle = document.querySelector('#archiveConvertToggle');
const archiveSetupClose = document.querySelector('#archiveSetupClose');
const archiveIndexProgress = document.querySelector('#archiveIndexProgress');
const archiveIndexDetail = document.querySelector('#archiveIndexDetail');
const archiveIndexAmount = document.querySelector('#archiveIndexAmount');
const archiveIndexEta = document.querySelector('#archiveIndexEta');
const archiveIndexBar = document.querySelector('#archiveIndexBar');
const archiveIndexBarFill = document.querySelector('#archiveIndexBarFill');
const archiveIndexLog = document.querySelector('#archiveIndexLog');
const backgroundOperationTooltip = document.querySelector('#backgroundOperationTooltip');
const backgroundOperationTitle = document.querySelector('#backgroundOperationTitle');
const backgroundOperationDetail = document.querySelector('#backgroundOperationDetail');
const backgroundOperationAmount = document.querySelector('#backgroundOperationAmount');
const backgroundOperationProgress = document.querySelector('#backgroundOperationProgress');
const backgroundOperationProgressBar = document.querySelector('#backgroundOperationProgressBar');
const backgroundOperationClose = document.querySelector('#backgroundOperationClose');
const backgroundOperationLog = document.querySelector('#backgroundOperationLog');
const photoImportDialog = document.querySelector('#photoImportDialog');
const photoImportForm = document.querySelector('#photoImportForm');
const photoImportClose = document.querySelector('#photoImportClose');
const photoImportCancel = document.querySelector('#photoImportCancel');
const photoImportSubmit = document.querySelector('#photoImportSubmit');
const photoImportSummary = document.querySelector('#photoImportSummary');
const photoImportDate = document.querySelector('#photoImportDate');
const photoImportDateHint = document.querySelector('#photoImportDateHint');
const photoImportError = document.querySelector('#photoImportError');
const lifeBirthDatePicker = createDatePicker(lifeBirthDateInput);
const viewerDatePicker = createDatePicker(viewerDateInput);
const photoImportDatePicker = createDatePicker(photoImportDate);
lifeBirthDatePicker.setMax(localDateKey());

let photos = [];
let byDate = new Map();
let diaryByDate = new Map();
let photoSelections = new Map();
let yearHighlightSelections = new Map();
let monthHighlightSelections = new Map();
let yearHighlights = new Map();
let monthHighlights = new Map();
let locationReferencePlaces = [];
let yearHighlightThumbnails = new Map();
let monthHighlightThumbnails = new Map();
let yearHighlightDates = new Map();
let monthHighlightDates = new Map();
let archiveYears = [];
let visibleDate = new Date();
let activePhotos = [];
let activeIndex = 0;
let viewerDiaryVisible = false;
let viewerDateSaving = false;
let viewerTrashInProgress = false;
let firstArchiveMonth = null;
let lastArchiveMonth = null;
let timelineRendered = false;
let timelineImageObserver = null;
let timelineScrollbarFrame = 0;
let timelineRenderFrame = 0;
let timelineEntries = [];
let timelineVirtualStart = -1;
let timelineVirtualEnd = -1;
let timelineRestoring = false;
const timelineLoadedImages = new Set();
let mapController = null;
let mapDidFitPoints = false;
let mapPlaybackFrames = [];
let mapPlaybackIndex = 0;
let mapPlaybackTimer = 0;
let mapPlaybackPlaying = false;
let mapPlaybackActive = false;
let mapAssignmentPhotos = [];
let mapAssignmentIndex = 0;
let mapAssignmentSaving = false;
let mapAssignmentImageFallbackTimer = 0;
let mapAssignmentMode = 'batch';
let mapPlaceDraft = null;
let mapPlaceSaving = false;
let mapPlaceEditorMode = 'create';
let mapPlaceEditingPlace = null;
let activeMapPhotos = [];
let activeMapPhotoIndex = 0;
let activeMapPlaces = [];
let activeMapPlaceIndex = 0;
let activeMapRelatedPlaces = [];
let mapPointDeleting = false;
let mapPhotoPickerActivePlace = null;
let mapPhotoPickerSaving = false;
let mapPlacePickerActivePhoto = null;
let mapPlacePickerSaving = false;
let mapPlacePickerContext = 'map';
let mapPlacePickerSuggestionsVisible = false;
let mapLocationSearch = null;
let viewerMiniMapController = null;
let viewerLocationMap = null;
let viewerLocationDraft = null;
let viewerLocationSaving = false;
let viewerLocationPlaceSearch = null;
let lifeStart = null;
let lifeEnd = null;
let lifeTotalDays = 0;
let lifePhotoDates = new Map();
let lifeLayout = null;
let lifeTooltipIndex = -1;
let randomTimer = null;
const randomLayerCleanupTimers = [null, null];
let randomGeneration = 0;
let randomLayerIndex = 1;
let randomCurrentPhoto = null;
let randomPaused = false;
let randomTransitioning = false;
let randomNativeFullscreenActive = false;
let calendarFocus = 'month';
let blurDates = readStoredBlurDates();
let presentationMode = readStoredPresentationMode();
let birthDate = readStoredBirthDate();
let recentPlaceIds = readStoredRecentPlaceIds();
let blurStatusTimer = null;
let viewerChoiceStatusTimer = null;
let viewerHighlightStatusTimer = null;
const photoSelectionRequestSequences = new Map();
const highlightSelectionRequestSequences = new Map();
let desktopArchiveState = null;
let backgroundOperationHideTimer = null;
let backgroundOperationStatus = null;
let archiveSelectionInProgress = false;
let archiveReloadTimer = null;
let archiveReloadPending = false;
let navigationState = readStoredNavigationState();
let activeView = 'calendar';
let navigationSaveTimer = null;
let viewerZoomPointerId = null;
let viewerZoomStartX = 0;
let viewerZoomStartY = 0;
let pendingPhotoImportPaths = [];
let photoImportInProgress = false;
let photoDragDepth = 0;
let photoImportSuggestionSequence = 0;
let aboutInfoRequest = null;

function readStoredNavigationState() {
  try {
    return readViewState(window.localStorage);
  } catch {
    return normalizeViewState(null);
  }
}

function readStoredRecentPlaceIds() {
  try {
    const values = JSON.parse(window.localStorage.getItem(RECENT_PLACE_STORAGE_KEY) || '[]');
    return [...new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === 'string' && value.trim())
    )].slice(0, RECENT_PLACE_LIMIT);
  } catch {
    return [];
  }
}

function rememberRecentPlace(placeId) {
  if (typeof placeId !== 'string' || !placeId.trim()) return;
  recentPlaceIds = [
    placeId,
    ...recentPlaceIds.filter((candidate) => candidate !== placeId)
  ].slice(0, RECENT_PLACE_LIMIT);
  try {
    window.localStorage.setItem(RECENT_PLACE_STORAGE_KEY, JSON.stringify(recentPlaceIds));
  } catch {
    // История выбора остаётся доступна до перезагрузки.
  }
}

function aboutNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString('ru-RU');
}

function aboutPlatformLabel(platform) {
  return {
    darwin: 'macOS',
    win32: 'Windows',
    linux: 'Linux'
  }[platform] || '';
}

function aboutEnvironmentLabel(application) {
  if (application.environment !== 'desktop') return 'Веб-версия';
  const platform = aboutPlatformLabel(application.platform);
  return platform ? `Приложение · ${platform}` : 'Приложение';
}

function aboutBuildLabel(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Не указана';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function aboutSourceLabel(data) {
  const roots = Math.max(0, Number(data.rootCount) || 0);
  const rootsLabel = roots
    ? `${roots.toLocaleString('ru-RU')} ${pluralize(roots, ['источник', 'источника', 'источников'])}`
    : 'источник не настроен';
  if (desktopArchiveState?.name) return `${desktopArchiveState.name} · ${rootsLabel}`;
  return data.sourceMode === 'computer'
    ? `Автопоиск · ${rootsLabel}`
    : `Локальная папка · ${rootsLabel}`;
}

function aboutRuntimeLabel(application) {
  const runtime = application.runtime || {};
  const components = [
    runtime.electron ? `Electron ${runtime.electron}` : '',
    runtime.chromium ? `Chromium ${runtime.chromium}` : '',
    runtime.node ? `Node.js ${runtime.node}` : ''
  ].filter(Boolean);
  return components.join(' · ') || 'Браузер';
}

function renderAboutInfo(info) {
  const application = info?.application || {};
  const data = info?.data || {};
  aboutVersion.textContent = application.version || '—';
  aboutBuildDate.textContent = aboutBuildLabel(application.buildDate);
  aboutEnvironment.textContent = aboutEnvironmentLabel(application);
  aboutPhotoCount.textContent = aboutNumber(data.photos);
  aboutDayCount.textContent = aboutNumber(data.photoDays);
  aboutDiaryCount.textContent = aboutNumber(data.diaryEntries);
  aboutLocatedCount.textContent = aboutNumber(data.locatedPhotos);
  aboutDataSource.textContent = aboutSourceLabel(data);
  aboutDateRange.textContent = data.dateFrom && data.dateTo
    ? `${formatDate(data.dateFrom)} — ${formatDate(data.dateTo)}`
    : 'Датированные фотографии не найдены';
  aboutPlaces.textContent = `${aboutNumber(data.savedPlaces)} ${pluralize(
    Math.max(0, Number(data.savedPlaces) || 0),
    ['сохранённое место', 'сохранённых места', 'сохранённых мест']
  )}`;
  aboutIndex.textContent = [
    data.metadataIndex ? 'метаданные EXIF' : 'даты из путей',
    data.cachedIndex ? 'кэш загружен' : 'текущее сканирование',
    data.convertsImages ? 'замена на WebP включена' : 'оригиналы сохраняются'
  ].join(' · ');
  aboutRuntime.textContent = aboutRuntimeLabel(application);
}

async function loadAboutInfo() {
  if (aboutInfoRequest) return aboutInfoRequest;
  aboutCard.setAttribute('aria-busy', 'true');
  aboutStatus.textContent = 'Обновляем…';
  aboutStatus.classList.remove('is-error');
  aboutInfoRequest = fetch('/api/app-info')
    .then(async (response) => {
      if (!response.ok) throw new Error('Сведения недоступны');
      renderAboutInfo(await response.json());
      aboutStatus.textContent = 'Актуально сейчас';
    })
    .catch(() => {
      aboutStatus.textContent = 'Не удалось обновить';
      aboutStatus.classList.add('is-error');
    })
    .finally(() => {
      aboutCard.removeAttribute('aria-busy');
      aboutInfoRequest = null;
    });
  return aboutInfoRequest;
}

function openAboutDialog() {
  if (!aboutDialog.open) aboutDialog.showModal();
  void loadAboutInfo();
}

function hideBackgroundOperation() {
  clearTimeout(backgroundOperationHideTimer);
  backgroundOperationTooltip.classList.remove('is-visible');
  backgroundOperationHideTimer = setTimeout(() => {
    backgroundOperationTooltip.hidden = true;
  }, 180);
}

function operationNeedsAcknowledgement() {
  return ['error', 'warning'].includes(backgroundOperationStatus);
}

function dismissBackgroundOperation() {
  hideBackgroundOperation();
  backgroundOperationStatus = null;
  if (!archiveReloadPending || archiveSelectionInProgress) return;
  archiveReloadPending = false;
  clearTimeout(archiveReloadTimer);
  archiveReloadTimer = setTimeout(() => window.location.reload(), 200);
}

function formatIndexEta(seconds, { compact = false } = {}) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const rounded = Math.max(1, Math.round(seconds));
  let duration;
  if (rounded < 60) duration = `${rounded} сек`;
  else if (rounded < 3600) duration = `${Math.max(1, Math.round(rounded / 60))} мин`;
  else duration = `${Math.floor(rounded / 3600)} ч ${Math.round(rounded % 3600 / 60)} мин`;
  if (compact) return `~${duration}`;
  const expected = new Date(Date.now() + rounded * 1000).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `Осталось около ${duration} · завершение примерно в ${expected}`;
}

function renderOperationFileLog(container, operation, { autoOpen = false } = {}) {
  const files = Array.isArray(operation.files) ? operation.files : [];
  const errors = Array.isArray(operation.errors) ? operation.errors.filter(Boolean) : [];
  if (!files.length && !errors.length) {
    container.hidden = true;
    container.open = false;
    container.dataset.operationId = '';
    return;
  }

  container.hidden = false;
  const summary = container.querySelector('summary');
  const list = container.querySelector('ul');
  const errorOutput = container.querySelector('pre');
  const processed = Number.isFinite(operation.processedFiles) ? operation.processedFiles : files.length;
  const isPartialList = processed > files.length;
  summary.textContent = `${isPartialList ? 'Последние файлы' : 'Обработанные файлы'}: ${processed.toLocaleString('ru-RU')}`;

  const statusLabels = {
    processing: 'Обрабатывается',
    converted: 'Сконвертирован',
    skipped: 'Готовый WebP уже существует',
    replaced: 'Оригинал заменён на WebP',
    failed: 'Ошибка'
  };
  const fragment = document.createDocumentFragment();
  for (const file of files) {
    if (!file || typeof file.path !== 'string') continue;
    const item = document.createElement('li');
    item.dataset.status = statusLabels[file.status] ? file.status : 'converted';
    item.title = `${statusLabels[file.status] || 'Обработан'}: ${file.path}`;
    const pathLabel = document.createElement('span');
    pathLabel.textContent = file.path;
    item.append(pathLabel);
    fragment.append(item);
  }
  list.replaceChildren(fragment);

  errorOutput.hidden = !errors.length;
  errorOutput.textContent = errors.join('\n');

  const isNewOperation = container.dataset.operationId !== operation.id;
  container.dataset.operationId = operation.id || '';
  if (['error', 'warning'].includes(operation.status) || (autoOpen && isNewOperation)) {
    container.open = true;
  }
}

function showArchiveIndexOperation(operation) {
  if (!archiveSelectionInProgress && !archiveSetupDialog.open) return;
  const progress = Math.max(0, Math.min(100, Number(operation.progress) || 0));
  const hasCount = Number.isFinite(operation.completed)
    && Number.isFinite(operation.total)
    && operation.total > 0;
  archiveIndexProgress.hidden = false;
  archiveIndexDetail.textContent = operation.detail || operation.title || 'Индексируем фотографии';
  archiveIndexAmount.textContent = hasCount
    ? `${operation.completed.toLocaleString('ru-RU')} / ${operation.total.toLocaleString('ru-RU')} ${operation.unit || ''} · ${progress}%`
    : `${progress}%`;
  archiveIndexBar.setAttribute('aria-valuenow', String(progress));
  archiveIndexBarFill.style.width = `${progress}%`;
  const eta = formatIndexEta(Number(operation.etaSeconds));
  archiveIndexEta.textContent = operation.status === 'error'
    ? 'Индексация остановлена'
    : operation.status === 'warning'
      ? 'Индекс готов с предупреждениями'
      : operation.status === 'success'
        ? 'Индекс готов'
        : eta || 'Оцениваем время завершения…';
  renderOperationFileLog(archiveIndexLog, operation, { autoOpen: true });
}

function showBackgroundOperation(operation) {
  clearTimeout(backgroundOperationHideTimer);
  backgroundOperationStatus = operation.status;
  const progress = Math.max(0, Math.min(100, Number(operation.progress) || 0));
  const hasCount = Number.isFinite(operation.completed)
    && Number.isFinite(operation.total)
    && operation.total > 0;
  backgroundOperationTooltip.hidden = false;
  backgroundOperationTooltip.classList.remove('is-running', 'is-success', 'is-warning', 'is-error');
  backgroundOperationTooltip.classList.add(`is-${operation.status}`);
  backgroundOperationTitle.textContent = operation.title || 'Фоновая операция';
  backgroundOperationDetail.textContent = operation.detail || '';
  const compactEta = formatIndexEta(Number(operation.etaSeconds), { compact: true });
  const progressLabel = hasCount
    ? `${operation.completed.toLocaleString('ru-RU')} из ${operation.total.toLocaleString('ru-RU')} · ${progress}%`
    : operation.status === 'error'
      ? 'Ошибка'
      : operation.status === 'warning'
        ? 'Есть предупреждения'
        : operation.status === 'success' ? 'Готово' : `${progress}%`;
  backgroundOperationAmount.textContent = compactEta ? `${progressLabel} · ${compactEta}` : progressLabel;
  backgroundOperationProgressBar.style.width = `${progress}%`;
  backgroundOperationProgress.setAttribute('aria-valuenow', String(progress));
  renderOperationFileLog(backgroundOperationLog, operation);
  showArchiveIndexOperation(operation);
  requestAnimationFrame(() => backgroundOperationTooltip.classList.add('is-visible'));

  if (operation.status === 'success') {
    backgroundOperationHideTimer = setTimeout(hideBackgroundOperation, 2600);
  }
}

function updateArchiveSettingsUi(state) {
  desktopArchiveState = state;
  const hasAvailableSource = Boolean(state?.available);
  archiveSettingsName.textContent = hasAvailableSource ? state.name : 'Не выбран';
  archiveSettingsButton.title = hasAvailableSource ? state.path : 'Выбрать источник фотографий';
  archiveSetupPath.textContent = state?.path || 'Источник пока не выбран';
  archiveSetupPath.title = state?.path || '';
  archiveRevealButton.disabled = !state?.canReveal;
  archiveConvertToggle.checked = Boolean(state?.convertImages);
  archiveConvertToggle.disabled = !state?.canConvertImages;
}

function showArchiveSetup(mode = 'settings') {
  const isWelcome = mode === 'welcome';
  archiveSetupDialog.dataset.mode = mode;
  archiveSetupKicker.textContent = isWelcome ? 'Первый запуск' : 'Настройки приложения';
  archiveSetupTitle.textContent = isWelcome ? 'Где хранится ваша история?' : 'Источник фотографий';
  archiveSetupLead.textContent = isWelcome
    ? 'Выберите папку или запустите автопоиск в Pictures и на подключённых носителях. Даты съёмки читаются локально — файлы не отправляются в интернет.'
    : 'Можно выбрать другую папку или заново запустить автопоиск фотографий.';
  archiveChooseLabel.textContent = desktopArchiveState?.mode === 'folder' && desktopArchiveState?.available
    ? 'Выбрать другую папку'
    : 'Выбрать папку';
  archiveSetupError.hidden = true;
  archiveIndexProgress.hidden = true;
  if (!archiveSetupDialog.open) archiveSetupDialog.showModal();
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function visibleCalendarImportDate() {
  return suggestCalendarImportDate({
    view: activeView,
    focus: calendarFocus,
    visibleDate,
    occupiedDates: new Set(byDate.keys()),
    today: new Date()
  });
}

function visibleCalendarPeriodLabel() {
  return {
    year: 'открытого года',
    month: 'открытого месяца',
    week: 'открытой недели'
  }[calendarFocus] || 'открытого периода';
}

function photoCountLabel(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} фотографий`;
  if (last === 1) return `${count} фотография`;
  if (last >= 2 && last <= 4) return `${count} фотографии`;
  return `${count} фотографий`;
}

function droppedFileIsSupported(file) {
  if (/\.(?:jpe?g|png|webp|gif|avif)$/i.test(file.name)) return true;
  return Boolean(desktopArchiveState?.convertImages) && /\.(?:heic|heif)$/i.test(file.name);
}

function resetPhotoDragState() {
  photoDragDepth = 0;
  document.body.classList.remove('is-photo-dragging');
}

function closePhotoImportDialog() {
  if (photoImportInProgress) return;
  photoImportSuggestionSequence += 1;
  pendingPhotoImportPaths = [];
  photoImportDatePicker.close();
  if (photoImportDialog.open) photoImportDialog.close();
}

async function showPhotoImportDialog(files) {
  const allFiles = [...files];
  const exceedsLimit = allFiles.length > 100;
  const supportedFiles = exceedsLimit ? [] : allFiles.filter(droppedFileIsSupported);
  const paths = [];
  for (const file of supportedFiles) {
    try {
      const filePath = desktopBridge.getPathForFile(file);
      if (filePath) paths.push(filePath);
    } catch {
      // Файл без доступного системного пути будет показан как неподдерживаемый.
    }
  }

  pendingPhotoImportPaths = paths;
  const skippedCount = allFiles.length - paths.length;
  const today = localDateKey();
  const calendarSuggestion = visibleCalendarImportDate();
  photoImportDatePicker.setMax(today);
  photoImportDatePicker.setValue(today);
  photoImportSummary.textContent = paths.length
    ? `${photoCountLabel(paths.length)} ${paths.length === 1 ? 'будет сохранена' : 'будут сохранены'} в «${desktopArchiveState.name}».`
    : 'Не удалось найти фотографии в поддерживаемом формате.';
  photoImportDateHint.textContent = paths.length
    ? 'Ищем дату съёмки в EXIF…'
    : 'Поддерживаются WebP, JPEG, PNG, GIF и AVIF.';
  photoImportError.hidden = skippedCount === 0 && paths.length > 0;
  photoImportError.textContent = exceedsLimit
    ? 'За один раз можно добавить не больше 100 фотографий.'
    : paths.length
    ? `Пропущено файлов: ${skippedCount}. Их формат не поддерживается или недоступен.`
    : 'Добавить эти файлы не получится. Для HEIC/HEIF включите конвертацию в настройках папки.';
  photoImportSubmit.disabled = paths.length === 0;
  photoImportSubmit.textContent = 'Сохранить в папку';
  photoImportCancel.disabled = false;
  photoImportClose.disabled = false;
  if (!photoImportDialog.open) photoImportDialog.showModal();
  photoImportDatePicker.focus();

  if (!paths.length) return;
  const suggestionSequence = ++photoImportSuggestionSequence;
  try {
    const suggestedDate = await desktopBridge.suggestPhotoDate(paths);
    if (suggestionSequence !== photoImportSuggestionSequence || !photoImportDialog.open) return;
    if (suggestedDate) {
      if (photoImportDatePicker.value === today) {
        photoImportDatePicker.setValue(suggestedDate);
        photoImportDateHint.textContent = 'Дата предложена из EXIF фотографии. Её можно изменить.';
      } else {
        photoImportDateHint.textContent = 'Дата найдена в EXIF, но оставлена выбранная вами дата.';
      }
    } else {
      if (calendarSuggestion && photoImportDatePicker.value === today) {
        photoImportDatePicker.setValue(calendarSuggestion);
        photoImportDateHint.textContent = `В EXIF дата не найдена — предложена последняя свободная дата из ${visibleCalendarPeriodLabel()}.`;
      } else if (photoImportDatePicker.value !== today) {
        photoImportDateHint.textContent = 'В EXIF дата не найдена — оставлена выбранная вами дата.';
      } else {
        photoImportDateHint.textContent = 'В EXIF дата не найдена — предложена сегодняшняя. Её можно изменить.';
      }
    }
  } catch {
    if (suggestionSequence === photoImportSuggestionSequence && photoImportDialog.open) {
      photoImportDateHint.textContent = 'Не удалось прочитать EXIF — предложена сегодняшняя дата.';
    }
  }
}

function handlePhotoDragEnter(event) {
  if (!desktopBridge || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
  event.preventDefault();
  photoDragDepth += 1;
  document.body.classList.add('is-photo-dragging');
}

function handlePhotoDragOver(event) {
  if (!desktopBridge || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

function handlePhotoDragLeave(event) {
  if (!desktopBridge || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
  event.preventDefault();
  photoDragDepth = Math.max(0, photoDragDepth - 1);
  if (!photoDragDepth) resetPhotoDragState();
}

function handlePhotoDrop(event) {
  if (!desktopBridge || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
  event.preventDefault();
  resetPhotoDragState();
  if (photoImportInProgress) return;
  if (desktopArchiveState?.mode !== 'folder' || !desktopArchiveState?.available) {
    showArchiveSetup('settings');
    archiveSetupError.textContent = 'Для добавления фотографий перетаскиванием сначала выберите одну папку архива.';
    archiveSetupError.hidden = false;
    return;
  }
  void showPhotoImportDialog(event.dataTransfer.files);
}

async function initializeDesktopShell() {
  if (!desktopBridge) return;
  document.body.classList.add('is-electron', `is-${desktopBridge.platform}`);
  try {
    const state = await desktopBridge.getArchiveState();
    updateArchiveSettingsUi(state);
    try {
      const storedBirthDate = await desktopBridge.getBirthDate();
      birthDate = isValidBirthDate(storedBirthDate) ? storedBirthDate : '';
      updateLifeBirthDateUi();
    } catch {
      updateLifeBirthDateUi('Не удалось прочитать сохранённую дату', true);
    }
    try {
      const desktopNavigationState = await desktopBridge.getNavigationState();
      navigationState = newestViewState(navigationState, desktopNavigationState);
      storeViewState(window.localStorage, navigationState);
    } catch {
      // Локальная копия всё равно восстановит состояние после перезагрузки страницы.
    }
    if (!state.available) {
      if (state.configured) {
        archiveSetupError.textContent = 'Ранее выбранный источник недоступен. Выберите папку или повторите поиск.';
        archiveSetupError.hidden = false;
      }
      showArchiveSetup('welcome');
      if (state.configured) archiveSetupError.hidden = false;
    }
  } catch (error) {
    updateArchiveSettingsUi(null);
    archiveSetupError.textContent = `Не удалось прочитать настройки: ${error.message}`;
    archiveSetupError.hidden = false;
    showArchiveSetup('welcome');
    archiveSetupError.hidden = false;
  }
  desktopBridge.onSettingsRequested(() => showArchiveSetup('settings'));
}

function readStoredPresentationMode() {
  try {
    return localStorage.getItem(PRESENTATION_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readStoredBlurDates() {
  try {
    const values = JSON.parse(localStorage.getItem(BLUR_DATES_STORAGE_KEY) || '[]');
    if (!Array.isArray(values)) return new Set();
    return new Set(values.filter((value) => typeof value === 'string' && DATE_KEY_PATTERN.test(value)));
  } catch {
    return new Set();
  }
}

function readStoredBirthDate() {
  try {
    const value = localStorage.getItem(LIFE_BIRTH_DATE_STORAGE_KEY) || '';
    return isValidBirthDate(value) ? value : '';
  } catch {
    return '';
  }
}

function storeBlurDates() {
  try {
    localStorage.setItem(BLUR_DATES_STORAGE_KEY, JSON.stringify([...blurDates].sort()));
  } catch {
    // При запрете localStorage источником истины остаётся файл на сервере.
  }
}

function replaceBlurDates(values) {
  blurDates = new Set(
    Array.isArray(values)
      ? values.filter((value) => typeof value === 'string' && DATE_KEY_PATTERN.test(value))
      : []
  );
  storeBlurDates();
  refreshPresentationBlurState();
}

function markPhotoForPresentation(element, date) {
  if (!date) return;
  element.dataset.photoDate = date;
  element.classList.toggle('is-presentation-blurred', blurDates.has(date));
}

function clearPhotoPresentationMark(element) {
  element.removeAttribute('data-photo-date');
  element.classList.remove('is-presentation-blurred');
}

function holdPhotoUntilReady(image) {
  image.classList.add('is-photo-pending');
}

async function revealPhotoAfterDecode(image, date, container) {
  const loadedSource = image.currentSrc || image.src;
  try {
    await image.decode();
  } catch {
    // load уже подтвердил загрузку; не блокируем показ из-за отказа decode().
  }
  if ((image.currentSrc || image.src) !== loadedSource) return false;
  if (container) markPhotoForPresentation(container, date);
  markPhotoForPresentation(image, date);
  image.classList.remove('is-photo-pending');
  return true;
}

function refreshPresentationBlurState() {
  document.querySelectorAll('[data-photo-date]').forEach((element) => {
    element.classList.toggle('is-presentation-blurred', blurDates.has(element.dataset.photoDate));
  });
  const currentDate = activePhotos[activeIndex]?.date;
  if (currentDate) viewerBlurToggle.checked = blurDates.has(currentDate);
}

function setPresentationMode(active) {
  presentationMode = active;
  try {
    localStorage.setItem(PRESENTATION_MODE_STORAGE_KEY, String(active));
  } catch {
    // Режим всё равно работает в текущей вкладке.
  }
  document.body.classList.toggle('presentation-mode', active);
  presentationButton.classList.toggle('is-active', active);
  presentationButton.setAttribute('aria-pressed', String(active));
  presentationButton.title = active ? 'Выключить режим презентации' : 'Включить режим презентации';
}

function showViewerBlurStatus(message, isError = false) {
  clearTimeout(blurStatusTimer);
  viewerBlurStatus.textContent = message;
  viewerBlurStatus.classList.toggle('is-error', isError);
  blurStatusTimer = setTimeout(() => {
    viewerBlurStatus.textContent = '';
    viewerBlurStatus.classList.remove('is-error');
  }, 2200);
}

function parseDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function utcDayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

function formatDate(dateString) {
  const date = parseDate(dateString);
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentTimelineState() {
  if (timelineRestoring || !timelineRendered || !timelineEntries.length || !timelineTrack.clientWidth) {
    return navigationState.timeline;
  }
  const { itemWidth, gap, paddingLeft } = timelineMetrics();
  const itemExtent = itemWidth + gap;
  const centeredIndex = Math.max(0, Math.min(
    timelineEntries.length - 1,
    Math.round((timelineTrack.scrollLeft + timelineTrack.clientWidth / 2 - paddingLeft - itemWidth / 2) / itemExtent)
  ));
  const maxScroll = Math.max(0, timelineTrack.scrollWidth - timelineTrack.clientWidth);
  return {
    date: timelineEntries[centeredIndex]?.dateKey || navigationState.timeline.date,
    progress: maxScroll ? timelineTrack.scrollLeft / maxScroll : 0
  };
}

function captureNavigationState() {
  const currentPhoto = viewer.open ? activePhotos[activeIndex] : null;
  return normalizeViewState({
    ...navigationState,
    updatedAt: Date.now(),
    view: activeView,
    calendar: {
      focus: calendarFocus,
      date: dateKey(visibleDate)
    },
    timeline: currentTimelineState(),
    viewer: currentPhoto ? {
      date: currentPhoto.date,
      diaryVisible: viewerDiaryVisible,
      photoId: currentPhoto.id || null
    } : null
  });
}

function persistNavigationState({ desktopDelay = 0 } = {}) {
  navigationState = captureNavigationState();
  try {
    storeViewState(window.localStorage, navigationState);
  } catch {
    // Десктопная копия остаётся доступна, даже если localStorage запрещён.
  }
  clearTimeout(navigationSaveTimer);
  if (!desktopBridge?.setNavigationState) return;
  const storeDesktopState = () => desktopBridge.setNavigationState(navigationState).catch(() => {});
  if (desktopDelay > 0) navigationSaveTimer = setTimeout(storeDesktopState, desktopDelay);
  else storeDesktopState();
}

function scheduleNavigationStateSave() {
  clearTimeout(navigationSaveTimer);
  navigationSaveTimer = setTimeout(() => persistNavigationState({ desktopDelay: 0 }), 140);
}

function isValidBirthDate(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  const date = parseDate(value);
  return dateKey(date) === value && utcDayNumber(date) <= utcDayNumber(new Date());
}

function earliestPhotoDate() {
  return [...byDate.keys()].sort()[0] || '';
}

function updateLifeBirthDateUi(message = '', isError = false) {
  lifeBirthDatePicker.setValue(birthDate);
  let status = message;
  if (!status && birthDate) status = `Отсчёт с ${formatDate(birthDate)}`;
  if (!status) {
    const fallbackDate = earliestPhotoDate();
    status = fallbackDate
      ? `Пока с первого фото — ${formatDate(fallbackDate)}`
      : 'Укажите дату для точного расчёта';
  }
  lifeBirthDateStatus.textContent = status;
  lifeBirthDateStatus.classList.toggle('is-error', isError);
  lifeBirthDateInput.classList.toggle('is-error', isError);
}

function showLifeBirthDateError(message) {
  lifeBirthDateStatus.textContent = message;
  lifeBirthDateStatus.classList.add('is-error');
  lifeBirthDateInput.classList.add('is-error');
}

function commitBirthDateInput() {
  const rawValue = lifeBirthDateInput.value.trim();
  if (!rawValue) {
    if (birthDate) saveBirthDate('');
    else updateLifeBirthDateUi();
    return;
  }
  const parsedValue = lifeBirthDatePicker.value;
  if (!parsedValue) {
    showLifeBirthDateError('Проверьте дату');
    return;
  }
  if (parsedValue === birthDate) {
    updateLifeBirthDateUi();
    return;
  }
  saveBirthDate(parsedValue);
}

function rebuildLife() {
  lifeLayout = null;
  lifeTooltip.hidden = true;
  lifeTooltipIndex = -1;
  if (birthDate || photos.length) initializeLife();
  else {
    lifeStart = null;
    lifeEnd = null;
    lifeTotalDays = 0;
    lifePhotoDates = new Map();
  }
  renderLifeCanvas();
}

async function saveBirthDate(value) {
  const previousBirthDate = birthDate;
  if (value && !isValidBirthDate(value)) {
    updateLifeBirthDateUi('Выберите корректную дату не позже сегодня', true);
    return;
  }

  lifeBirthDatePicker.disabled = true;
  lifeBirthDateStatus.classList.remove('is-error');
  lifeBirthDateStatus.textContent = 'Сохраняем…';
  try {
    if (desktopBridge) {
      value = await desktopBridge.setBirthDate(value);
    } else if (value) {
      localStorage.setItem(LIFE_BIRTH_DATE_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(LIFE_BIRTH_DATE_STORAGE_KEY);
    }
    birthDate = value;
    rebuildLife();
    updateLifeBirthDateUi();
  } catch {
    birthDate = previousBirthDate;
    updateLifeBirthDateUi('Не удалось сохранить дату', true);
  } finally {
    lifeBirthDatePicker.disabled = false;
  }
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function setNavigationState(previousDisabled, nextDisabled) {
  document.querySelector('#previousMonth').disabled = previousDisabled;
  document.querySelector('#nextMonth').disabled = nextDisabled;
}

function preferredPhotoForDate(date, dayPhotos = byDate.get(date) || []) {
  const selectedId = photoSelections.get(date);
  return dayPhotos.find((photo) => photo.id === selectedId) || dayPhotos[0] || null;
}

function makePhotoDay(date, label = date.getDate()) {
  const key = dateKey(date);
  const dayPhotos = byDate.get(key) || [];
  const hasDiary = diaryByDate.has(key);
  const cell = document.createElement(dayPhotos.length || hasDiary ? 'button' : 'div');
  cell.className = 'calendar-day';
  cell.innerHTML = `<span class="day-number">${label}</span>`;
  const today = new Date();
  if (date.toDateString() === today.toDateString()) cell.classList.add('is-today');
  if (dayPhotos.length) {
    const preferredPhoto = preferredPhotoForDate(key, dayPhotos);
    cell.type = 'button';
    cell.classList.add('has-photo');
    markPhotoForPresentation(cell, key);
    if (hasDiary) cell.classList.add('has-diary');
    cell.setAttribute('aria-label', `${formatDate(key)}, фотографий: ${dayPhotos.length}${hasDiary ? ', есть запись дня' : ''}`);
    const thumbnail = document.createElement('img');
    markPhotoForPresentation(thumbnail, key);
    holdPhotoUntilReady(thumbnail);
    thumbnail.addEventListener('load', () => revealPhotoAfterDecode(thumbnail, key, cell), { once: true });
    thumbnail.src = preferredPhoto.thumbnailSrc || preferredPhoto.src;
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    thumbnail.decoding = 'async';
    cell.prepend(thumbnail);
    if (dayPhotos.length > 1) cell.insertAdjacentHTML('beforeend', `<span class="photo-badge">${dayPhotos.length} фото</span>`);
    if (hasDiary) cell.insertAdjacentHTML('beforeend', '<span class="diary-badge" aria-label="Есть запись дня">📝</span>');
    cell.addEventListener('click', () => openViewer(dayPhotos));
  } else if (hasDiary) {
    cell.type = 'button';
    cell.classList.add('has-diary', 'is-diary-only');
    cell.setAttribute('aria-label', `${formatDate(key)}, есть запись дня`);
    cell.insertAdjacentHTML('beforeend', '<span class="diary-emoji" aria-hidden="true">📝</span>');
    cell.addEventListener('click', () => openDiary(key));
  }
  return { cell, count: dayPhotos.length, hasDiary };
}

function yearPhotoSources(year, thumbnails = false) {
  const route = thumbnails ? 'preview' : 'photo';
  return [
    (thumbnails ? yearHighlightThumbnails : yearHighlights).get(year),
    `/${route}/${year}.webp`,
    `/${route}/${encodeURIComponent(`${year}?.webp`)}`
  ];
}

function monthPhotoSources(year, month, thumbnails = false) {
  const paddedMonth = String(month + 1).padStart(2, '0');
  const route = thumbnails ? 'preview' : 'photo';
  return [
    (thumbnails ? monthHighlightThumbnails : monthHighlights).get(`${year}-${paddedMonth}`),
    `/${route}/${year}/${paddedMonth}.webp`,
    `/${route}/${year}/${encodeURIComponent(`${paddedMonth}?.webp`)}`
  ];
}

function loadFirstImage(image, candidates, onLoad, onMissing) {
  const sources = [...new Set(candidates.filter(Boolean))];
  let index = 0;
  image.onload = () => onLoad?.(image.src);
  image.onerror = () => {
    index += 1;
    if (index < sources.length) image.src = sources[index];
    else onMissing?.();
  };
  if (sources.length) image.src = sources[0];
  else onMissing?.();
}

function renderYearsCalendar() {
  monthTitle.textContent = 'Фото по годам';
  setNavigationState(true, true);
  grid.replaceChildren();
  let count = 0;
  let settled = 0;
  const settle = () => {
    settled += 1;
    if (settled === archiveYears.length && calendarFocus === 'years') {
      monthCount.textContent = count
        ? `${count} ${pluralize(count, ['фото года', 'фото года', 'фото года'])}`
        : 'Фотографии года пока не найдены';
    }
  };

  for (const year of archiveYears) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'archive-year';
    card.disabled = true;
    card.innerHTML = `<img alt="" loading="eager" decoding="async" /><span><small>Фото года</small><strong>${year}</strong></span>`;
    const image = card.querySelector('img');
    const highlightDate = yearHighlightDates.get(year);
    markPhotoForPresentation(card, highlightDate);
    markPhotoForPresentation(image, highlightDate);
    holdPhotoUntilReady(image);
    loadFirstImage(image, yearPhotoSources(year, true), () => {
      revealPhotoAfterDecode(image, highlightDate, card);
      count += 1;
      card.disabled = false;
      card.classList.add('has-photo');
      card.setAttribute('aria-label', `Открыть ${year} год`);
      card.addEventListener('click', () => {
        visibleDate = new Date(year, 0, 1);
        setCalendarFocus('year');
      });
      settle();
    }, () => {
      image.remove();
      settle();
    });
    grid.append(card);
  }
  monthCount.textContent = 'Загружаем фотографии по годам…';
}

function renderMonthCalendar() {
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingDays = (firstDay.getDay() + 6) % 7;
  let photosThisMonth = 0;
  let diaryThisMonth = 0;
  monthTitle.textContent = `${MONTHS[month]} ${year}`;
  yearSelect.value = String(year);
  setNavigationState(firstArchiveMonth
    ? visibleDate.getTime() <= firstArchiveMonth.getTime()
    : true, lastArchiveMonth
    ? visibleDate.getTime() >= lastArchiveMonth.getTime()
    : true);
  grid.replaceChildren();

  for (let index = 0; index < leadingDays; index += 1) {
    const filler = document.createElement('div');
    filler.className = 'calendar-day is-empty';
    grid.append(filler);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const result = makePhotoDay(new Date(year, month, day));
    photosThisMonth += result.count;
    diaryThisMonth += Number(result.hasDiary);
    grid.append(result.cell);
  }

  const totalCells = leadingDays + daysInMonth;
  const trailingDays = (7 - (totalCells % 7)) % 7;
  for (let index = 0; index < trailingDays; index += 1) {
    const filler = document.createElement('div');
    filler.className = 'calendar-day is-empty';
    grid.append(filler);
  }

  const monthParts = [];
  if (photosThisMonth) monthParts.push(`${photosThisMonth} ${pluralize(photosThisMonth, ['фотография', 'фотографии', 'фотографий'])}`);
  if (diaryThisMonth) monthParts.push(`${diaryThisMonth} ${pluralize(diaryThisMonth, ['запись', 'записи', 'записей'])}`);
  monthCount.textContent = monthParts.length
    ? monthParts.join(' · ')
    : 'В этом месяце пока пусто';
}

function renderWeekCalendar() {
  const weekStart = startOfWeek(visibleDate);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const earliest = firstArchiveMonth;
  const latestEnd = lastArchiveMonth && new Date(lastArchiveMonth.getFullYear(), lastArchiveMonth.getMonth() + 1, 0);
  let count = 0;
  let diaryCount = 0;
  monthTitle.textContent = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getDate()}–${weekEnd.getDate()} ${MONTHS_GENITIVE[weekStart.getMonth()]} ${weekEnd.getFullYear()}`
    : `${weekStart.getDate()} ${MONTHS_GENITIVE[weekStart.getMonth()]} — ${weekEnd.getDate()} ${MONTHS_GENITIVE[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
  yearSelect.value = String(visibleDate.getFullYear());
  setNavigationState(!earliest || weekStart <= earliest, !latestEnd || weekEnd >= latestEnd);
  grid.replaceChildren();
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
    const result = makePhotoDay(date, `<b>${date.getDate()}</b><small>${MONTHS_GENITIVE[date.getMonth()]}</small>`);
    count += result.count;
    diaryCount += Number(result.hasDiary);
    grid.append(result.cell);
  }
  const weekParts = [];
  if (count) weekParts.push(`${count} ${pluralize(count, ['фотография', 'фотографии', 'фотографий'])}`);
  if (diaryCount) weekParts.push(`${diaryCount} ${pluralize(diaryCount, ['запись', 'записи', 'записей'])}`);
  monthCount.textContent = weekParts.length
    ? weekParts.join(' · ')
    : 'На этой неделе пока пусто';
}

function renderYearCalendar() {
  const year = visibleDate.getFullYear();
  const firstYear = firstArchiveMonth?.getFullYear();
  const lastYear = lastArchiveMonth?.getFullYear();
  monthTitle.textContent = String(year);
  yearSelect.value = String(year);
  setNavigationState(firstYear == null || year <= firstYear, lastYear == null || year >= lastYear);
  grid.replaceChildren();
  const todayKey = dateKey(new Date());
  for (let month = 0; month < 12; month += 1) {
    const monthButton = document.createElement('button');
    monthButton.type = 'button';
    monthButton.className = 'year-month';
    monthButton.innerHTML = `<img class="year-month-backdrop" alt="" /><strong>${MONTHS[month]}</strong><span class="year-month-days" aria-hidden="true"></span>`;
    const monthBackdrop = monthButton.querySelector('.year-month-backdrop');
    const highlightDate = monthHighlightDates.get(`${year}-${String(month + 1).padStart(2, '0')}`);
    markPhotoForPresentation(monthButton, highlightDate);
    markPhotoForPresentation(monthBackdrop, highlightDate);
    holdPhotoUntilReady(monthBackdrop);
    loadFirstImage(monthBackdrop, monthPhotoSources(year, month, true), () => {
      revealPhotoAfterDecode(monthBackdrop, highlightDate, monthButton);
      monthButton.classList.add('has-period-photo');
    }, () => monthBackdrop.remove());
    const days = monthButton.querySelector('.year-month-days');
    let monthCount = 0;
    const leading = (new Date(year, month, 1).getDay() + 6) % 7;
    monthButton.classList.toggle('starts-late', leading >= 2);
    for (let index = 0; index < leading; index += 1) days.append(document.createElement('i'));
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= totalDays; day += 1) {
      const dayCell = document.createElement('i');
      const currentDateKey = dateKey(new Date(year, month, day));
      const dayCount = (byDate.get(currentDateKey) || []).length;
      const hasDiary = diaryByDate.has(currentDateKey);
      dayCell.textContent = String(day);
      if (dayCount) dayCell.classList.add('has-photo');
      if (hasDiary) {
        dayCell.classList.add('has-diary');
        dayCell.title = 'Есть запись дня';
      }
      if (currentDateKey === todayKey) dayCell.classList.add('is-today');
      monthCount += dayCount;
      days.append(dayCell);
    }
    monthButton.setAttribute('aria-label', `${MONTHS[month]} ${year}, фотографий: ${monthCount}`);
    monthButton.addEventListener('click', () => {
      visibleDate = new Date(year, month, 1);
      setCalendarFocus('month');
    });
    grid.append(monthButton);
  }
  monthCount.textContent = '';
}

function renderCalendar() {
  grid.className = `calendar-grid is-${calendarFocus}`;
  document.querySelector('.weekdays').hidden = calendarFocus === 'year' || calendarFocus === 'years';
  document.querySelector('#calendarView').classList.toggle('is-years-focus', calendarFocus === 'years');
  const navigationLabels = calendarFocus === 'week'
    ? ['Предыдущая неделя', 'Следующая неделя']
    : calendarFocus === 'year' || calendarFocus === 'years'
      ? ['Предыдущий год', 'Следующий год']
      : ['Предыдущий месяц', 'Следующий месяц'];
  document.querySelector('#previousMonth').setAttribute('aria-label', navigationLabels[0]);
  document.querySelector('#nextMonth').setAttribute('aria-label', navigationLabels[1]);
  if (calendarFocus === 'years') renderYearsCalendar();
  else if (calendarFocus === 'year') renderYearCalendar();
  else if (calendarFocus === 'week') renderWeekCalendar();
  else renderMonthCalendar();
}

function pluralize(value, forms) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 19) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function shiftMonth(amount) {
  if (calendarFocus === 'years') return;
  if (calendarFocus === 'year') visibleDate = new Date(visibleDate.getFullYear() + amount, 0, 1);
  else if (calendarFocus === 'week') visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth(), visibleDate.getDate() + amount * 7);
  else visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + amount, 1);
  renderCalendar();
  persistNavigationState();
}

function setCalendarFocus(focus) {
  if (focus === 'week') visibleDate = new Date();
  calendarFocus = focus;
  document.querySelectorAll('[data-calendar-focus]').forEach((button) => {
    const active = button.dataset.calendarFocus === focus;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderCalendar();
  persistNavigationState();
}

function photoHasLocation(photo) {
  return Boolean(normalizeMapCoordinates(photo));
}

function photoLocationLabel(photo) {
  if (photo?.locationSource === 'manual') {
    return [photo.locationPlace, photo.locationCountry].filter(Boolean).join(' · ')
      || 'Место указано вручную';
  }
  if (photo?.locationSource === 'exif') return 'Координаты из EXIF';
  if (photo?.locationSource === 'home-office+organic-maps') {
    return photo.locationPlace
      ? `${photo.locationPlace} · home-office + Organic Maps`
      : 'Данные home-office + Organic Maps';
  }
  if (photo?.locationSource === 'home-office') {
    return photo.locationPlace
      ? `${photo.locationPlace} · home-office`
      : 'Данные home-office';
  }
  if (photo?.locationSource === 'organic-maps') {
    return photo.locationPlace
      ? `${photo.locationPlace} · Organic Maps`
      : 'Данные Organic Maps';
  }
  if (photo?.locationSource === 'photo') {
    return photo.locationPlace
      ? `${photo.locationPlace} · распознано по фотографии`
      : 'Место распознано по фотографии';
  }
  return 'Место не указано';
}

function normalizeLocationDraft(value) {
  const coordinates = normalizeMapCoordinates(value);
  if (!coordinates) return null;
  const placeValue = value?.coordinatesOnly ? value.place : value?.place || value?.displayName;
  const place = typeof placeValue === 'string' ? placeValue.trim().slice(0, 240) : '';
  const country = typeof value?.country === 'string' ? value.country.trim().slice(0, 120) : '';
  const referenceId = typeof value?.referenceId === 'string'
    ? value.referenceId.trim().slice(0, 128)
    : '';
  return {
    ...coordinates,
    ...(place ? { place } : {}),
    ...(country ? { country } : {}),
    ...(referenceId ? { referenceId } : {}),
    ...(value?.boundingBox ? { boundingBox: value.boundingBox } : {})
  };
}

function locationSearchZoom(result) {
  const bounds = result?.boundingBox;
  if (!bounds) return 15;
  const latitudeSpan = Math.abs(Number(bounds.north) - Number(bounds.south));
  let longitudeSpan = Math.abs(Number(bounds.east) - Number(bounds.west));
  if (longitudeSpan > 180) longitudeSpan = 360 - longitudeSpan;
  const span = Math.max(latitudeSpan, longitudeSpan);
  if (span > 40) return 3;
  if (span > 10) return 5;
  if (span > 2) return 7;
  if (span > 0.5) return 9;
  if (span > 0.1) return 11;
  if (span > 0.02) return 13;
  if (span > 0.005) return 15;
  return 16;
}

function coordinateSearchResult(query) {
  const location = parseCoordinateQuery(query);
  if (!location) return null;
  const displayName = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  return { ...location, displayName, coordinatesOnly: true };
}

async function findLocationResults(query, signal) {
  const coordinates = coordinateSearchResult(query);
  if (coordinates) return [coordinates];
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('ru-RU');
  const localResults = sortedReferencePlaces(locationReferencePlaces.filter((place) => (
    referencePlaceVariants(place).flatMap((variant) => [
      variant.name,
      variant.country,
      variant.collection
    ])
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase('ru-RU').includes(normalizedQuery))
  ))).slice(0, 8).map((place) => ({
    ...place,
    referenceId: place.id,
    place: place.name,
    displayName: [place.name, place.country, referenceSourceLabel(place)].filter(Boolean).join(' · '),
    localReference: true
  }));
  if (localResults.length) return localResults;
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Не удалось найти место');
  return (Array.isArray(result) ? result : []).flatMap((value) => {
    const location = normalizeLocationDraft(value);
    return location ? [{
      ...value,
      ...location,
      displayName: value.displayName || `${location.latitude}, ${location.longitude}`
    }] : [];
  });
}

function setupLocationSearch({
  form,
  input,
  resultsElement,
  suggestionsButton,
  getMap,
  onSelect,
  getSuggestionSections
}) {
  let requestController = null;
  const submitButton = form.querySelector(':scope > button[type="submit"]');

  function hideResults() {
    resultsElement.hidden = true;
    resultsElement.dataset.content = '';
    suggestionsButton?.setAttribute('aria-expanded', 'false');
  }

  function showStatus(message, isError = false) {
    const status = document.createElement('span');
    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.setAttribute('role', isError ? 'alert' : 'status');
    resultsElement.replaceChildren(status);
    resultsElement.dataset.content = 'search';
    resultsElement.hidden = false;
    suggestionsButton?.setAttribute('aria-expanded', 'false');
  }

  function choose(result) {
    const location = normalizeLocationDraft(result);
    if (!location) return;
    const map = getMap();
    map?.setCenter(location, locationSearchZoom(result));
    map?.setSelection(location);
    input.value = result.displayName || `${location.latitude}, ${location.longitude}`;
    hideResults();
    onSelect?.(location, result);
  }

  function resultButton(result) {
    const button = document.createElement('button');
    const title = document.createElement('strong');
    const details = document.createElement('small');
    button.type = 'button';
    title.textContent = result.displayName;
    title.title = result.displayName;
    details.textContent = result.suggestionDetail
      || `${Number(result.latitude).toFixed(5)}, ${Number(result.longitude).toFixed(5)}`;
    button.replaceChildren(title, details);
    button.addEventListener('click', () => choose(result));
    return button;
  }

  function showResults(results) {
    if (!results.length) {
      showStatus('Ничего не найдено. Попробуйте уточнить запрос.', true);
      return;
    }
    const buttons = results.map(resultButton);
    resultsElement.replaceChildren(...buttons);
    resultsElement.dataset.content = 'search';
    resultsElement.hidden = false;
    suggestionsButton?.setAttribute('aria-expanded', 'false');
  }

  function showSuggestions() {
    const sections = getSuggestionSections?.() || [];
    const nodes = sections.flatMap((section) => {
      if (!section.results?.length) return [];
      const heading = document.createElement('span');
      heading.className = 'map-search-results-heading';
      heading.textContent = section.title;
      return [heading, ...section.results.map(resultButton)];
    });
    resultsElement.replaceChildren(...nodes);
    resultsElement.dataset.content = 'suggestions';
    resultsElement.hidden = nodes.length === 0;
    suggestionsButton?.setAttribute('aria-expanded', String(nodes.length > 0));
  }

  suggestionsButton?.addEventListener('click', () => {
    if (!resultsElement.hidden && resultsElement.dataset.content === 'suggestions') {
      hideResults();
      return;
    }
    showSuggestions();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (query.length < 2) {
      showStatus('Введите координаты, улицу, город или страну.', true);
      return;
    }
    requestController?.abort();
    requestController = new AbortController();
    submitButton.disabled = true;
    showStatus('Ищем место…');
    try {
      const results = await findLocationResults(query, requestController.signal);
      if (results.length === 1 && coordinateSearchResult(query)) choose(results[0]);
      else showResults(results);
    } catch (error) {
      if (error.name !== 'AbortError') showStatus(error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    requestController?.abort();
    hideResults();
    input.blur();
  });
  input.addEventListener('input', () => {
    hideResults();
  });

  return {
    clear() {
      requestController?.abort();
      hideResults();
    },
    showSuggestions
  };
}

function updatePhotoLocationState(state, { render = true } = {}) {
  const photo = photos.find((candidate) => candidate.id === state?.photoId);
  if (!photo) return null;
  delete photo.latitude;
  delete photo.longitude;
  delete photo.locationSource;
  delete photo.locationPlace;
  delete photo.locationCountry;
  delete photo.locationReferenceId;
  delete photo.locationHidden;
  if (state.locationHidden) photo.locationHidden = true;
  const location = normalizeMapCoordinates(state);
  if (location) {
    photo.latitude = location.latitude;
    photo.longitude = location.longitude;
    photo.locationSource = state.locationSource || 'manual';
    if (state.locationPlace) photo.locationPlace = state.locationPlace;
    if (state.locationCountry) photo.locationCountry = state.locationCountry;
    if (state.locationReferenceId) photo.locationReferenceId = state.locationReferenceId;
  }
  if (render) {
    if (mapPlaybackActive) stopMapPlayback({ render: false });
    renderMapLocations();
    viewerLocationMap?.setPoints(mapPointCollections().points);
  }
  if (viewer.open && activePhotos[activeIndex]?.id === photo.id) {
    updateViewerLocationControls(photo);
    updateViewerMiniMap(photo);
  }
  return photo;
}

async function persistPhotoLocation(photo, location) {
  if (!photo?.id) throw new Error('Фотография не найдена');
  const normalizedLocation = normalizeLocationDraft(location);
  const response = await fetch(`/api/photo-locations/${encodeURIComponent(photo.id)}`, {
    method: normalizedLocation ? 'PUT' : 'DELETE',
    headers: normalizedLocation ? { 'Content-Type': 'application/json' } : undefined,
    body: normalizedLocation ? JSON.stringify(normalizedLocation) : undefined
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Не удалось сохранить место');
  if (normalizedLocation?.referenceId) rememberRecentPlace(normalizedLocation.referenceId);
  return updatePhotoLocationState(result);
}

async function hidePhotoOnMap(photo) {
  if (!photo?.id) throw new Error('Фотография не найдена');
  const response = await fetch(
    `/api/photo-locations/${encodeURIComponent(photo.id)}/map`,
    { method: 'DELETE' }
  );
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Не удалось убрать фотографию с карты');
  return updatePhotoLocationState(result);
}

function locatedPhotoCount() {
  return photos.reduce((count, photo) => count + Number(photoHasLocation(photo)), 0);
}

function referenceSourceLabel(place) {
  const sources = new Set(referencePlaceVariants(place).map((variant) => variant.source));
  if (sources.has('home-office') && sources.has('organic-maps')) {
    return 'Obsidian + Organic Maps';
  }
  if (place?.source === 'home-office') return 'Obsidian';
  if (place?.source === 'organic-maps') return 'Organic Maps';
  return 'Добавлено вручную';
}

function referencePlaceVariants(place) {
  return [
    place,
    ...(Array.isArray(place?.mergedPlaces) ? place.mergedPlaces : [])
  ].filter(Boolean);
}

function referenceEvidenceLabel(place) {
  if (place?.evidence === 'visited') return 'посещено';
  if (place?.evidence === 'dated-media') return 'есть датированные фотографии';
  if (place?.evidence === 'media') return 'есть фотографии';
  if (place?.evidence === 'bookmark') return 'сохранённая метка';
  if (place?.evidence === 'manual') return '';
  return 'место из справочника';
}

function sortedReferencePlaces(places) {
  const priority = { manual: 0, visited: 1, 'dated-media': 2, media: 3, bookmark: 4, reference: 5 };
  return [...places].sort((a, b) => (
    (priority[a.evidence] ?? 9) - (priority[b.evidence] ?? 9)
      || a.name.localeCompare(b.name, 'ru')
  ));
}

function relatedPlacesForPhoto(photo) {
  return sortedReferencePlaces(
    relatedReferencePlaces(locationReferencePlaces, photo ? [photo] : [])
  );
}

function referencePlaceLabel(place) {
  return [place?.name, place?.country].filter(Boolean).join(' · ');
}

function locationFromReferencePlace(place) {
  if (!place) return null;
  return normalizeLocationDraft({
    latitude: place.latitude,
    longitude: place.longitude,
    place: place.name,
    country: place.country,
    referenceId: place.id
  });
}

function preferredReferencePlace(points) {
  return sortedReferencePlaces(
    (Array.isArray(points) ? points : []).filter((point) => point.mapPointType === 'reference')
  )[0] || null;
}

function referencePointPreview(points) {
  const groupPlaces = sortedReferencePlaces(
    (Array.isArray(points) ? points : []).filter((point) => point.mapPointType === 'reference')
  );
  const place = groupPlaces[0];
  if (!place) return null;
  return {
    title: place.name,
    subtitle: groupPlaces.length > 1
      ? `${groupPlaces.length.toLocaleString('ru-RU')} ${pluralize(groupPlaces.length, ['место', 'места', 'мест'])} · ${referenceSourceLabel(place)}`
      : [place.country, referenceSourceLabel(place)].filter(Boolean).join(' · ')
  };
}

function mapPointPreview(group) {
  const groupPhotos = (Array.isArray(group) ? group : [])
    .filter((point) => point.mapPointType === 'photo')
    .sort((a, b) => b.date.localeCompare(a.date));
  if (groupPhotos.length) {
    const photo = groupPhotos[0];
    const relatedPlace = relatedPlacesForPhoto(photo)[0];
    const countLabel = groupPhotos.length > 1
      ? `${groupPhotos.length.toLocaleString('ru-RU')} ${pluralize(groupPhotos.length, ['фотография', 'фотографии', 'фотографий'])}`
      : '';
    return {
      src: photo.thumbnailSrc || photo.src,
      alt: `Фото за ${formatDate(photo.date)}`,
      title: formatDate(photo.date),
      subtitle: [
        countLabel,
        relatedPlace ? referencePlaceLabel(relatedPlace) : photoLocationLabel(photo)
      ].filter(Boolean).join(' · ')
    };
  }
  return referencePointPreview(group);
}

function openMapFanPhoto(photo) {
  if (!photo?.src) return;
  const dayPhotos = byDate.get(photo.date) || [photo];
  const index = Math.max(0, dayPhotos.findIndex((candidate) => candidate.id === photo.id));
  openViewer(dayPhotos, index);
}

function mapPlaybackPreview(frame) {
  const photo = frame?.photo;
  if (!photo) return null;
  const count = frame.photos.length;
  const countLabel = count > 1
    ? `${count.toLocaleString('ru-RU')} ${pluralize(count, ['фотография', 'фотографии', 'фотографий'])}`
    : '';
  return {
    src: photo.thumbnailSrc || photo.src,
    fallbackSrc: photo.src,
    alt: `Фото за ${formatDate(frame.date)}`,
    title: formatDate(frame.date),
    subtitle: [countLabel, photoLocationLabel(photo)].filter(Boolean).join(' · '),
    ariaLabel: `Открыть фото за ${formatDate(frame.date)}`,
    photo
  };
}

function scheduleMapPlayback() {
  clearTimeout(mapPlaybackTimer);
  mapPlaybackTimer = 0;
  if (!mapPlaybackActive || !mapPlaybackPlaying || mapPlaybackFrames.length < 2) return;
  mapPlaybackTimer = setTimeout(() => {
    mapPlaybackTimer = 0;
    if (!mapPlaybackActive || !mapPlaybackPlaying) return;
    if (mapPlaybackIndex >= mapPlaybackFrames.length - 1) {
      setMapPlaybackPlaying(false);
      return;
    }
    setMapPlaybackFrame(mapPlaybackIndex + 1);
    scheduleMapPlayback();
  }, mapPlaybackDelay(mapPlaybackSpeed.value));
}

function setMapPlaybackPlaying(playing) {
  mapPlaybackPlaying = Boolean(
    playing
    && mapPlaybackActive
    && mapPlaybackFrames.length > 1
  );
  clearTimeout(mapPlaybackTimer);
  mapPlaybackTimer = 0;
  mapPlaybackPlay.textContent = mapPlaybackPlaying ? '❚❚' : '▶';
  mapPlaybackPlay.setAttribute(
    'aria-label',
    mapPlaybackPlaying ? 'Приостановить анимацию' : 'Запустить анимацию'
  );
  mapPlayback.classList.toggle('is-playing', mapPlaybackPlaying);
  if (mapPlaybackPlaying) scheduleMapPlayback();
}

function setMapPlaybackFrame(index, { restartTimer = false } = {}) {
  if (!mapPlaybackActive || !mapPlaybackFrames.length) return;
  const nextIndex = Math.max(0, Math.min(
    mapPlaybackFrames.length - 1,
    Math.round(Number(index) || 0)
  ));
  mapPlaybackIndex = nextIndex;
  const frame = mapPlaybackFrames[nextIndex];
  mapPlaybackDate.textContent = formatDate(frame.date);
  mapPlaybackPosition.textContent = `${(nextIndex + 1).toLocaleString('ru-RU')} / ${mapPlaybackFrames.length.toLocaleString('ru-RU')}`;
  mapPlaybackRange.value = String(nextIndex);
  mapPlaybackPrevious.disabled = nextIndex === 0;
  mapPlaybackNext.disabled = nextIndex === mapPlaybackFrames.length - 1;
  mapController?.setPlaybackRoute(
    mapPlaybackFrames.slice(0, nextIndex + 1).map((candidate) => candidate.photo),
    {
      activePoint: frame.photo,
      preview: mapPlaybackPreview(frame)
    }
  );
  if (restartTimer && mapPlaybackPlaying) scheduleMapPlayback();
}

function openMapPlaybackPhoto(photo) {
  setMapPlaybackPlaying(false);
  openMapFanPhoto(photo);
}

function startMapPlayback() {
  ensureMap();
  if (mapAssignmentPhotos.length || !mapPlaceEditor.hidden) return;
  const locatedPhotos = photos.filter(photoHasLocation);
  mapPlaybackFrames = buildMapPlaybackFrames(locatedPhotos, photoSelections);
  if (!mapPlaybackFrames.length) return;

  mapPlaybackActive = true;
  mapPlaybackIndex = 0;
  mapPhotoCard.hidden = true;
  mapController.setHighlightedPoint(null);
  mapPlayback.hidden = false;
  mapPlaybackButton.setAttribute('aria-pressed', 'true');
  mapPlaybackButton.textContent = 'Закрыть анимацию';
  mapStageWrap.classList.add('is-playing-route');
  mapPlaybackRange.max = String(mapPlaybackFrames.length - 1);
  mapPlaybackRange.disabled = mapPlaybackFrames.length < 2;
  mapPlaybackPlay.disabled = mapPlaybackFrames.length < 2;
  mapAssignButton.disabled = true;
  mapAddPlaceButton.disabled = true;
  mapController.fitPoints(mapPlaybackFrames.map((frame) => frame.photo));
  setMapPlaybackFrame(0);
  setMapPlaybackPlaying(mapPlaybackFrames.length > 1);
}

function stopMapPlayback({ render = true } = {}) {
  clearTimeout(mapPlaybackTimer);
  mapPlaybackTimer = 0;
  mapPlaybackPlaying = false;
  mapPlaybackActive = false;
  mapPlaybackFrames = [];
  mapPlaybackIndex = 0;
  mapPlayback.hidden = true;
  mapPlayback.classList.remove('is-playing');
  mapPlaybackPlay.textContent = '▶';
  mapPlaybackPlay.setAttribute('aria-label', 'Запустить анимацию');
  mapPlaybackButton.setAttribute('aria-pressed', 'false');
  mapPlaybackButton.textContent = 'Анимация';
  mapStageWrap.classList.remove('is-playing-route');
  mapController?.setPlaybackRoute([]);
  if (render) renderMapLocations();
}

function referenceMapPoints(locatedPhotos) {
  return visibleReferencePoints(locationReferencePlaces, locatedPhotos);
}

function mapPointCollections() {
  const locatedPhotos = photos.filter(photoHasLocation);
  const photoPoints = locatedPhotos.map((photo) => ({ ...photo, mapPointType: 'photo' }));
  const referencePoints = referenceMapPoints(locatedPhotos);
  return { locatedPhotos, points: [...referencePoints, ...photoPoints] };
}

function renderMapLocations({ fit = false } = {}) {
  const { locatedPhotos, points } = mapPointCollections();
  const withoutLocation = unlocatedPhotos(photos).length;
  const places = distinctMapPointCount(points);
  const playbackFrameCount = buildMapPlaybackFrames(locatedPhotos, photoSelections).length;

  mapSummary.innerHTML = `<strong>${places.toLocaleString('ru-RU')} ${pluralize(places, ['место', 'места', 'мест'])}</strong>${locatedPhotos.length.toLocaleString('ru-RU')} ${pluralize(locatedPhotos.length, ['фотография', 'фотографии', 'фотографий'])}`;
  mapAssignButton.disabled = withoutLocation === 0
    || mapAssignmentSaving
    || Boolean(mapAssignmentPhotos.length)
    || mapPlaybackActive;
  mapAssignButton.textContent = withoutLocation
    ? `Расставить без места · ${withoutLocation.toLocaleString('ru-RU')}`
    : 'Все фотографии на карте';
  mapAddPlaceButton.disabled = mapPlaceSaving
    || Boolean(mapAssignmentPhotos.length)
    || !mapPlaceEditor.hidden
    || mapPlaybackActive;
  mapPlaybackButton.disabled = playbackFrameCount === 0
    || Boolean(mapAssignmentPhotos.length)
    || !mapPlaceEditor.hidden;
  mapEmpty.hidden = Boolean(points.length) || Boolean(mapAssignmentPhotos.length);
  mapController?.setPoints(points, { fit });
}

function setMapPlaceDraft(location, { suggestName = '', country = '' } = {}) {
  const coordinates = normalizeMapCoordinates(location);
  if (!coordinates) return;
  mapPlaceDraft = coordinates;
  mapController?.setSelection(coordinates);
  if (suggestName && !mapPlaceName.value.trim()) {
    mapPlaceName.value = suggestName.split(',')[0].trim().slice(0, 240);
  }
  if (country && !mapPlaceCountry.value.trim()) mapPlaceCountry.value = country.slice(0, 120);
  mapPlaceCoordinates.textContent = `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
  mapPlaceError.hidden = true;
  mapPlaceSave.disabled = !mapPlaceName.value.trim() || mapPlaceSaving;
}

function startMapPlaceCreation() {
  if (mapPlaybackActive) stopMapPlayback({ render: false });
  ensureMap();
  if (mapAssignmentPhotos.length) return;
  mapPhotoCard.hidden = true;
  mapPlaceEditorMode = 'create';
  mapPlaceEditingPlace = null;
  mapPlaceDraft = null;
  mapPlaceSaving = false;
  mapPlaceEditorKicker.textContent = 'Новое место';
  mapPlaceEditorTitle.textContent = 'Поставьте точку на карте';
  mapPlaceName.value = '';
  mapPlaceCountry.value = '';
  mapPlaceCoordinates.textContent = 'Нажмите на карте или найдите адрес';
  mapPlaceError.hidden = true;
  mapPlaceSave.disabled = true;
  mapPlaceSave.textContent = 'Сохранить место';
  mapPlaceEditor.hidden = false;
  mapStageWrap.classList.add('is-adding-place');
  mapController.setSelection(null);
  mapController.setHighlightedPoint(null);
  mapController.setSelectionMode(true);
  mapAddPlaceButton.disabled = true;
  mapAssignButton.disabled = true;
  mapPlaceName.focus();
}

function startMapPointRename() {
  if (mapAssignmentPhotos.length || mapPlaceSaving || mapPointDeleting) return;
  if (mapPlaybackActive) stopMapPlayback({ render: false });
  ensureMap();
  const place = activeMapPlaceForEditing();
  const photo = activeMapPhotos[activeMapPhotoIndex];
  const coordinates = normalizeMapCoordinates(place || photo);
  if (!coordinates) return;
  const namedPhoto = activeMapPhotos.find((candidate) => candidate.locationPlace) || photo;
  mapPlaceEditorMode = place ? 'rename' : 'name-photo';
  mapPlaceEditingPlace = place || null;
  mapPlaceDraft = coordinates;
  mapPlaceSaving = false;
  mapPlaceEditorKicker.textContent = place ? 'Сохранённое место' : 'Место с фотографиями';
  mapPlaceEditorTitle.textContent = place ? 'Измените название' : 'Назовите это место';
  mapPlaceName.value = place?.name || namedPhoto?.locationPlace || '';
  mapPlaceCountry.value = place?.country || namedPhoto?.locationCountry || '';
  mapPlaceCoordinates.textContent = `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
  mapPlaceError.hidden = true;
  mapPlaceSave.disabled = !mapPlaceName.value.trim();
  mapPlaceSave.textContent = place ? 'Сохранить название' : 'Назвать место';
  mapPlaceEditor.hidden = false;
  mapStageWrap.classList.add('is-adding-place');
  mapController.setSelection(coordinates);
  mapController.setSelectionMode(false);
  mapAddPlaceButton.disabled = true;
  mapAssignButton.disabled = true;
  mapPlaceName.focus();
  mapPlaceName.select();
}

function finishMapPlaceCreation() {
  mapPlaceEditor.hidden = true;
  mapPlaceDraft = null;
  mapPlaceSaving = false;
  mapPlaceEditorMode = 'create';
  mapPlaceEditingPlace = null;
  mapStageWrap.classList.remove('is-adding-place');
  mapController?.setSelection(null);
  mapController?.setSelectionMode(false);
  mapLocationSearch?.clear();
  renderMapLocations();
  if (activeMapPhotos.length) renderMapPhotoCard();
  else if (activeMapPlaces.length) renderMapPlaceCard();
}

async function saveMapPlace() {
  const name = mapPlaceName.value.trim();
  if (!mapPlaceDraft || !name || mapPlaceSaving) {
    mapPlaceError.textContent = mapPlaceDraft
      ? 'Укажите название места'
      : 'Поставьте точку на карте или найдите адрес';
    mapPlaceError.hidden = false;
    return;
  }
  mapPlaceSaving = true;
  mapPlaceSave.disabled = true;
  mapPlaceError.hidden = true;
  try {
    const editingPlace = mapPlaceEditingPlace;
    const editorMode = mapPlaceEditorMode;
    const response = await fetch(editingPlace
      ? `/api/location-reference/${encodeURIComponent(editingPlace.id)}`
      : '/api/location-reference', {
      method: mapPlaceEditingPlace ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingPlace ? {
        name,
        country: mapPlaceCountry.value.trim()
      } : {
        ...mapPlaceDraft,
        name,
        country: mapPlaceCountry.value.trim()
      })
    });
    const place = await response.json().catch(() => null);
    if (!response.ok) throw new Error(place?.error || 'Не удалось сохранить место');
    if (editingPlace) {
      locationReferencePlaces = locationReferencePlaces.map((candidate) => (
        candidate.id === place.id ? place : candidate
      ));
      activeMapPlaces = activeMapPlaces.map((candidate) => (
        candidate.id === place.id ? place : candidate
      ));
      activeMapRelatedPlaces = activeMapRelatedPlaces.map((candidate) => (
        candidate.id === place.id ? place : candidate
      ));
    } else {
      locationReferencePlaces.push(place);
    }
    if (editorMode === 'create') {
      activeMapPhotos = [];
      activeMapRelatedPlaces = [];
      activeMapPlaces = [place];
      activeMapPlaceIndex = 0;
    } else if (editorMode === 'name-photo') {
      activeMapPlaces = [];
      activeMapRelatedPlaces = sortedReferencePlaces(
        relatedReferencePlaces(locationReferencePlaces, activeMapPhotos)
      );
    }
    finishMapPlaceCreation();
    mapController?.setCenter(place, Math.max(12, mapController.getCenter().zoom));
    viewerLocationMap?.setPoints(mapPointCollections().points);
  } catch (error) {
    mapPlaceError.textContent = error.message;
    mapPlaceError.hidden = false;
  } finally {
    mapPlaceSaving = false;
    if (!mapPlaceEditor.hidden) mapPlaceSave.disabled = !mapPlaceDraft || !mapPlaceName.value.trim();
  }
}

function ensureMap() {
  if (mapController) {
    mapController.scheduleRender();
    renderMapLocations();
    return;
  }
  mapController = new InteractiveMap(photoMap, {
    center: { latitude: 30, longitude: 20 },
    zoom: 2,
    onMapClick: (location) => {
      if (mapAssignmentPhotos.length) {
        void assignCurrentPhotoToLocation(location);
      } else if (!mapPlaceEditor.hidden) {
        if (mapPlaceEditorMode === 'create') setMapPlaceDraft(location);
      } else {
        mapController?.setSelection(null);
        mapController?.setHighlightedPoint(null);
        mapPhotoCard.hidden = true;
      }
    },
    onPointClick: (group) => {
      if (mapAssignmentPhotos.length) {
        const place = preferredReferencePlace(group);
        void assignCurrentPhotoToLocation(
          locationFromReferencePlace(place) || normalizeLocationDraft(group[0])
        );
      } else if (!mapPlaceEditor.hidden) {
        if (mapPlaceEditorMode === 'create') {
          const place = preferredReferencePlace(group);
          const location = locationFromReferencePlace(place) || normalizeLocationDraft(group[0]);
          setMapPlaceDraft(location, {
            suggestName: place?.name,
            country: place?.country
          });
        }
      } else {
        showMapPointGroup(group);
      }
    },
    onPhotoClick: openMapFanPhoto,
    onPlaybackPhotoClick: openMapPlaybackPhoto,
    pointPreview: mapPointPreview
  });
  renderMapLocations({ fit: !mapDidFitPoints });
  mapDidFitPoints = true;
}

function renderMapPhotoCard() {
  const photo = activeMapPhotos[activeMapPhotoIndex];
  if (!photo) {
    mapController?.setHighlightedPoint(null);
    mapPhotoChoosePlace.hidden = true;
    mapPointRename.hidden = true;
    mapPointDelete.hidden = true;
    mapPhotoCard.hidden = true;
    return;
  }
  mapController?.setHighlightedPoint(photo);
  const relatedPlace = relatedPlacesForPhoto(photo)[0];
  mapPhotoCard.classList.remove('is-place-only');
  mapPhotoPreview.hidden = false;
  mapPlaceAttachPhoto.hidden = !relatedPlace;
  mapPlaceAttachPhoto.textContent = 'Привязать ещё';
  const fallback = photo.src;
  mapPhotoImage.src = photo.thumbnailSrc || fallback;
  mapPhotoImage.dataset.fallbackSrc = fallback;
  mapPhotoImage.alt = `Фото за ${formatDate(photo.date)}`;
  mapPhotoPreview.setAttribute('aria-label', `Открыть фото за ${formatDate(photo.date)}`);
  mapPhotoPosition.textContent = activeMapPhotos.length > 1
    ? `${(activeMapPhotoIndex + 1).toLocaleString('ru-RU')} из ${activeMapPhotos.length.toLocaleString('ru-RU')}`
    : photoLocationLabel(photo);
  mapPhotoDate.textContent = formatDate(photo.date);
  mapPhotoSource.textContent = relatedPlace
    ? referencePlaceLabel(relatedPlace)
    : photoLocationLabel(photo);
  document.querySelector('#mapPhotoPrevious').disabled = activeMapPhotos.length < 2;
  document.querySelector('#mapPhotoNext').disabled = activeMapPhotos.length < 2;
  document.querySelector('#mapPhotoPrevious').setAttribute('aria-label', 'Предыдущая фотография');
  document.querySelector('#mapPhotoNext').setAttribute('aria-label', 'Следующая фотография');
  const choosePlaceLabel = relatedPlace ? 'Сменить место' : 'Выбрать место';
  mapPhotoChoosePlace.hidden = false;
  mapPhotoChoosePlace.textContent = choosePlaceLabel;
  mapPhotoChoosePlace.title = `${choosePlaceLabel} (M)`;
  mapPhotoChoosePlace.disabled = mapPlacePickerSaving;
  mapPointRename.hidden = false;
  mapPointRename.textContent = relatedPlace ? 'Переименовать' : 'Назвать место';
  mapPointRename.disabled = mapPlaceSaving;
  mapPointDelete.hidden = false;
  mapPointDelete.textContent = relatedPlace ? 'Удалить место' : 'Убрать с карты';
  mapPointDelete.disabled = mapPointDeleting;
  mapPhotoCard.hidden = false;
}

function showMapPhotoGroup(group, relatedPlaces = []) {
  activeMapPlaces = [];
  activeMapPlaceIndex = 0;
  activeMapRelatedPlaces = sortedReferencePlaces(relatedPlaces);
  activeMapPhotos = [...group].sort((a, b) => b.date.localeCompare(a.date));
  activeMapPhotoIndex = 0;
  renderMapPhotoCard();
}

function renderMapPlaceCard() {
  const place = activeMapPlaces[activeMapPlaceIndex];
  if (!place) {
    mapController?.setHighlightedPoint(null);
    mapPhotoChoosePlace.hidden = true;
    mapPointRename.hidden = true;
    mapPointDelete.hidden = true;
    mapPhotoCard.hidden = true;
    return;
  }
  mapController?.setHighlightedPoint(place);
  activeMapPhotos = [];
  activeMapRelatedPlaces = [];
  mapPhotoCard.classList.add('is-place-only');
  mapPhotoPreview.hidden = true;
  mapPhotoImage.removeAttribute('src');
  mapPhotoImage.removeAttribute('data-fallback-src');
  mapPhotoPosition.textContent = activeMapPlaces.length > 1
    ? `${(activeMapPlaceIndex + 1).toLocaleString('ru-RU')} из ${activeMapPlaces.length.toLocaleString('ru-RU')} в этой точке`
    : referenceSourceLabel(place);
  mapPhotoDate.textContent = place.name;
  mapPhotoSource.textContent = [
    place.country,
    referenceSourceLabel(place),
    referenceEvidenceLabel(place)
  ].filter(Boolean).join(' · ');
  document.querySelector('#mapPhotoPrevious').disabled = activeMapPlaces.length < 2;
  document.querySelector('#mapPhotoNext').disabled = activeMapPlaces.length < 2;
  document.querySelector('#mapPhotoPrevious').setAttribute('aria-label', 'Предыдущее место');
  document.querySelector('#mapPhotoNext').setAttribute('aria-label', 'Следующее место');
  mapPhotoChoosePlace.hidden = true;
  mapPlaceAttachPhoto.hidden = false;
  mapPointRename.hidden = false;
  mapPointRename.textContent = 'Переименовать';
  mapPointRename.disabled = mapPlaceSaving;
  mapPointDelete.hidden = false;
  mapPointDelete.textContent = 'Удалить место';
  mapPointDelete.disabled = mapPointDeleting;
  mapPhotoCard.hidden = false;
}

function showMapPointGroup(group) {
  const groupPhotos = group.filter((point) => point.mapPointType === 'photo');
  const groupPlaces = group.filter((point) => point.mapPointType === 'reference');
  if (groupPhotos.length) {
    const relatedPlaces = relatedReferencePlaces(locationReferencePlaces, groupPhotos);
    showMapPhotoGroup(groupPhotos, relatedPlaces.length ? relatedPlaces : groupPlaces);
    return;
  }
  activeMapPhotos = [];
  activeMapPhotoIndex = 0;
  activeMapPlaces = sortedReferencePlaces(
    groupPlaces
  );
  activeMapPlaceIndex = 0;
  renderMapPlaceCard();
}

function activeMapPlaceForDeletion() {
  return activeMapPlaceForEditing();
}

function activeMapPlaceForEditing() {
  const photo = activeMapPhotos[activeMapPhotoIndex];
  return activeMapPlaces[activeMapPlaceIndex] || relatedPlacesForPhoto(photo)[0] || null;
}

function refreshMapCardAfterDeletion() {
  activeMapPhotos = activeMapPhotos.filter(photoHasLocation);
  activeMapPhotoIndex = Math.min(activeMapPhotoIndex, Math.max(0, activeMapPhotos.length - 1));
  activeMapPlaces = activeMapPlaces.filter((place) => (
    locationReferencePlaces.some((candidate) => candidate.id === place.id)
  ));
  activeMapPlaceIndex = Math.min(activeMapPlaceIndex, Math.max(0, activeMapPlaces.length - 1));
  activeMapRelatedPlaces = activeMapRelatedPlaces.filter((place) => (
    locationReferencePlaces.some((candidate) => candidate.id === place.id)
  ));
  if (activeMapPhotos.length) renderMapPhotoCard();
  else if (activeMapPlaces.length) renderMapPlaceCard();
  else {
    mapController?.setHighlightedPoint(null);
    mapPointRename.hidden = true;
    mapPointDelete.hidden = true;
    mapPhotoCard.hidden = true;
  }
}

async function deleteActiveMapPoint() {
  if (mapPointDeleting) return;
  const place = activeMapPlaceForDeletion();
  const photo = activeMapPhotos[activeMapPhotoIndex];
  if (!place && !photo) return;

  if (place) {
    const linkedPhotos = photos.filter((candidate) => candidate.locationReferenceId === place.id);
    const linkedWarning = linkedPhotos.length
      ? ` Ручная привязка будет снята у ${linkedPhotos.length.toLocaleString('ru-RU')} ${pluralize(linkedPhotos.length, ['фотографии', 'фотографий', 'фотографий'])}.`
      : '';
    if (!window.confirm(`Удалить место «${place.name}» с карты?${linkedWarning}`)) return;
  } else if (!window.confirm(`Убрать фотографию за ${formatDate(photo.date)} с карты? Сам файл останется без изменений.`)) {
    return;
  }

  mapPointDeleting = true;
  mapPointDelete.disabled = true;
  try {
    if (place) {
      const response = await fetch(
        `/api/location-reference/${encodeURIComponent(place.id)}`,
        { method: 'DELETE' }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Не удалось удалить место');
      locationReferencePlaces = locationReferencePlaces.filter((candidate) => candidate.id !== place.id);
      for (const state of result.photoLocations || []) {
        updatePhotoLocationState(state, { render: false });
      }
      mapLocationSearch?.clear();
      mapController?.setSelection(null);
    } else {
      await hidePhotoOnMap(photo);
    }
    renderMapLocations();
    viewerLocationMap?.setPoints(mapPointCollections().points);
    refreshMapCardAfterDeletion();
  } catch (error) {
    window.alert(error.message);
  } finally {
    mapPointDeleting = false;
    if (!mapPhotoCard.hidden) {
      mapPointDelete.disabled = false;
      if (activeMapPhotos.length) renderMapPhotoCard();
      else renderMapPlaceCard();
    }
  }
}

function mapPhotoPickerCandidates(query = '') {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  return [...photos]
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .filter((photo) => {
      if (!normalizedQuery) return true;
      return [
        photo.date,
        formatDate(photo.date),
        photo.name,
        photo.locationPlace,
        photo.locationCountry
      ].filter(Boolean).some((value) => (
        String(value).toLocaleLowerCase('ru-RU').includes(normalizedQuery)
      ));
    });
}

function renderMapPhotoPicker() {
  const place = mapPhotoPickerActivePlace;
  if (!place) return;
  const candidates = mapPhotoPickerCandidates(mapPhotoPickerSearch.value);
  const visibleCandidates = candidates.slice(0, 180);
  mapPhotoPickerStatus.textContent = candidates.length > visibleCandidates.length
    ? `Показаны первые ${visibleCandidates.length.toLocaleString('ru-RU')} из ${candidates.length.toLocaleString('ru-RU')}. Уточните дату в поиске.`
    : `${candidates.length.toLocaleString('ru-RU')} ${pluralize(candidates.length, ['фотография', 'фотографии', 'фотографий'])}`;

  if (!visibleCandidates.length) {
    const empty = document.createElement('p');
    empty.className = 'map-photo-picker-empty';
    empty.textContent = 'Фотографии не найдены';
    mapPhotoPickerGrid.replaceChildren(empty);
    return;
  }

  const buttons = visibleCandidates.map((photo) => {
    const button = document.createElement('button');
    const image = document.createElement('img');
    const copy = document.createElement('span');
    const date = document.createElement('strong');
    const status = document.createElement('small');
    button.type = 'button';
    button.className = 'map-photo-picker-item';
    button.disabled = mapPhotoPickerSaving;
    image.loading = 'lazy';
    image.src = photo.thumbnailSrc || photo.src;
    image.alt = `Фото за ${formatDate(photo.date)}`;
    date.textContent = formatDate(photo.date);
    status.textContent = photo.locationReferenceId === place.id
      ? 'Уже привязано к этому месту'
      : photoHasLocation(photo) ? `Сейчас: ${photoLocationLabel(photo)}` : 'Без места';
    copy.replaceChildren(date, status);
    button.replaceChildren(image, copy);
    button.addEventListener('click', () => void linkPhotoToMapPlace(photo, place));
    return button;
  });
  mapPhotoPickerGrid.replaceChildren(...buttons);
}

function openMapPhotoPicker() {
  const place = activeMapPlaceForEditing();
  if (!place || mapPhotoPickerDialog.open) return;
  mapPhotoPickerActivePlace = place;
  mapPhotoPickerSaving = false;
  mapPhotoPickerSearch.value = '';
  mapPhotoPickerPlace.textContent = [place.name, place.country].filter(Boolean).join(' · ');
  renderMapPhotoPicker();
  mapPhotoPickerDialog.showModal();
  mapPhotoPickerSearch.focus();
}

function closeMapPhotoPicker() {
  if (mapPhotoPickerDialog.open) mapPhotoPickerDialog.close();
  mapPhotoPickerActivePlace = null;
  mapPhotoPickerSaving = false;
  mapPhotoPickerGrid.replaceChildren();
}

async function linkPhotoToMapPlace(photo, place) {
  if (!photo?.id || !place?.id || mapPhotoPickerSaving) return;
  mapPhotoPickerSaving = true;
  renderMapPhotoPicker();
  mapPhotoPickerStatus.textContent = `Привязываем фото за ${formatDate(photo.date)}…`;
  try {
    const updatedPhoto = await persistPhotoLocation(photo, locationFromReferencePlace(place));
    closeMapPhotoPicker();
    showMapPhotoGroup([updatedPhoto], [place]);
  } catch (error) {
    mapPhotoPickerSaving = false;
    renderMapPhotoPicker();
    mapPhotoPickerStatus.textContent = error.message;
  }
}

function placeSuggestionSections(limit = 6) {
  const suggestions = referencePlaceSuggestions(
    locationReferencePlaces,
    photos,
    limit,
    recentPlaceIds
  );
  return [{
    title: 'Недавние',
    type: 'recent',
    candidates: suggestions.recent
  }, {
    title: 'Популярные',
    type: 'popular',
    candidates: suggestions.popular
  }].filter(({ candidates }) => candidates.length);
}

function mapPlacePickerCandidates(query = '') {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  return referencePlaceSuggestions(locationReferencePlaces, photos, locationReferencePlaces.length).all
    .filter(({ place }) => (
      !normalizedQuery
      || referencePlaceVariants(place).flatMap((variant) => [
        variant.name,
        variant.country,
        variant.collection
      ])
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('ru-RU').includes(normalizedQuery))
    ));
}

function mapPlacePickerItem({ place, photoCount }, type = 'all') {
  const button = document.createElement('button');
  const marker = document.createElement('i');
  const markerLabel = document.createElement('span');
  const copy = document.createElement('span');
  const title = document.createElement('strong');
  const status = document.createElement('small');
  button.type = 'button';
  button.className = `map-place-picker-item${photoCount ? '' : ' is-empty'}`;
  button.disabled = mapPlacePickerSaving;
  markerLabel.textContent = photoCount ? String(Math.min(photoCount, 99)) : '+';
  marker.replaceChildren(markerLabel);
  title.textContent = [place.name, place.country].filter(Boolean).join(' · ');
  const photoCountLabel = `${photoCount.toLocaleString('ru-RU')} ${pluralize(photoCount, ['фотография', 'фотографии', 'фотографий'])}`;
  status.textContent = type === 'recent'
    ? `Недавно выбрано · ${photoCount ? photoCountLabel : 'без фотографий'}`
    : photoCount ? photoCountLabel : 'Без фотографий';
  copy.replaceChildren(title, status);
  button.replaceChildren(marker, copy);
  button.addEventListener('click', () => void linkSelectedPhotoToPlace(place));
  return button;
}

function mapPlacePickerSection({ title, type, candidates }) {
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  const grid = document.createElement('div');
  section.className = 'map-place-picker-section';
  heading.textContent = title;
  grid.className = 'map-place-picker-section-grid';
  grid.replaceChildren(...candidates.map((candidate) => mapPlacePickerItem(candidate, type)));
  section.replaceChildren(heading, grid);
  return section;
}

function renderMapPlacePicker() {
  const photo = mapPlacePickerActivePhoto;
  if (!photo) return;
  const query = mapPlacePickerSearch.value.trim();
  const candidates = mapPlacePickerCandidates(query);
  const visibleCandidates = candidates.slice(0, 240);
  const availableSuggestionSections = query ? [] : placeSuggestionSections(6);
  const sections = query
    ? [{
      title: 'Результаты поиска',
      type: 'all',
      candidates: visibleCandidates
    }]
    : mapPlacePickerSuggestionsVisible ? availableSuggestionSections.map((section) => ({
      ...section,
      candidates: section.candidates.slice(0, 6)
    })) : [];

  mapPlaceSuggestionsToggle.disabled = !availableSuggestionSections.length || mapPlacePickerSaving;
  mapPlaceSuggestionsToggle.setAttribute(
    'aria-expanded',
    String(!query && mapPlacePickerSuggestionsVisible)
  );
  mapPlaceSuggestionsToggle.textContent = !query && mapPlacePickerSuggestionsVisible
    ? 'Скрыть подсказки'
    : 'Недавние и популярные';

  if (query) {
    mapPlacePickerStatus.textContent = candidates.length > visibleCandidates.length
      ? `Показаны первые ${visibleCandidates.length.toLocaleString('ru-RU')} из ${candidates.length.toLocaleString('ru-RU')}. Уточните название в поиске.`
      : `${candidates.length.toLocaleString('ru-RU')} ${pluralize(candidates.length, ['место', 'места', 'мест'])}`;
  } else if (mapPlacePickerSuggestionsVisible) {
    const recentCount = sections.find(({ type }) => type === 'recent')?.candidates.length || 0;
    const popularCount = sections.find(({ type }) => type === 'popular')?.candidates.length || 0;
    mapPlacePickerStatus.textContent = `${recentCount.toLocaleString('ru-RU')} недавних · ${popularCount.toLocaleString('ru-RU')} популярных`;
  } else {
    mapPlacePickerStatus.textContent = locationReferencePlaces.length
      ? `${locationReferencePlaces.length.toLocaleString('ru-RU')} ${pluralize(locationReferencePlaces.length, ['сохранённое место', 'сохранённых места', 'сохранённых мест'])}`
      : 'Сохранённых мест пока нет';
  }

  if (!sections.some(({ candidates: sectionCandidates }) => sectionCandidates.length)) {
    const empty = document.createElement('p');
    empty.className = 'map-photo-picker-empty';
    empty.textContent = query
      ? 'Сохранённые места не найдены'
      : locationReferencePlaces.length
        ? mapPlacePickerSuggestionsVisible
          ? 'История выбора пока пуста, а фотографий у сохранённых мест нет'
          : 'Начните вводить название или откройте подсказки'
        : 'Сохранённых мест пока нет';
    mapPlacePickerGrid.replaceChildren(empty);
    return;
  }
  mapPlacePickerGrid.replaceChildren(...sections.map(mapPlacePickerSection));
}

function openMapPlacePicker(photo = activeMapPhotos[activeMapPhotoIndex], context = 'map') {
  if (!photo || mapPlacePickerDialog.open) return;
  mapPlacePickerActivePhoto = photo;
  mapPlacePickerSaving = false;
  mapPlacePickerContext = context;
  mapPlacePickerSuggestionsVisible = context === 'assignment';
  mapPlacePickerSearch.value = '';
  mapPlacePickerPhoto.textContent = formatDate(photo.date);
  renderMapPlacePicker();
  mapPlacePickerDialog.showModal();
  mapPlacePickerSearch.focus();
}

function closeMapPlacePicker() {
  if (mapPlacePickerDialog.open) mapPlacePickerDialog.close();
  mapPlacePickerActivePhoto = null;
  mapPlacePickerSaving = false;
  mapPlacePickerContext = 'map';
  mapPlacePickerSuggestionsVisible = false;
  mapPlaceSuggestionsToggle.setAttribute('aria-expanded', 'false');
  mapPlacePickerGrid.replaceChildren();
}

async function linkSelectedPhotoToPlace(place) {
  const photo = mapPlacePickerActivePhoto;
  const location = locationFromReferencePlace(place);
  if (!photo?.id || !location || mapPlacePickerSaving) return;
  const context = mapPlacePickerContext;
  const savedPlace = Boolean(
    place?.id && locationReferencePlaces.some((candidate) => candidate.id === place.id)
  );
  mapPlacePickerSaving = true;
  if (context === 'assignment') mapAssignmentChoosePlace.disabled = true;
  else mapPhotoChoosePlace.disabled = true;
  renderMapPlacePicker();
  mapPlacePickerStatus.textContent = `Привязываем фото за ${formatDate(photo.date)} к месту «${place.name}»…`;
  try {
    const updatedPhoto = await persistPhotoLocation(photo, location);
    closeMapPlacePicker();
    if (context === 'assignment') {
      mapController?.setCenter(place, Math.max(12, mapController.getCenter().zoom));
      mapAssignmentIndex += 1;
      renderMapAssignment();
      renderMapLocations();
      return;
    }
    activeMapPhotos = [updatedPhoto];
    activeMapPhotoIndex = 0;
    activeMapPlaces = [];
    activeMapRelatedPlaces = savedPlace ? [place] : [];
    mapController?.setCenter(place, Math.max(12, mapController.getCenter().zoom));
    renderMapPhotoCard();
  } catch (error) {
    mapPlacePickerSaving = false;
    if (context === 'assignment') mapAssignmentChoosePlace.disabled = false;
    else mapPhotoChoosePlace.disabled = false;
    renderMapPlacePicker();
    mapPlacePickerStatus.textContent = error.message;
  }
}

function moveMapPhoto(amount) {
  if (activeMapPlaces.length) {
    activeMapPlaceIndex = (
      activeMapPlaceIndex + amount + activeMapPlaces.length
    ) % activeMapPlaces.length;
    renderMapPlaceCard();
    return;
  }
  if (!activeMapPhotos.length) return;
  activeMapPhotoIndex = (activeMapPhotoIndex + amount + activeMapPhotos.length) % activeMapPhotos.length;
  renderMapPhotoCard();
}

function openCurrentMapPhoto() {
  const photo = activeMapPhotos[activeMapPhotoIndex];
  if (!photo) return;
  const dayPhotos = byDate.get(photo.date) || [photo];
  const index = Math.max(0, dayPhotos.findIndex((candidate) => candidate.id === photo.id));
  openViewer(dayPhotos, index);
}

function renderMapAssignment() {
  const photo = mapAssignmentPhotos[mapAssignmentIndex];
  if (!photo) {
    finishMapAssignment();
    return;
  }
  mapAssignment.hidden = false;
  clearTimeout(mapAssignmentImageFallbackTimer);
  mapAssignmentImageFallbackTimer = 0;
  const imageSource = photo.thumbnailSrc || photo.src;
  mapAssignmentImage.dataset.photoId = photo.id;
  mapAssignmentImage.dataset.fallbackSrc = photo.src || '';
  mapAssignmentImage.src = imageSource;
  if (photo.src && imageSource !== photo.src) {
    mapAssignmentImageFallbackTimer = setTimeout(() => {
      if (
        mapAssignmentImage.dataset.photoId === photo.id
        && mapAssignmentImage.getAttribute('src') !== photo.src
      ) {
        mapAssignmentImage.src = photo.src;
      }
    }, 6000);
  }
  mapAssignmentImage.alt = `Фото за ${formatDate(photo.date)}`;
  mapAssignmentPreview.setAttribute('aria-label', `Открыть фото за ${formatDate(photo.date)}`);
  mapAssignmentProgress.textContent = mapAssignmentMode === 'single'
    ? 'Выберите точку'
    : `${(mapAssignmentIndex + 1).toLocaleString('ru-RU')} из ${mapAssignmentPhotos.length.toLocaleString('ru-RU')}`;
  mapAssignmentDate.textContent = formatDate(photo.date);
  mapAssignmentPreview.disabled = mapAssignmentSaving;
  mapAssignmentChoosePlace.disabled = mapAssignmentSaving || mapPlacePickerSaving;
  mapAssignmentSkip.hidden = mapAssignmentMode === 'single';
  mapAssignmentDone.textContent = mapAssignmentMode === 'single' ? 'Отмена' : 'Готово';
  mapController?.setSelection(null);
  mapController?.setHighlightedPoint(null);
  mapController?.setSelectionMode(true);
  mapStageWrap.classList.add('is-assigning');
}

function startMapAssignment() {
  if (mapPlaybackActive) stopMapPlayback({ render: false });
  ensureMap();
  mapAssignmentPhotos = unlocatedPhotos(photos);
  mapAssignmentIndex = 0;
  mapAssignmentMode = 'batch';
  mapPhotoCard.hidden = true;
  if (!mapAssignmentPhotos.length) return;
  mapAssignButton.disabled = true;
  mapAddPlaceButton.disabled = true;
  renderMapAssignment();
}

function startMapPhotoPlacement() {
  const photo = activeMapPhotos[activeMapPhotoIndex];
  if (!photo || mapAssignmentPhotos.length || mapAssignmentSaving) return;
  if (mapPlaybackActive) stopMapPlayback({ render: false });
  ensureMap();
  mapAssignmentPhotos = [photo];
  mapAssignmentIndex = 0;
  mapAssignmentMode = 'single';
  mapPhotoCard.hidden = true;
  mapAssignButton.disabled = true;
  mapAddPlaceButton.disabled = true;
  renderMapAssignment();
}

function finishMapAssignment() {
  const placementPhoto = mapAssignmentMode === 'single'
    ? mapAssignmentPhotos[mapAssignmentIndex] || mapAssignmentPhotos[0]
    : null;
  clearTimeout(mapAssignmentImageFallbackTimer);
  mapAssignmentImageFallbackTimer = 0;
  mapAssignmentPhotos = [];
  mapAssignmentIndex = 0;
  mapAssignmentSaving = false;
  mapAssignmentMode = 'batch';
  mapAssignment.hidden = true;
  mapController?.setSelection(null);
  mapController?.setSelectionMode(false);
  mapStageWrap.classList.remove('is-assigning');
  mapLocationSearch?.clear();
  renderMapLocations();
  if (placementPhoto) {
    const currentPhoto = photos.find((photo) => photo.id === placementPhoto.id) || placementPhoto;
    activeMapPhotos = [currentPhoto];
    activeMapPhotoIndex = 0;
    activeMapPlaces = [];
    activeMapPlaceIndex = 0;
    activeMapRelatedPlaces = relatedPlacesForPhoto(currentPhoto);
    renderMapPhotoCard();
  }
}

function skipMapAssignmentPhoto() {
  if (mapAssignmentSaving) return;
  mapAssignmentIndex += 1;
  renderMapAssignment();
}

function openCurrentMapAssignmentPhoto() {
  const photo = mapAssignmentPhotos[mapAssignmentIndex];
  if (!photo || mapAssignmentSaving) return;
  const dayPhotos = byDate.get(photo.date) || [photo];
  const index = Math.max(0, dayPhotos.findIndex((candidate) => candidate.id === photo.id));
  openViewer(dayPhotos, index);
}

async function assignCurrentPhotoToLocation(location) {
  const photo = mapAssignmentPhotos[mapAssignmentIndex];
  if (!photo || mapAssignmentSaving) return;
  mapAssignmentSaving = true;
  mapController?.setSelection(location);
  mapAssignmentProgress.textContent = 'Сохраняем…';
  let errorMessage = '';
  let completedSinglePlacement = false;
  try {
    const updatedPhoto = await persistPhotoLocation(photo, location);
    if (mapAssignmentMode === 'single') {
      mapAssignmentPhotos[mapAssignmentIndex] = updatedPhoto;
      completedSinglePlacement = true;
    } else {
      mapAssignmentIndex += 1;
    }
  } catch (error) {
    errorMessage = error.message;
  } finally {
    mapAssignmentSaving = false;
    if (completedSinglePlacement) {
      finishMapAssignment();
      return;
    }
    renderMapAssignment();
    if (errorMessage && mapAssignmentPhotos[mapAssignmentIndex]) {
      mapAssignmentProgress.textContent = errorMessage;
    }
    renderMapLocations();
  }
}

function updateViewerLocationControls(photo = activePhotos[activeIndex]) {
  const hasPhoto = Boolean(photo?.src && photo?.id);
  viewerLocationButton.hidden = !hasPhoto;
  if (!hasPhoto) return;
  viewerLocationButtonLabel.textContent = photoHasLocation(photo) ? 'Место' : 'Добавить место';
  viewerLocationButton.classList.toggle('is-active', photo.locationSource === 'manual');
}

function ensureViewerMiniMap() {
  if (viewerMiniMapController) return;
  viewerMiniMapController = new InteractiveMap(viewerMiniMapCanvas, {
    center: { latitude: 30, longitude: 20 },
    zoom: 13
  });
}

function updateViewerMiniMap(photo) {
  const location = photo?.src ? normalizeMapCoordinates(photo) : null;
  viewerMiniMap.hidden = !location;
  if (!location) {
    viewerMiniMapController?.setSelection(null);
    return;
  }

  ensureViewerMiniMap();
  viewerMiniMapOpen.setAttribute(
    'aria-label',
    `Открыть фотографию за ${formatDate(photo.date)} на карте`
  );
  viewerMiniMapController.setCenter(location, 13);
  viewerMiniMapController.setSelection(location);
  requestAnimationFrame(() => viewerMiniMapController?.scheduleRender());
}

function openCurrentViewerPhotoOnMap() {
  const photo = activePhotos[activeIndex];
  const location = normalizeMapCoordinates(photo);
  if (!photo?.src || !location) return;

  viewer.close();
  switchView('map');
  requestAnimationFrame(() => {
    ensureMap();
    mapController.setSelection(null);
    mapController.setCenter(location, 13);
    mapController.setHighlightedPoint(photo);
    showMapPhotoGroup(
      [photo],
      relatedPlacesForPhoto(photo)
    );
    mapController.scheduleRender();
  });
}

function setViewerLocationDraft(location) {
  viewerLocationDraft = normalizeLocationDraft(location);
  viewerLocationMap?.setSelection(viewerLocationDraft);
  viewerLocationSave.disabled = !viewerLocationDraft || viewerLocationSaving;
  viewerLocationStatus.classList.remove('is-error');
  viewerLocationStatus.textContent = viewerLocationDraft
    ? [
      viewerLocationDraft.place,
      `${viewerLocationDraft.latitude.toFixed(5)}, ${viewerLocationDraft.longitude.toFixed(5)}`
    ].filter(Boolean).join(' · ')
    : 'Нажмите на карте, чтобы поставить метку';
}

function ensureViewerLocationMap() {
  if (viewerLocationMap) {
    viewerLocationMap.scheduleRender();
    return;
  }
  viewerLocationMap = new InteractiveMap(viewerLocationMapElement, {
    center: { latitude: 30, longitude: 20 },
    zoom: 2,
    selectionMode: true,
    onMapClick: setViewerLocationDraft,
    onPointClick: (group) => {
      const place = preferredReferencePlace(group);
      const point = group.find((candidate) => candidate.mapPointType === 'photo');
      const location = locationFromReferencePlace(place) || normalizeLocationDraft({
        ...point,
        place: point?.locationPlace,
        country: point?.locationCountry,
        referenceId: point?.locationReferenceId
      });
      if (!location) return;
      setViewerLocationDraft(location);
      viewerLocationMap?.setCenter(location, Math.max(12, viewerLocationMap.getCenter().zoom));
    },
    pointPreview: mapPointPreview
  });
  viewerLocationMap.setPoints(mapPointCollections().points);
}

function openViewerLocationEditor() {
  const photo = activePhotos[activeIndex];
  if (!photo?.id || !photo.src) return;
  viewerLocationEditor.hidden = false;
  ensureViewerLocationMap();
  viewerLocationMap.setPoints(mapPointCollections().points);
  viewerLocationMap.setSelectionMode(true);
  const location = normalizeLocationDraft({
    ...photo,
    place: photo.locationPlace,
    country: photo.locationCountry,
    referenceId: photo.locationReferenceId
  });
  const mainView = mapController?.getCenter();
  const relatedPlace = relatedPlacesForPhoto(photo)[0];
  viewerLocationTitle.textContent = location
    ? relatedPlace ? referencePlaceLabel(relatedPlace) : photoLocationLabel(photo)
    : 'Укажите точку на карте';
  viewerLocationRemove.disabled = photo.locationSource !== 'manual' || viewerLocationSaving;
  viewerLocationRemove.textContent = photo.locationSource === 'manual'
    ? 'Сбросить ручную метку'
    : photo.locationSource === 'exif'
      ? 'Метка из EXIF'
      : photo.locationSource ? 'Автоматическая метка' : 'Метки нет';
  setViewerLocationDraft(location);
  viewerLocationSearchInput.value = '';
  viewerLocationPlaceSearch?.clear();
  requestAnimationFrame(() => {
    viewerLocationMap.setCenter(
      location || mainView || { latitude: 30, longitude: 20 },
      location ? Math.max(8, mainView?.zoom || 8) : mainView?.zoom || 2
    );
    viewerLocationMap.scheduleRender();
  });
}

function closeViewerLocationEditor() {
  viewerLocationEditor.hidden = true;
  viewerLocationDraft = null;
  viewerLocationSaving = false;
  viewerLocationMap?.setSelectionMode(false);
  viewerLocationPlaceSearch?.clear();
}

async function saveViewerLocation() {
  const photo = activePhotos[activeIndex];
  if (!photo?.id || !viewerLocationDraft || viewerLocationSaving) return;
  viewerLocationSaving = true;
  viewerLocationSave.disabled = true;
  viewerLocationRemove.disabled = true;
  viewerLocationStatus.textContent = 'Сохраняем место…';
  try {
    await persistPhotoLocation(photo, viewerLocationDraft);
    closeViewerLocationEditor();
  } catch (error) {
    viewerLocationStatus.textContent = error.message;
    viewerLocationStatus.classList.add('is-error');
  } finally {
    viewerLocationSaving = false;
    if (!viewerLocationEditor.hidden) {
      viewerLocationSave.disabled = !viewerLocationDraft;
      viewerLocationRemove.disabled = photo.locationSource !== 'manual';
    }
  }
}

async function removeViewerLocation() {
  const photo = activePhotos[activeIndex];
  if (!photo?.id || photo.locationSource !== 'manual' || viewerLocationSaving) return;
  viewerLocationSaving = true;
  viewerLocationSave.disabled = true;
  viewerLocationRemove.disabled = true;
  viewerLocationStatus.textContent = 'Сбрасываем ручную метку…';
  try {
    const updatedPhoto = await persistPhotoLocation(photo, null);
    const location = normalizeLocationDraft({
      ...updatedPhoto,
      place: updatedPhoto.locationPlace,
      country: updatedPhoto.locationCountry
    });
    const relatedPlace = relatedPlacesForPhoto(updatedPhoto)[0];
    viewerLocationTitle.textContent = location
      ? relatedPlace ? referencePlaceLabel(relatedPlace) : photoLocationLabel(updatedPhoto)
      : 'Укажите точку на карте';
    viewerLocationRemove.textContent = location ? 'Метка из EXIF' : 'Метки нет';
    setViewerLocationDraft(location);
    if (location) viewerLocationMap.setCenter(location, Math.max(8, viewerLocationMap.getCenter().zoom));
  } catch (error) {
    viewerLocationStatus.textContent = error.message;
    viewerLocationStatus.classList.add('is-error');
  } finally {
    viewerLocationSaving = false;
    viewerLocationSave.disabled = !viewerLocationDraft;
    viewerLocationRemove.disabled = photo.locationSource !== 'manual';
  }
}

function switchView(view, { persist = true } = {}) {
  const isTimeline = view === 'timeline';
  const isMap = view === 'map';
  const isLife = view === 'life';
  const isRandom = view === 'random';
  if (activeView === 'map' && !isMap && mapPlaybackActive) {
    stopMapPlayback({ render: false });
  }
  if (activeView === 'timeline' && !isTimeline && timelineRendered) {
    navigationState = normalizeViewState({
      ...navigationState,
      timeline: currentTimelineState()
    });
  }
  activeView = view;
  document.querySelector('#calendarView').hidden = isTimeline || isMap || isLife || isRandom;
  document.querySelector('#timelineView').hidden = !isTimeline;
  mapView.hidden = !isMap;
  document.querySelector('#lifeView').hidden = !isLife;
  randomView.hidden = !isRandom;
  document.querySelectorAll('.view-switch').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  if (isTimeline && !timelineRendered) {
    const restoredTimelineState = navigationState.timeline;
    timelineRestoring = true;
    renderTimeline();
    requestAnimationFrame(() => {
      timelineTrack.style.scrollBehavior = 'auto';
      restoreTimelinePosition(restoredTimelineState);
      renderTimelineWindow(true);
      requestAnimationFrame(() => {
        timelineTrack.style.scrollBehavior = '';
        timelineRestoring = false;
        updateTimelineScrollbar();
        activateTimelinePreviews();
        scheduleNavigationStateSave();
      });
    });
  }
  if (isLife) requestAnimationFrame(renderLifeCanvas);
  if (isMap) requestAnimationFrame(ensureMap);
  if (isRandom) {
    startRandomShow();
  } else {
    exitRandomFullscreen();
    stopRandomShow();
  }
  if (persist) persistNavigationState();
}

function renderTimeline() {
  timelineEntries = [...byDate].map(([dateKey, dayPhotos]) => {
    const date = parseDate(dateKey);
    return { dateKey, dayPhotos, date, year: date.getFullYear() };
  });
  timelineRendered = true;
  renderTimelineYears();
  renderTimelineWindow(true);
}

function renderTimelineYears() {
  if (!timelineEntries.length) return;
  const width = timelineYears.clientWidth || timelineScrollbar.clientWidth;
  if (!width) return;
  const yearPositions = [];
  let previousYear = null;
  timelineEntries.forEach((entry, index) => {
    if (entry.year === previousYear) return;
    yearPositions.push({ year: entry.year, index });
    previousYear = entry.year;
  });

  const labels = yearPositions.map(({ year, index }, labelIndex) => {
    const x = timelineEntries.length > 1
      ? index / (timelineEntries.length - 1) * width
      : 0;
    const label = document.createElement('span');
    label.textContent = String(year);
    label.style.left = `${x / width * 100}%`;
    if (labelIndex === 0) label.dataset.edge = 'start';
    if (labelIndex === yearPositions.length - 1) label.dataset.edge = 'end';
    return label;
  });
  timelineYears.replaceChildren(...labels);

  const minGap = window.innerWidth <= 720 ? 8 : 6;
  let previousRight = -Infinity;
  for (const label of labels) {
    const rect = label.getBoundingClientRect();
    if (rect.left < previousRight + minGap) {
      label.remove();
      continue;
    }
    previousRight = rect.right;
  }
}

function timelineMetrics() {
  const mobile = window.innerWidth <= 720;
  const preferredWidth = mobile
    ? window.innerWidth * 1.008
    : Math.min(448, Math.max(336, window.innerWidth * 0.308));
  const styles = getComputedStyle(timelineTrack);
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const availableHeight = timelineTrack.clientHeight
    - paddingTop
    - (parseFloat(styles.paddingBottom) || 0);
  const itemWidth = Math.max(1, Math.min(preferredWidth, availableHeight));
  const cardOffset = Math.max(0, availableHeight - itemWidth);
  timelineTrack.style.setProperty('--timeline-card-width', `${itemWidth}px`);
  timelineTrack.parentElement.style.setProperty(
    '--timeline-line-top',
    `${timelineTrack.offsetTop + paddingTop + cardOffset + itemWidth / 2}px`
  );
  return {
    itemWidth,
    gap: mobile ? 24 : 36,
    paddingLeft: parseFloat(styles.paddingLeft) || 0
  };
}

function restoreTimelinePosition(state) {
  const maxScroll = Math.max(0, timelineTrack.scrollWidth - timelineTrack.clientWidth);
  if (!timelineEntries.length || !maxScroll) {
    timelineTrack.scrollLeft = 0;
    return;
  }

  if (!state?.date) {
    timelineTrack.scrollLeft = Number.isFinite(state?.progress)
      ? state.progress * maxScroll
      : maxScroll;
    return;
  }

  let index = timelineEntries.findIndex((entry) => entry.dateKey === state.date);
  if (index < 0) {
    const nextIndex = timelineEntries.findIndex((entry) => entry.dateKey > state.date);
    if (nextIndex < 0) index = timelineEntries.length - 1;
    else if (nextIndex === 0) index = 0;
    else {
      const targetTime = parseDate(state.date).getTime();
      const previousDistance = Math.abs(timelineEntries[nextIndex - 1].date.getTime() - targetTime);
      const nextDistance = Math.abs(timelineEntries[nextIndex].date.getTime() - targetTime);
      index = previousDistance <= nextDistance ? nextIndex - 1 : nextIndex;
    }
  }

  const { itemWidth, gap, paddingLeft } = timelineMetrics();
  const centeredScroll = paddingLeft
    + index * (itemWidth + gap)
    + itemWidth / 2
    - timelineTrack.clientWidth / 2;
  timelineTrack.scrollLeft = Math.max(0, Math.min(maxScroll, centeredScroll));
}

function makeTimelineItem(entry, index) {
  const { dateKey, dayPhotos, date, year } = entry;
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'timeline-item';
  item.dataset.year = String(year);
  item.dataset.timelineIndex = String(index);
  item.setAttribute('aria-label', `${formatDate(dateKey)}, фотографий: ${dayPhotos.length}`);
  markPhotoForPresentation(item, dateKey);

  const image = document.createElement('img');
  const preferredPhoto = preferredPhotoForDate(dateKey, dayPhotos);
  const imageSource = preferredPhoto.thumbnailSrc || preferredPhoto.src;
  markPhotoForPresentation(image, dateKey);
  holdPhotoUntilReady(image);
  image.alt = '';
  image.decoding = 'async';
  image.addEventListener('load', async () => {
    if (!await revealPhotoAfterDecode(image, dateKey, item)) return;
    timelineLoadedImages.add(imageSource);
    item.classList.add('has-loaded-image');
  });
  if (timelineLoadedImages.has(imageSource)) {
    image.src = imageSource;
    item.classList.add('has-loaded-image');
  } else {
    image.dataset.src = imageSource;
  }
  item.append(image);

  const previousDate = timelineEntries[index - 1]?.date;
  const startsYear = !previousDate || previousDate.getFullYear() !== year;
  const startsMonth = startsYear || previousDate.getMonth() !== date.getMonth();
  item.insertAdjacentHTML('beforeend', `
    ${startsMonth ? `<span class="timeline-period-marker" data-timeline-index="${index}">${startsYear ? `<strong>${year}</strong>` : ''}<span>${MONTHS[date.getMonth()]}</span></span>` : ''}
    <span class="timeline-placeholder" aria-hidden="true">
      <svg viewBox="0 0 32 32"><path d="M7 10h4l1.6-2.5h6.8L21 10h4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z"/><circle cx="16" cy="18" r="5"/></svg>
    </span>
    <span class="timeline-date">
      <strong>${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}</strong>
      <span>${new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(date)}</span>
    </span>
    ${dayPhotos.length > 1 ? `<span class="timeline-photo-count">${dayPhotos.length} фото</span>` : ''}
  `);
  const media = document.createElement('span');
  media.className = 'timeline-media';
  media.append(image, item.querySelector('.timeline-placeholder'));
  item.prepend(media);
  item.addEventListener('click', () => openViewer(dayPhotos));
  return item;
}

function renderTimelineWindow(force = false) {
  if (!timelineRendered || !timelineEntries.length || !timelineTrack.clientWidth) return;
  const { itemWidth, gap, paddingLeft } = timelineMetrics();
  const itemExtent = itemWidth + gap;
  const firstVisible = Math.floor(Math.max(0, timelineTrack.scrollLeft - paddingLeft) / itemExtent);
  const visibleCount = Math.ceil(timelineTrack.clientWidth / itemExtent);
  const visibleEnd = firstVisible + visibleCount;
  const guard = Math.max(3, Math.ceil(visibleCount / 2));
  const hasLeftBuffer = timelineVirtualStart === 0
    || firstVisible >= timelineVirtualStart + guard;
  const hasRightBuffer = timelineVirtualEnd === timelineEntries.length
    || visibleEnd <= timelineVirtualEnd - guard;
  if (!force && timelineVirtualStart >= 0 && hasLeftBuffer && hasRightBuffer) return;

  const buffer = Math.max(12, visibleCount * 3);
  const start = Math.max(0, firstVisible - buffer);
  const end = Math.min(timelineEntries.length, visibleEnd + buffer);

  timelineImageObserver?.disconnect();
  const existingItems = new Map(
    [...timelineTrack.querySelectorAll('.timeline-item')]
      .map((item) => [Number(item.dataset.timelineIndex), item])
  );
  const fragment = document.createDocumentFragment();
  const leading = document.createElement('div');
  leading.className = 'timeline-spacer';
  leading.style.flexBasis = `${start * itemExtent}px`;
  fragment.append(leading);
  for (let index = start; index < end; index += 1) {
    fragment.append(existingItems.get(index) || makeTimelineItem(timelineEntries[index], index));
  }
  const trailing = document.createElement('div');
  trailing.className = 'timeline-spacer';
  trailing.style.flexBasis = `${(timelineEntries.length - end) * itemExtent}px`;
  fragment.append(trailing);
  timelineTrack.replaceChildren(fragment);
  timelineVirtualStart = start;
  timelineVirtualEnd = end;
  filterTimelinePeriodMarkers();
  activateTimelinePreviews();
}

function filterTimelinePeriodMarkers() {
  const markers = [...timelineTrack.querySelectorAll('.timeline-period-marker')]
    .sort((a, b) => Number(a.dataset.timelineIndex) - Number(b.dataset.timelineIndex));
  let previousRight = -Infinity;
  for (const marker of markers) {
    marker.hidden = false;
    const rect = marker.getBoundingClientRect();
    if (rect.left < previousRight + 10) {
      marker.hidden = true;
      continue;
    }
    previousRight = rect.right;
  }
}

function scheduleTimelineWindowRender() {
  if (timelineRenderFrame) return;
  timelineRenderFrame = requestAnimationFrame(() => {
    timelineRenderFrame = 0;
    renderTimelineWindow();
  });
}

function activateTimelinePreviews() {
  if (!timelineRendered) return;
  if (!timelineImageObserver) {
    timelineImageObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const image = entry.target;
        image.src = image.dataset.src;
        image.removeAttribute('data-src');
        timelineImageObserver.unobserve(image);
      }
    }, {
      root: timelineTrack,
      rootMargin: '0px 500px',
      threshold: 0.01
    });
  }
  timelineTrack.querySelectorAll('img[data-src]').forEach((image) => timelineImageObserver.observe(image));
}

function updateTimelineScrollbar() {
  const maxScroll = Math.max(0, timelineTrack.scrollWidth - timelineTrack.clientWidth);
  const progress = maxScroll ? timelineTrack.scrollLeft / maxScroll : 0;
  const controlWidth = timelineScrollbar.clientWidth;
  const thumbWidth = maxScroll
    ? Math.max(52, controlWidth * timelineTrack.clientWidth / timelineTrack.scrollWidth)
    : controlWidth;
  timelineScrollbar.value = String(Math.round(progress * Number(timelineScrollbar.max)));
  timelineScrollbar.style.setProperty('--timeline-thumb-width', `${thumbWidth}px`);
}

function scheduleTimelineScrollbarUpdate() {
  if (timelineScrollbarFrame) return;
  timelineScrollbarFrame = requestAnimationFrame(() => {
    timelineScrollbarFrame = 0;
    updateTimelineScrollbar();
  });
}

function initializeLife() {
  const startDate = birthDate || earliestPhotoDate();
  if (!startDate) return;
  lifeStart = parseDate(startDate);
  const today = new Date();
  const range = calculateLifeRange(lifeStart, today, false);
  lifeEnd = range.endDate;
  lifeTotalDays = range.totalDays;
  lifePhotoDates = new Map(filterLifePhotoEntries([...byDate], lifeStart));

  const livedDays = Math.max(0, range.todayIndex);
  const livedCalendarDays = Math.max(1, livedDays + 1);
  const ageYears = range.ageYears;
  let livedMonths = (today.getFullYear() - lifeStart.getFullYear()) * 12
    + today.getMonth() - lifeStart.getMonth();
  if (today.getDate() < lifeStart.getDate()) livedMonths -= 1;
  livedMonths = Math.max(0, livedMonths);
  const livedWeeks = Math.floor(livedDays / 7);
  const livedPhotoDates = [...lifePhotoDates].filter(([dateKey]) => {
    const day = utcDayNumber(parseDate(dateKey));
    return day >= utcDayNumber(lifeStart) && day <= utcDayNumber(today);
  });
  const photoCount = livedPhotoDates.reduce((total, [, dayPhotos]) => total + dayPhotos.length, 0);
  const photographedDays = livedPhotoDates.length;
  const coverage = photographedDays / livedCalendarDays * 100;
  const formatNumber = (value) => value.toLocaleString('ru-RU');

  document.querySelector('#lifeAgeTitle').textContent = 'Моя жизнь';
  document.querySelector('#lifeSummary').innerHTML = `
    <span><strong>${formatNumber(ageYears)}</strong><small>${pluralize(ageYears, ['год', 'года', 'лет'])}</small></span>
    <span><strong>${formatNumber(livedMonths)}</strong><small>${pluralize(livedMonths, ['месяц', 'месяца', 'месяцев'])}</small></span>
    <span><strong>${formatNumber(livedWeeks)}</strong><small>${pluralize(livedWeeks, ['неделя', 'недели', 'недель'])}</small></span>
    <span><strong>${formatNumber(livedDays)}</strong><small>${pluralize(livedDays, ['день', 'дня', 'дней'])}</small></span>
  `;
  document.querySelector('#lifeStats').innerHTML = `
    <strong>${formatNumber(photoCount)}</strong> ${pluralize(photoCount, ['фотография', 'фотографии', 'фотографий'])}
    <span aria-hidden="true">·</span>
    <strong>${formatNumber(photographedDays)}</strong> ${pluralize(photographedDays, ['день', 'дня', 'дней'])} с фото
    <span aria-hidden="true">·</span>
    <strong>${coverage.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</strong> дней отфоткано
  `;
  updateLifeBirthDateUi();
}

function renderLifeCanvas() {
  if (!lifeStart || document.querySelector('#lifeView').hidden) return;
  const mobile = window.innerWidth <= 720;
  const availableWidth = lifeCanvasWrap.clientWidth - (mobile ? 24 : 68);
  const availableHeight = Math.max(220, lifeCanvasWrap.clientHeight - (mobile ? 36 : 68));
  const showRemainingLife = lifeRemainingToggle.checked;
  const range = calculateLifeRange(lifeStart, new Date(), showRemainingLife);
  lifeEnd = range.endDate;
  lifeTotalDays = range.totalDays;
  const todayIndex = range.todayIndex;
  const visibleDays = lifeTotalDays;
  const idealColumns = Math.round(Math.sqrt(visibleDays * availableWidth / availableHeight));
  let columns = idealColumns;
  let rows = Math.ceil(visibleDays / columns);
  let spacing = Math.min(availableWidth / columns, availableHeight / rows);

  for (let candidate = Math.max(60, idealColumns - 5); candidate <= idealColumns + 5; candidate += 1) {
    const candidateRows = Math.ceil(visibleDays / candidate);
    const candidateSpacing = Math.min(availableWidth / candidate, availableHeight / candidateRows);
    if (candidateSpacing > spacing) {
      columns = candidate;
      rows = candidateRows;
      spacing = candidateSpacing;
    }
  }
  const cssWidth = columns * spacing;
  const cssHeight = rows * spacing;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const context = lifeCanvas.getContext('2d');
  lifeCanvas.width = Math.round(cssWidth * pixelRatio);
  lifeCanvas.height = Math.round(cssHeight * pixelRatio);
  lifeCanvas.style.width = `${cssWidth}px`;
  lifeCanvas.style.height = `${cssHeight}px`;
  context.scale(pixelRatio, pixelRatio);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const radius = Math.max(0.8, spacing * 0.26);
  const photoRadius = Math.max(1.4, spacing * 0.4);
  const themeStyles = getComputedStyle(document.documentElement);
  const photoColor = themeStyles.getPropertyValue('--photo-green').trim() || '#73967b';
  const livedColor = themeStyles.getPropertyValue('--life-lived').trim() || 'rgba(169, 188, 158, 0.62)';
  const futureColor = themeStyles.getPropertyValue('--life-future').trim() || 'rgba(169, 188, 158, 0.12)';
  const photoIndices = new Map();

  for (const [dateKey, dayPhotos] of lifePhotoDates) {
    const index = utcDayNumber(parseDate(dateKey)) - utcDayNumber(lifeStart);
    photoIndices.set(index, { dateKey, dayPhotos });
  }

  for (let index = 0; index < visibleDays; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * spacing + spacing / 2;
    const y = row * spacing + spacing / 2;
    const photo = photoIndices.has(index);
    context.beginPath();
    context.arc(x, y, photo ? photoRadius : radius, 0, Math.PI * 2);
    context.fillStyle = photo
      ? photoColor
      : index <= todayIndex
        ? livedColor
        : futureColor;
    context.fill();
  }

  lifeLayout = { columns, spacing, cssWidth, cssHeight, photoIndices, todayIndex, showRemainingLife };
}

function lifeIndexFromPointer(event) {
  if (!lifeLayout) return -1;
  const rect = lifeCanvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (lifeLayout.cssWidth / rect.width);
  const y = (event.clientY - rect.top) * (lifeLayout.cssHeight / rect.height);
  const column = Math.floor(x / lifeLayout.spacing);
  const row = Math.floor(y / lifeLayout.spacing);
  if (column < 0 || column >= lifeLayout.columns || row < 0) return -1;
  const index = row * lifeLayout.columns + column;
  if (!lifeLayout.showRemainingLife && index > lifeLayout.todayIndex) return -1;
  return index < lifeTotalDays ? index : -1;
}

function dateAtLifeIndex(index) {
  const serial = Date.UTC(lifeStart.getFullYear(), lifeStart.getMonth(), lifeStart.getDate()) + index * 86400000;
  const date = new Date(serial);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function showLifeTooltip(event) {
  const index = lifeIndexFromPointer(event);
  if (index < 0) {
    lifeTooltip.hidden = true;
    lifeTooltipIndex = -1;
    return;
  }
  const photo = lifeLayout.photoIndices.get(index);
  if (lifeTooltipIndex !== index) {
    const date = dateAtLifeIndex(index);
    const hoveredDateKey = photo?.dateKey || dateKey(date);
    lifeTooltipDate.textContent = formatDate(hoveredDateKey);
    lifeTooltip.classList.toggle('has-photo', Boolean(photo));
    lifeTooltipMedia.hidden = !photo;

    if (photo) {
      const firstPhoto = preferredPhotoForDate(photo.dateKey, photo.dayPhotos);
      markPhotoForPresentation(lifeTooltipPreview, photo.dateKey);
      lifeTooltipPreview.dataset.fallbackSrc = firstPhoto.src;
      lifeTooltipPreview.src = firstPhoto.thumbnailSrc || firstPhoto.src;
    } else {
      lifeTooltipPreview.removeAttribute('src');
      lifeTooltipPreview.removeAttribute('data-fallback-src');
      clearPhotoPresentationMark(lifeTooltipPreview);
    }
    lifeTooltipIndex = index;
  }

  const wrapRect = lifeCanvasWrap.getBoundingClientRect();
  const pointerX = event.clientX - wrapRect.left;
  lifeTooltip.hidden = false;
  const halfTooltipWidth = lifeTooltip.offsetWidth / 2;
  const edgeGap = 8;
  const tooltipX = Math.min(
    wrapRect.width - halfTooltipWidth - edgeGap,
    Math.max(halfTooltipWidth + edgeGap, pointerX)
  );
  const arrowX = Math.min(
    lifeTooltip.offsetWidth - 12,
    Math.max(12, pointerX - tooltipX + halfTooltipWidth)
  );
  lifeTooltip.style.setProperty('--life-tooltip-arrow-x', `${arrowX}px`);
  lifeTooltip.style.left = `${tooltipX}px`;
  lifeTooltip.style.top = `${event.clientY - wrapRect.top}px`;
  lifeCanvas.style.cursor = photo ? 'pointer' : 'crosshair';
}

function pickRandomPhoto() {
  if (!byDate.size) return null;
  const photoDates = [...byDate.keys()];
  let date = photoDates[Math.floor(Math.random() * photoDates.length)];
  let candidate = preferredPhotoForDate(date);
  if (photoDates.length > 1) {
    while (candidate.src === randomCurrentPhoto?.src) {
      date = photoDates[Math.floor(Math.random() * photoDates.length)];
      candidate = preferredPhotoForDate(date);
    }
  }
  return candidate;
}

function restartRandomProgress() {
  randomProgressBar.classList.remove('is-running');
  randomProgressBar.style.animationPlayState = 'running';
  void randomProgressBar.offsetWidth;
  randomProgressBar.classList.add('is-running');
}

function clearRandomLayerCleanup(index) {
  clearTimeout(randomLayerCleanupTimers[index]);
  randomLayerCleanupTimers[index] = null;
}

function loadRandomImage(image, source) {
  const currentSource = image.getAttribute('src');
  if (currentSource === source && image.complete && image.naturalWidth > 0) {
    image.onload = null;
    image.onerror = null;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      callback();
    };

    image.onload = () => finish(resolve);
    image.onerror = () => finish(reject);
    if (currentSource !== source) image.src = source;
    else if (image.complete) {
      queueMicrotask(() => finish(image.naturalWidth > 0 ? resolve : reject));
    }
  });
}

function scheduleRandomPhoto() {
  clearTimeout(randomTimer);
  if (!randomPaused && !randomView.hidden) {
    randomTimer = setTimeout(() => showRandomPhoto(), 5000);
  }
}

async function showRandomPhoto(immediate = false) {
  if (randomTransitioning || randomView.hidden) return;
  const photo = pickRandomPhoto();
  if (!photo) return;
  randomTransitioning = true;
  const generation = randomGeneration;
  const incomingIndex = immediate ? 0 : 1 - randomLayerIndex;
  const outgoingIndex = randomLayerIndex;
  const incoming = randomLayers[incomingIndex];
  const outgoing = randomLayers[outgoingIndex];
  const image = incoming.querySelector('img');
  const transitions = ['fade', 'zoom', 'slide-left', 'slide-up', 'tilt'];
  const transition = transitions[Math.floor(Math.random() * transitions.length)];

  randomLoading.classList.remove('is-hidden');
  // При частых переходах слой может снова стать входящим раньше,
  // чем таймер предыдущего перехода удалит из него src.
  clearRandomLayerCleanup(incomingIndex);
  markPhotoForPresentation(incoming, photo.date);
  markPhotoForPresentation(image, photo.date);
  holdPhotoUntilReady(image);
  try {
    await loadRandomImage(image, photo.src);
  } catch {
    image.removeAttribute('src');
    randomTransitioning = false;
    if (generation === randomGeneration) showRandomPhoto(immediate);
    return;
  }
  if (generation !== randomGeneration || randomView.hidden) {
    image.removeAttribute('src');
    randomTransitioning = false;
    return;
  }

  if (!await revealPhotoAfterDecode(image, photo.date, incoming)) {
    randomTransitioning = false;
    return;
  }

  incoming.className = `random-layer transition-${transition}`;
  markPhotoForPresentation(incoming, photo.date);
  const date = parseDate(photo.date);
  document.querySelector('#randomWeekday').textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', year: 'numeric' }).format(date);
  document.querySelector('#randomDate').textContent = formatDate(photo.date);
  const caption = document.querySelector('#randomCaption');
  caption.classList.remove('is-changing');
  void caption.offsetWidth;
  caption.classList.add('is-changing');
  randomLoading.classList.add('is-hidden');

  if (immediate || !randomCurrentPhoto) {
    incoming.classList.add('is-active');
  } else {
    outgoing.className = `random-layer is-active transition-${transition}`;
    requestAnimationFrame(() => {
      outgoing.classList.remove('is-active');
      outgoing.classList.add('is-leaving');
      incoming.classList.add('is-active');
    });
    clearRandomLayerCleanup(outgoingIndex);
    randomLayerCleanupTimers[outgoingIndex] = setTimeout(() => {
      if (outgoing !== randomLayers[randomLayerIndex]) {
        outgoing.querySelector('img').removeAttribute('src');
        outgoing.className = 'random-layer';
      }
      randomLayerCleanupTimers[outgoingIndex] = null;
    }, 1700);
  }

  randomLayerIndex = incomingIndex;
  randomCurrentPhoto = photo;
  randomTransitioning = false;
  restartRandomProgress();
  scheduleRandomPhoto();
}

function startRandomShow() {
  if (randomCurrentPhoto || randomTransitioning) return;
  randomGeneration += 1;
  randomPaused = false;
  document.querySelector('#randomToggle').textContent = 'Пауза';
  showRandomPhoto(true);
}

function stopRandomShow() {
  clearTimeout(randomTimer);
  randomLayerCleanupTimers.forEach((_, index) => clearRandomLayerCleanup(index));
  randomGeneration += 1;
  randomCurrentPhoto = null;
  randomTransitioning = false;
  randomProgressBar.classList.remove('is-running');
  randomLayers.forEach((layer) => {
    layer.className = 'random-layer';
    layer.removeAttribute('data-photo-date');
    const image = layer.querySelector('img');
    image.removeAttribute('src');
    image.removeAttribute('data-photo-date');
    image.classList.remove('is-presentation-blurred');
  });
  randomLoading.classList.remove('is-hidden');
}

function toggleRandomPause() {
  randomPaused = !randomPaused;
  document.querySelector('#randomToggle').textContent = randomPaused ? 'Продолжить' : 'Пауза';
  randomProgressBar.style.animationPlayState = randomPaused ? 'paused' : 'running';
  if (randomPaused) clearTimeout(randomTimer);
  else {
    restartRandomProgress();
    scheduleRandomPhoto();
  }
}

function showNextRandomPhoto() {
  if (randomTransitioning) return;
  clearTimeout(randomTimer);
  randomPaused = false;
  document.querySelector('#randomToggle').textContent = 'Пауза';
  showRandomPhoto();
}

function openCurrentRandomPhoto() {
  if (!randomCurrentPhoto) return;
  randomPaused = true;
  clearTimeout(randomTimer);
  document.querySelector('#randomToggle').textContent = 'Продолжить';
  randomProgressBar.style.animationPlayState = 'paused';
  const dayPhotos = byDate.get(randomCurrentPhoto.date) || [randomCurrentPhoto];
  const index = Math.max(0, dayPhotos.findIndex((photo) => photo.src === randomCurrentPhoto.src));
  openViewer(dayPhotos, index);
}

function updateRandomFullscreenButton() {
  const active = randomNativeFullscreenActive || randomView.classList.contains('is-fullscreen-fallback');
  const button = document.querySelector('#randomFullscreen');
  button.textContent = active ? '↙' : '⛶';
  button.setAttribute('aria-label', active ? 'Выйти из полноэкранного режима' : 'Включить полноэкранный режим');
}

function setRandomFullscreenFallback(active) {
  randomView.classList.toggle('is-fullscreen-fallback', active);
  document.body.classList.toggle('random-fullscreen-open', active);
}

function setRandomNativeFullscreen(active) {
  randomView.classList.toggle('is-fullscreen-native', active);
  document.body.classList.toggle('random-fullscreen-open', active);
}

function suspendRandomShowForFullscreen() {
  const wasPlaying = !randomPaused;
  clearTimeout(randomTimer);
  randomGeneration += 1;
  randomTransitioning = false;
  randomProgressBar.style.animationPlayState = 'paused';

  randomLayers.forEach((layer, index) => {
    if (index === randomLayerIndex && randomCurrentPhoto) {
      layer.className = 'random-layer is-active';
      return;
    }
    layer.className = 'random-layer';
    layer.querySelector('img').removeAttribute('src');
  });

  return () => {
    if (!wasPlaying || randomPaused || randomView.hidden) return;
    randomProgressBar.style.animationPlayState = 'running';
    if (!randomCurrentPhoto) showRandomPhoto(true);
    else {
      restartRandomProgress();
      scheduleRandomPhoto();
    }
  };
}

async function enterRandomFullscreen() {
  if (randomNativeFullscreenActive || randomView.classList.contains('is-fullscreen-fallback')) return;

  const fullscreenTarget = document.documentElement;
  const requestFullscreen = fullscreenTarget.requestFullscreen || fullscreenTarget.webkitRequestFullscreen;
  if (!requestFullscreen) {
    setRandomFullscreenFallback(true);
    updateRandomFullscreenButton();
    return;
  }

  const resumeRandomShow = suspendRandomShowForFullscreen();
  try {
    // Arc может долго пересоздавать GPU-слои для больших фото.
    // На время перехода снимаем трансформации и blur-фильтры.
    randomView.classList.add('is-fullscreen-requesting');
    await requestFullscreen.call(fullscreenTarget);
    const enteredElement = document.fullscreenElement || document.webkitFullscreenElement;
    randomNativeFullscreenActive = enteredElement === fullscreenTarget;
    if (randomNativeFullscreenActive) {
      setRandomFullscreenFallback(false);
      setRandomNativeFullscreen(true);
    } else {
      setRandomNativeFullscreen(false);
      setRandomFullscreenFallback(true);
    }
  } catch {
    // Некоторые браузеры запрещают системный fullscreen.
    // В таком случае остаёмся в полноэкранном CSS-режиме.
    randomNativeFullscreenActive = false;
    setRandomNativeFullscreen(false);
    setRandomFullscreenFallback(true);
  } finally {
    randomView.classList.remove('is-fullscreen-requesting');
    resumeRandomShow();
  }
  updateRandomFullscreenButton();
}

async function exitRandomFullscreen() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
  if (randomNativeFullscreenActive && fullscreenElement && exitFullscreen) {
    try {
      await exitFullscreen.call(document);
    } catch {
      // Режим уже мог быть закрыт клавишей Escape.
    }
  }
  randomNativeFullscreenActive = false;
  setRandomNativeFullscreen(false);
  setRandomFullscreenFallback(false);
  updateRandomFullscreenButton();
}

function toggleRandomFullscreen() {
  const active = randomNativeFullscreenActive || randomView.classList.contains('is-fullscreen-fallback');
  if (active) exitRandomFullscreen();
  else enterRandomFullscreen();
}

function showViewerChoiceStatus(message, isError = false) {
  clearTimeout(viewerChoiceStatusTimer);
  viewerChoiceStatus.textContent = message;
  viewerChoiceStatus.classList.toggle('is-error', isError);
  viewerChoiceStatusTimer = setTimeout(() => {
    viewerChoiceStatus.textContent = '';
    viewerChoiceStatus.classList.remove('is-error');
  }, 2600);
}

function showViewerHighlightStatus(message, isError = false) {
  clearTimeout(viewerHighlightStatusTimer);
  viewerHighlightStatus.textContent = message;
  viewerHighlightStatus.classList.toggle('is-error', isError);
  viewerHighlightStatusTimer = setTimeout(() => {
    viewerHighlightStatus.textContent = '';
    viewerHighlightStatus.classList.remove('is-error');
  }, 2600);
}

function showViewerTrashStatus(message, isError = false) {
  viewerTrashStatus.textContent = message;
  viewerTrashStatus.classList.toggle('is-error', isError);
}

function updateViewerTrashControl(photo = activePhotos[activeIndex]) {
  const canTrash = Boolean(desktopBridge?.trashPhoto && photo?.src && photo?.id);
  viewerTrashButton.hidden = !canTrash;
  viewerTrashButton.disabled = viewerTrashInProgress;
  viewerTrashButton.textContent = viewerTrashInProgress ? 'Перемещаем…' : 'В Корзину';
  if (!viewerTrashInProgress) showViewerTrashStatus('');
}

async function trashViewerPhoto() {
  const photo = activePhotos[activeIndex];
  if (!desktopBridge?.trashPhoto || !photo?.src || !photo.id || viewerTrashInProgress) return;

  viewerTrashInProgress = true;
  updateViewerTrashControl(photo);
  showViewerTrashStatus('Ожидаем подтверждения…');
  let deleted = false;
  try {
    const result = await desktopBridge.trashPhoto(photo.id);
    if (result?.canceled) {
      showViewerTrashStatus('');
      return;
    }
    deleted = Boolean(result?.deleted);
    if (!deleted) throw new Error('Не удалось переместить фотографию в Корзину');
    viewerTrashButton.hidden = true;
    if (!result.indexed) {
      showViewerTrashStatus(result.warning || 'Индекс архива не обновлён', true);
      return;
    }
    viewer.close();
  } catch (error) {
    showViewerTrashStatus(error.message || 'Не удалось переместить фотографию в Корзину', true);
  } finally {
    viewerTrashInProgress = false;
    if (!deleted) {
      viewerTrashButton.disabled = false;
      viewerTrashButton.textContent = 'В Корзину';
      if (!viewerTrashStatus.textContent) showViewerTrashStatus('');
    }
  }
}

function replaceHighlights(value) {
  const years = Array.isArray(value?.years) ? value.years : [];
  const months = Array.isArray(value?.months) ? value.months : [];
  yearHighlights = new Map(years.map((item) => [item.year, item.src]));
  monthHighlights = new Map(months.map((item) => [`${item.year}-${String(item.month).padStart(2, '0')}`, item.src]));
  yearHighlightThumbnails = new Map(years.map((item) => [item.year, item.thumbnailSrc || item.src]));
  monthHighlightThumbnails = new Map(months.map((item) => [`${item.year}-${String(item.month).padStart(2, '0')}`, item.thumbnailSrc || item.src]));
  yearHighlightDates = new Map(years.map((item) => [item.year, item.date]));
  monthHighlightDates = new Map(months.map((item) => [`${item.year}-${String(item.month).padStart(2, '0')}`, item.date]));
}

function replaceHighlightSelections(value) {
  yearHighlightSelections = new Map(Object.entries(value?.years || {}));
  monthHighlightSelections = new Map(Object.entries(value?.months || {}));
}

function updateViewerHighlightControls(photo = activePhotos[activeIndex]) {
  const hasPhoto = Boolean(photo?.src && photo?.id);
  viewerHighlightActions.hidden = !hasPhoto;
  if (!hasPhoto) return;

  const year = photo.date.slice(0, 4);
  const month = photo.date.slice(0, 7);
  const controls = [
    [viewerMonthHighlight, monthHighlightSelections.get(month) === photo.date, 'месяца'],
    [viewerYearHighlight, yearHighlightSelections.get(year) === photo.date, 'года']
  ];
  for (const [button, active, label] of controls) {
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.querySelector('span').textContent = active ? '★' : '☆';
    button.title = active ? `Снять отметку «Фото ${label}»` : `Отметить как фото ${label}`;
  }
}

async function setPeriodHighlight(scope) {
  const photo = activePhotos[activeIndex];
  if (!photo?.id || !photo.src) return;
  const isMonth = scope === 'month';
  const period = photo.date.slice(0, isMonth ? 7 : 4);
  const selections = isMonth ? monthHighlightSelections : yearHighlightSelections;
  const button = isMonth ? viewerMonthHighlight : viewerYearHighlight;
  const previousPhotoDate = selections.get(period);
  const nextPhotoDate = previousPhotoDate === photo.date ? null : photo.date;
  const requestKey = `${scope}:${period}`;
  const requestSequence = (highlightSelectionRequestSequences.get(requestKey) || 0) + 1;
  highlightSelectionRequestSequences.set(requestKey, requestSequence);

  if (nextPhotoDate) selections.set(period, nextPhotoDate);
  else selections.delete(period);
  updateViewerHighlightControls(photo);
  button.disabled = true;
  showViewerHighlightStatus('Сохраняем отметку…');

  try {
    const response = await fetch(`/api/highlight-selections/${scope}/${period}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: nextPhotoDate ? photo.id : null })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || 'Не удалось сохранить отметку');
    if (requestSequence !== highlightSelectionRequestSequences.get(requestKey)) return;
    replaceHighlightSelections(result.selections);
    replaceHighlights(result.highlights);
    renderCalendar();
    updateViewerHighlightControls();
    showViewerHighlightStatus(nextPhotoDate ? `Фото ${isMonth ? 'месяца' : 'года'} сохранено` : 'Отметка снята');
  } catch (error) {
    if (requestSequence !== highlightSelectionRequestSequences.get(requestKey)) return;
    if (previousPhotoDate) selections.set(period, previousPhotoDate);
    else selections.delete(period);
    updateViewerHighlightControls();
    showViewerHighlightStatus(error.message, true);
  } finally {
    if (requestSequence === highlightSelectionRequestSequences.get(requestKey)) button.disabled = false;
  }
}

function refreshPreferredPhotoInViews(date) {
  if (!byDate.size) return;
  renderCalendar();
  const timelineIndex = timelineEntries.findIndex((entry) => entry.dateKey === date);
  if (timelineIndex >= 0) {
    const item = timelineTrack.querySelector(`[data-timeline-index="${timelineIndex}"]`);
    if (item) {
      item.replaceWith(makeTimelineItem(timelineEntries[timelineIndex], timelineIndex));
      activateTimelinePreviews();
    }
  }
  lifeTooltipIndex = -1;
  lifeTooltip.hidden = true;
}

async function selectPreferredPhoto(photo) {
  if (!photo?.id) return;
  const previousPhotoId = photoSelections.get(photo.date);
  const requestSequence = (photoSelectionRequestSequences.get(photo.date) || 0) + 1;
  photoSelectionRequestSequences.set(photo.date, requestSequence);
  photoSelections.set(photo.date, photo.id);
  refreshPreferredPhotoInViews(photo.date);
  renderViewerAlternatives(photo);
  showViewerChoiceStatus('Сохраняем выбор…');

  try {
    const response = await fetch(`/api/photo-selections/${encodeURIComponent(photo.date)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: photo.id })
    });
    if (!response.ok) {
      const value = await response.json().catch(() => null);
      throw new Error(value?.error || 'Не удалось сохранить выбор');
    }
    if (requestSequence === photoSelectionRequestSequences.get(photo.date)) showViewerChoiceStatus('Фото дня сохранено');
  } catch (error) {
    if (requestSequence !== photoSelectionRequestSequences.get(photo.date)) return;
    if (previousPhotoId) photoSelections.set(photo.date, previousPhotoId);
    else photoSelections.delete(photo.date);
    refreshPreferredPhotoInViews(photo.date);
    renderViewerAlternatives(photo);
    showViewerChoiceStatus(error.message, true);
  }
}

function renderViewerAlternatives(photo) {
  const dayPhotos = photo?.src ? byDate.get(photo.date) || [] : [];
  const hasAlternatives = dayPhotos.length > 1;
  viewerPanel.classList.toggle('has-alternatives', hasAlternatives);
  viewerAlternatives.hidden = !hasAlternatives || viewerDiaryVisible;
  if (!hasAlternatives) {
    viewerAlternativesTrack.replaceChildren();
    return;
  }

  const preferredPhoto = preferredPhotoForDate(photo.date, dayPhotos);
  const buttons = dayPhotos.map((candidate, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'viewer-alternative';
    const selected = candidate.id === preferredPhoto?.id;
    const current = candidate.id === photo.id;
    button.classList.toggle('is-selected', selected);
    button.classList.toggle('is-current', current);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `Вариант ${index + 1} из ${dayPhotos.length}${selected ? ', выбран как фото дня' : ''}`);
    const image = document.createElement('img');
    image.src = candidate.thumbnailSrc || candidate.src;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    const check = document.createElement('i');
    check.textContent = '✓';
    check.setAttribute('aria-hidden', 'true');
    button.append(image, check);
    button.addEventListener('click', () => {
      const archiveIndex = photos.findIndex((item) => item.id === candidate.id);
      if (archiveIndex >= 0) {
        activePhotos = photos;
        activeIndex = archiveIndex;
      }
      viewerDiaryVisible = false;
      updateViewer();
      selectPreferredPhoto(candidate);
    });
    return button;
  });
  viewerAlternativesTrack.replaceChildren(...buttons);
  const currentButton = buttons.find((button) => button.classList.contains('is-current'));
  currentButton?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function openViewer(dayPhotos, index = null) {
  const selectedPhoto = index === null
    ? preferredPhotoForDate(dayPhotos[0]?.date, dayPhotos)
    : dayPhotos[index] || dayPhotos[0];
  const archiveIndex = photos.findIndex((photo) => photo.src === selectedPhoto?.src);
  activePhotos = archiveIndex >= 0 ? photos : dayPhotos;
  activeIndex = archiveIndex >= 0 ? archiveIndex : Math.max(0, index || 0);
  viewerDiaryVisible = false;
  updateViewer();
  viewer.showModal();
  persistNavigationState();
}

function openDiary(date) {
  activePhotos = [{ date, diaryOnly: true }];
  activeIndex = 0;
  viewerDiaryVisible = true;
  updateViewer();
  viewer.showModal();
  persistNavigationState();
}

function canChangeViewerPhotoDate(photo = activePhotos[activeIndex]) {
  return Boolean(
    photo?.src
    && photo?.id
    && (!desktopBridge || desktopArchiveState?.mode === 'folder')
  );
}

function closeViewerDateEditor() {
  viewerDatePicker.close();
  viewerPanel.classList.remove('is-editing-date');
  viewerDateForm.hidden = true;
  viewerDateEdit.hidden = !canChangeViewerPhotoDate();
  viewerDateStatus.textContent = '';
  viewerDateStatus.classList.remove('is-error');
}

function openViewerDateEditor() {
  const photo = activePhotos[activeIndex];
  if (!canChangeViewerPhotoDate(photo) || viewerDateSaving) return;
  viewerDatePicker.setPhotoPreviews(new Map([...byDate].map(([date, dayPhotos]) => {
    const preferredPhoto = preferredPhotoForDate(date, dayPhotos);
    return [date, {
      src: preferredPhoto.thumbnailSrc || preferredPhoto.src,
      fallbackSrc: preferredPhoto.src,
      count: dayPhotos.length
    }];
  })));
  viewerDatePicker.setPhotoDates(byDate.keys());
  viewerDatePicker.setMax(localDateKey());
  viewerDatePicker.setValue(photo.date);
  viewerPanel.classList.add('is-editing-date');
  viewerDateForm.hidden = false;
  viewerDateEdit.hidden = true;
  viewerDateStatus.textContent = '';
  viewerDateStatus.classList.remove('is-error');
  viewerDatePicker.open();
}

function isValidViewerPhotoDate(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  const parsed = parseDate(value);
  return dateKey(parsed) === value && utcDayNumber(parsed) <= utcDayNumber(new Date());
}

async function changeViewerPhotoDate() {
  const photo = activePhotos[activeIndex];
  const nextDate = viewerDatePicker.value;
  if (!canChangeViewerPhotoDate(photo) || viewerDateSaving) return;
  if (!isValidViewerPhotoDate(nextDate)) {
    viewerDateStatus.textContent = 'Выберите корректную дату не позже сегодняшней';
    viewerDateStatus.classList.add('is-error');
    return;
  }
  if (nextDate === photo.date) {
    closeViewerDateEditor();
    return;
  }

  viewerDateSaving = true;
  viewerDatePicker.disabled = true;
  viewerDateSave.disabled = true;
  viewerDateCancel.disabled = true;
  viewerDateStatus.textContent = 'Переносим файл…';
  viewerDateStatus.classList.remove('is-error');
  try {
    const response = await fetch(`/api/photos/${photo.id}/date`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: nextDate })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || 'Не удалось изменить дату');
    Object.assign(photo, result.photo);
    closeViewerDateEditor();
    updateViewer();
    persistNavigationState();
    window.location.reload();
  } catch (error) {
    viewerDateStatus.textContent = error.message;
    viewerDateStatus.classList.add('is-error');
  } finally {
    viewerDateSaving = false;
    viewerDatePicker.disabled = false;
    viewerDateSave.disabled = false;
    viewerDateCancel.disabled = false;
  }
}

function prepareViewerPressZoom(event) {
  const isBlurred = presentationMode && viewerImage.classList.contains('is-presentation-blurred');
  if (event.button !== 0 || isBlurred || !viewerImage.classList.contains('is-loaded')) return;

  const bounds = viewerImage.getBoundingClientRect();
  if (!bounds.width || !bounds.height || !viewerImage.naturalWidth || !viewerImage.naturalHeight) return;

  const imageScale = Math.min(
    bounds.width / viewerImage.naturalWidth,
    bounds.height / viewerImage.naturalHeight
  );
  const displayedWidth = viewerImage.naturalWidth * imageScale;
  const displayedHeight = viewerImage.naturalHeight * imageScale;
  const displayedLeft = (bounds.width - displayedWidth) / 2;
  const displayedTop = (bounds.height - displayedHeight) / 2;
  const pointerX = event.clientX - bounds.left;
  const pointerY = event.clientY - bounds.top;

  if (pointerX < displayedLeft || pointerX > displayedLeft + displayedWidth
      || pointerY < displayedTop || pointerY > displayedTop + displayedHeight) return;

  viewerImage.style.setProperty('--viewer-zoom-origin-x', `${pointerX / bounds.width * 100}%`);
  viewerImage.style.setProperty('--viewer-zoom-origin-y', `${pointerY / bounds.height * 100}%`);
  viewerImage.style.setProperty('--viewer-pan-x', '0px');
  viewerImage.style.setProperty('--viewer-pan-y', '0px');
  viewerZoomPointerId = event.pointerId;
  viewerZoomStartX = event.clientX;
  viewerZoomStartY = event.clientY;
  viewerImage.classList.add('is-press-zoomable');
  viewerImage.setPointerCapture?.(event.pointerId);
}

function moveViewerPressZoom(event) {
  if (event.pointerId !== viewerZoomPointerId
      || !viewerImage.classList.contains('is-press-zoomable')) return;

  viewerImage.style.setProperty('--viewer-pan-x', `${event.clientX - viewerZoomStartX}px`);
  viewerImage.style.setProperty('--viewer-pan-y', `${event.clientY - viewerZoomStartY}px`);
}

function resetViewerPressZoom(event) {
  const pointerId = event?.pointerId ?? viewerZoomPointerId;
  viewerImage.classList.remove('is-press-zoomable');
  viewerImage.style.setProperty('--viewer-pan-x', '0px');
  viewerImage.style.setProperty('--viewer-pan-y', '0px');
  viewerZoomPointerId = null;
  if (pointerId !== null && viewerImage.hasPointerCapture?.(pointerId)) {
    viewerImage.releasePointerCapture(pointerId);
  }
}

function renderDiaryMarkdown(markdown) {
  const fragment = document.createDocumentFragment();
  const source = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/^---\n[\s\S]*?\n---(?:\n|$)/, '');
  const lines = source.split('\n');
  let paragraph = [];
  let list = null;
  let listType = '';

  const appendInlineMarkdown = (element, text) => {
    const pattern = /(!?\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > offset) element.append(document.createTextNode(text.slice(offset, match.index)));
      const token = match[0];
      let child;
      if (token.startsWith('![[') || token.startsWith('[[')) {
        child = document.createElement('span');
        child.className = 'diary-wikilink';
        const parts = token.replace(/^!?\[\[|\]\]$/g, '').split('|');
        child.textContent = parts.at(-1);
      } else if (token.startsWith('[')) {
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        child = document.createElement('a');
        child.textContent = link[1];
        if (/^https?:\/\//i.test(link[2])) {
          child.href = link[2];
          child.target = '_blank';
          child.rel = 'noreferrer';
        }
      } else if (token.startsWith('`')) {
        child = document.createElement('code');
        child.textContent = token.slice(1, -1);
      } else if (token.startsWith('**') || token.startsWith('__')) {
        child = document.createElement('strong');
        child.textContent = token.slice(2, -2);
      } else if (token.startsWith('~~')) {
        child = document.createElement('s');
        child.textContent = token.slice(2, -2);
      } else {
        child = document.createElement('em');
        child.textContent = token.slice(1, -1);
      }
      element.append(child);
      offset = match.index + token.length;
    }
    if (offset < text.length) element.append(document.createTextNode(text.slice(offset)));
  };

  const appendText = (tag, text, className = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    appendInlineMarkdown(element, text);
    fragment.append(element);
    return element;
  };
  const flushParagraph = () => {
    if (!paragraph.length) return;
    appendText('p', paragraph.join(' '));
    paragraph = [];
  };
  const closeList = () => {
    list = null;
    listType = '';
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (!line.trim()) {
      flushParagraph();
      closeList();
    } else if (heading) {
      flushParagraph();
      closeList();
      appendText(`h${Math.min(heading[1].length, 4)}`, heading[2]);
    } else if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      flushParagraph();
      closeList();
      fragment.append(document.createElement('hr'));
    } else if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (!list || listType !== nextType) {
        list = document.createElement(nextType);
        listType = nextType;
        fragment.append(list);
      }
      const item = document.createElement('li');
      const itemText = (unordered || ordered)[1];
      const task = itemText.match(/^\[([ xX])\]\s+(.+)$/);
      if (task) {
        item.className = 'diary-task';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task[1].toLowerCase() === 'x';
        checkbox.disabled = true;
        item.append(checkbox);
        const label = document.createElement('span');
        appendInlineMarkdown(label, task[2]);
        item.append(label);
      } else {
        appendInlineMarkdown(item, itemText);
      }
      list.append(item);
    } else if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      closeList();
      appendText('blockquote', line.replace(/^\s*>\s?/, ''));
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  viewerDiaryContent.replaceChildren(fragment);
}

function setViewerDiaryVisible(visible, hasDiary = viewerPanel.classList.contains('has-diary'), hasPhoto = !viewerPanel.classList.contains('is-diary-only')) {
  viewerDiaryVisible = Boolean(visible && hasDiary);
  viewerDiary.hidden = !hasDiary || (hasPhoto && !viewerDiaryVisible);
  viewerPanel.classList.toggle('is-diary-visible', viewerDiaryVisible);
  viewerDiaryToggle.hidden = !hasDiary || !hasPhoto;
  viewerDiaryToggle.textContent = viewerDiaryVisible ? 'Скрыть запись' : 'Показать запись';
  viewerDiaryToggle.setAttribute('aria-expanded', String(viewerDiaryVisible));
  if (viewerDiaryVisible) viewerAlternatives.hidden = true;
  else if (viewer.open) renderViewerAlternatives(activePhotos[activeIndex]);
}

function updateViewer() {
  const photo = activePhotos[activeIndex];
  const date = parseDate(photo.date);
  const diary = diaryByDate.get(photo.date);
  const hasPhoto = Boolean(photo.src);
  if (!viewerDateForm.hidden) closeViewerDateEditor();
  if (!viewerLocationEditor.hidden) closeViewerLocationEditor();
  desktopBridge?.setViewerPhotoContext?.(hasPhoto ? photo.id : null);
  resetViewerPressZoom();
  viewerPanel.classList.toggle('has-diary', Boolean(diary));
  viewerPanel.classList.toggle('is-diary-only', !hasPhoto);
  if (diary) renderDiaryMarkdown(diary.content);
  else viewerDiaryContent.replaceChildren();
  setViewerDiaryVisible(!hasPhoto && Boolean(diary), Boolean(diary), hasPhoto);
  viewerDiary.scrollTop = 0;
  viewerImage.classList.remove('is-loaded');
  if (hasPhoto) {
    imageLoader.classList.remove('is-hidden');
    viewerMedia.classList.add('is-photo-loading');
    viewerImage.dataset.pendingPhotoDate = photo.date;
    holdPhotoUntilReady(viewerImage);
    viewerImage.src = photo.src;
    viewerImage.alt = photo.displayDate ? `${photo.displayKicker}: ${photo.displayDate}` : `Фото за ${formatDate(photo.date)}`;
  } else {
    viewerImage.removeAttribute('src');
    viewerImage.alt = '';
    viewerImage.removeAttribute('data-pending-photo-date');
    viewerImage.classList.remove('is-photo-pending');
    viewerMedia.classList.remove('is-photo-loading');
    clearPhotoPresentationMark(viewerMedia);
    clearPhotoPresentationMark(viewerImage);
    imageLoader.classList.add('is-hidden');
  }
  document.querySelector('#viewerWeekday').textContent = photo.displayKicker
    || new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(date);
  document.querySelector('#viewerDate').textContent = photo.displayDate || formatDate(photo.date);
  document.querySelector('#photoPosition').textContent = activePhotos.length > 1
    ? `${(activeIndex + 1).toLocaleString('ru-RU')} / ${activePhotos.length.toLocaleString('ru-RU')}`
    : hasPhoto ? 'Фото дня' : 'Запись дня';
  document.querySelector('#previousPhoto').disabled = activePhotos.length < 2;
  document.querySelector('#nextPhoto').disabled = activePhotos.length < 2;
  viewerDateEdit.hidden = !canChangeViewerPhotoDate(photo);
  viewerBlurControl.hidden = !hasPhoto;
  viewerBlurToggle.checked = hasPhoto && blurDates.has(photo.date);
  viewerBlurToggle.disabled = !hasPhoto;
  updateViewerTrashControl(photo);
  updateViewerLocationControls(photo);
  updateViewerMiniMap(photo);
  updateViewerHighlightControls(photo);
  renderViewerAlternatives(photo);
  if (viewer.open) persistNavigationState();
}

function movePhoto(amount) {
  activeIndex = (activeIndex + amount + activePhotos.length) % activePhotos.length;
  updateViewer();
}

function restoreOpenViewer(state) {
  if (!state?.date) return;
  const dayPhotos = byDate.get(state.date) || [];
  if (dayPhotos.length) {
    const requestedIndex = state.photoId
      ? dayPhotos.findIndex((photo) => photo.id === state.photoId)
      : -1;
    openViewer(dayPhotos, requestedIndex >= 0 ? requestedIndex : null);
    if (state.diaryVisible && diaryByDate.has(state.date)) {
      setViewerDiaryVisible(true);
      persistNavigationState();
    }
  } else if (diaryByDate.has(state.date)) {
    openDiary(state.date);
  }
}

async function init() {
  try {
    const [response, diaryResponse, highlightsResponse, blurDatesResponse, photoSelectionsResponse, highlightSelectionsResponse, locationReferenceResponse] = await Promise.all([
      fetch('/api/photos'),
      fetch('/api/diary'),
      fetch('/api/highlights').catch(() => null),
      fetch('/api/blur-dates').catch(() => null),
      fetch('/api/photo-selections').catch(() => null),
      fetch('/api/highlight-selections').catch(() => null),
      fetch('/api/location-reference').catch(() => null)
    ]);
    if (!response.ok) throw new Error('Не удалось прочитать архив');
    photos = await response.json();
    if (!diaryResponse.ok) throw new Error('Не удалось прочитать дневник');
    diaryByDate = new Map((await diaryResponse.json()).map((entry) => [entry.date, entry]));
    if (highlightsResponse?.ok) {
      replaceHighlights(await highlightsResponse.json());
    }
    if (blurDatesResponse?.ok) replaceBlurDates(await blurDatesResponse.json());
    if (photoSelectionsResponse?.ok) {
      photoSelections = new Map(Object.entries(await photoSelectionsResponse.json()));
    }
    if (highlightSelectionsResponse?.ok) {
      replaceHighlightSelections(await highlightSelectionsResponse.json());
    }
    if (locationReferenceResponse?.ok) {
      const referenceDocument = await locationReferenceResponse.json();
      locationReferencePlaces = Array.isArray(referenceDocument?.places)
        ? referenceDocument.places
        : [];
    }

    for (const photo of photos) {
      if (!byDate.has(photo.date)) byDate.set(photo.date, []);
      byDate.get(photo.date).push(photo);
    }

    if (!photos.length && !diaryByDate.size) throw new Error('Фотографии и записи с распознанными датами не найдены');
    archiveYears = [...new Set([
      ...photos.map((photo) => Number(photo.date.slice(0, 4))),
      ...[...diaryByDate.keys()].map((date) => Number(date.slice(0, 4))),
      ...yearHighlights.keys()
    ])].sort((a, b) => b - a);
    yearSelect.replaceChildren(...archiveYears.map((year) => new Option(year, year)));
    const archiveDates = [...new Set([
      ...photos.map((photo) => photo.date),
      ...diaryByDate.keys()
    ])].sort();
    const earliest = parseDate(archiveDates[0]);
    const latest = parseDate(archiveDates.at(-1));
    firstArchiveMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    lastArchiveMonth = new Date(latest.getFullYear(), latest.getMonth(), 1);
    visibleDate = navigationState.calendar.date
      ? parseDate(navigationState.calendar.date)
      : new Date(latest.getFullYear(), latest.getMonth(), 1);
    calendarFocus = navigationState.calendar.focus;
    document.querySelectorAll('[data-calendar-focus]').forEach((button) => {
      const active = button.dataset.calendarFocus === calendarFocus;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (birthDate || photos.length) initializeLife();
    renderCalendar();
    switchView(navigationState.view, { persist: false });
    restoreOpenViewer(navigationState.viewer);
    setTimeout(() => persistNavigationState(), 250);
  } catch (error) {
    monthTitle.textContent = 'Архив недоступен';
    monthCount.textContent = error.message;
  }
}

function watchArchiveUpdates() {
  const events = new EventSource('/api/events');
  events.addEventListener('background-operation', (event) => {
    try {
      showBackgroundOperation(JSON.parse(event.data));
    } catch {
      // Следующее состояние операции придёт новым событием.
    }
  });
  events.addEventListener('archive-updated', () => {
    if (archiveSelectionInProgress || photoImportInProgress || operationNeedsAcknowledgement()) {
      archiveReloadPending = true;
      return;
    }
    clearTimeout(archiveReloadTimer);
    archiveReloadTimer = setTimeout(() => window.location.reload(), 900);
  });
  events.addEventListener('blur-dates-updated', (event) => {
    try {
      replaceBlurDates(JSON.parse(event.data));
    } catch {
      // Следующее изменение списка придёт новым событием.
    }
  });
  events.addEventListener('photo-selection-updated', (event) => {
    try {
      const { date, photoId } = JSON.parse(event.data);
      photoSelections.set(date, photoId);
      refreshPreferredPhotoInViews(date);
      if (viewer.open && activePhotos[activeIndex]?.date === date) {
        renderViewerAlternatives(activePhotos[activeIndex]);
      }
    } catch {
      // Следующее изменение выбора придёт новым событием.
    }
  });
  events.addEventListener('photo-location-updated', (event) => {
    try {
      updatePhotoLocationState(JSON.parse(event.data));
    } catch {
      // Следующее изменение геометки придёт новым событием.
    }
  });
  events.addEventListener('highlight-selection-updated', (event) => {
    try {
      const state = JSON.parse(event.data);
      replaceHighlightSelections(state.selections);
      replaceHighlights(state.highlights);
      renderCalendar();
      if (viewer.open) updateViewerHighlightControls();
    } catch {
      // Следующее изменение отметок придёт новым событием.
    }
  });
}

document.querySelector('#previousMonth').addEventListener('click', () => shiftMonth(-1));
document.querySelector('#nextMonth').addEventListener('click', () => shiftMonth(1));
document.querySelector('#todayButton').addEventListener('click', () => {
  visibleDate = new Date();
  if (calendarFocus === 'years') setCalendarFocus('month');
  else {
    renderCalendar();
    persistNavigationState();
  }
});
document.querySelectorAll('.view-switch').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
mapLocationSearch = setupLocationSearch({
  form: mapSearch,
  input: mapSearchInput,
  resultsElement: mapSearchResults,
  getMap: () => {
    ensureMap();
    return mapController;
  },
  onSelect: (location, result) => {
    if (mapAssignmentPhotos.length) {
      void assignCurrentPhotoToLocation(location);
    } else if (!mapPlaceEditor.hidden) {
      setMapPlaceDraft(location, {
        suggestName: result?.coordinatesOnly ? '' : result?.place || result?.displayName,
        country: result?.country
      });
    }
  }
});
viewerLocationPlaceSearch = setupLocationSearch({
  form: viewerLocationSearch,
  input: viewerLocationSearchInput,
  resultsElement: viewerLocationSearchResults,
  suggestionsButton: viewerLocationSuggestionsToggle,
  getMap: () => {
    ensureViewerLocationMap();
    return viewerLocationMap;
  },
  onSelect: setViewerLocationDraft,
  getSuggestionSections: () => placeSuggestionSections(5).map(({ title, type, candidates }) => ({
    title,
    results: candidates.map(({ place, photoCount }) => ({
      ...place,
      referenceId: place.id,
      place: place.name,
      displayName: [place.name, place.country].filter(Boolean).join(' · '),
      suggestionDetail: type === 'recent'
        ? `Недавно выбрано · ${photoCount.toLocaleString('ru-RU')} ${pluralize(photoCount, ['фотография', 'фотографии', 'фотографий'])}`
        : `${photoCount.toLocaleString('ru-RU')} ${pluralize(photoCount, ['фотография', 'фотографии', 'фотографий'])}`
    }))
  }))
});
mapAddPlaceButton.addEventListener('click', startMapPlaceCreation);
mapAssignButton.addEventListener('click', startMapAssignment);
mapPlaybackButton.addEventListener('click', () => {
  if (mapPlaybackActive) stopMapPlayback();
  else startMapPlayback();
});
mapPlaybackPlay.addEventListener('click', () => {
  if (mapPlaybackPlaying) {
    setMapPlaybackPlaying(false);
    return;
  }
  if (mapPlaybackIndex >= mapPlaybackFrames.length - 1) setMapPlaybackFrame(0);
  setMapPlaybackPlaying(true);
});
mapPlaybackRange.addEventListener('input', () => {
  setMapPlaybackPlaying(false);
  setMapPlaybackFrame(mapPlaybackRange.value);
});
mapPlaybackPrevious.addEventListener('click', () => {
  setMapPlaybackPlaying(false);
  setMapPlaybackFrame(mapPlaybackIndex - 1);
});
mapPlaybackNext.addEventListener('click', () => {
  setMapPlaybackPlaying(false);
  setMapPlaybackFrame(mapPlaybackIndex + 1);
});
mapPlaybackSpeed.addEventListener('change', () => {
  if (mapPlaybackPlaying) scheduleMapPlayback();
});
mapPlaybackClose.addEventListener('click', () => stopMapPlayback());
mapPlaceName.addEventListener('input', () => {
  mapPlaceSave.disabled = !mapPlaceDraft || !mapPlaceName.value.trim() || mapPlaceSaving;
});
mapPlaceEditor.addEventListener('submit', (event) => {
  event.preventDefault();
  void saveMapPlace();
});
document.querySelector('#mapPlaceCancel').addEventListener('click', finishMapPlaceCreation);
document.querySelector('#mapPlaceCancelSecondary').addEventListener('click', finishMapPlaceCreation);
document.querySelector('#mapZoomIn').addEventListener('click', () => mapController?.zoomBy(1));
document.querySelector('#mapZoomOut').addEventListener('click', () => mapController?.zoomBy(-1));
mapAssignmentSkip.addEventListener('click', skipMapAssignmentPhoto);
mapAssignmentDone.addEventListener('click', finishMapAssignment);
mapAssignmentPreview.addEventListener('click', openCurrentMapAssignmentPhoto);
mapAssignmentChoosePlace.addEventListener('click', () => {
  openMapPlacePicker(mapAssignmentPhotos[mapAssignmentIndex], 'assignment');
});
document.querySelector('#mapPhotoClose').addEventListener('click', () => {
  mapPhotoCard.hidden = true;
  mapController?.setHighlightedPoint(null);
});
document.querySelector('#mapPhotoPrevious').addEventListener('click', () => moveMapPhoto(-1));
document.querySelector('#mapPhotoNext').addEventListener('click', () => moveMapPhoto(1));
mapPhotoPreview.addEventListener('click', openCurrentMapPhoto);
mapPhotoChoosePlace.addEventListener('click', startMapPhotoPlacement);
mapPlaceAttachPhoto.addEventListener('click', openMapPhotoPicker);
mapPointRename.addEventListener('click', startMapPointRename);
mapPointDelete.addEventListener('click', () => void deleteActiveMapPoint());
document.querySelector('#mapPhotoPickerClose').addEventListener('click', closeMapPhotoPicker);
mapPhotoPickerSearch.addEventListener('input', renderMapPhotoPicker);
mapPhotoPickerDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeMapPhotoPicker();
});
mapPhotoPickerDialog.addEventListener('click', (event) => {
  if (event.target === mapPhotoPickerDialog) closeMapPhotoPicker();
});
document.querySelector('#mapPlacePickerClose').addEventListener('click', closeMapPlacePicker);
mapPlacePickerSearch.addEventListener('input', () => {
  if (mapPlacePickerSearch.value.trim()) mapPlacePickerSuggestionsVisible = false;
  renderMapPlacePicker();
});
mapPlaceSuggestionsToggle.addEventListener('click', () => {
  mapPlacePickerSuggestionsVisible = !mapPlacePickerSuggestionsVisible;
  renderMapPlacePicker();
});
mapPlacePickerDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeMapPlacePicker();
});
mapPlacePickerDialog.addEventListener('click', (event) => {
  if (event.target === mapPlacePickerDialog) closeMapPlacePicker();
});
mapPhotoImage.addEventListener('error', () => {
  const fallbackSrc = mapPhotoImage.dataset.fallbackSrc;
  if (fallbackSrc && mapPhotoImage.getAttribute('src') !== fallbackSrc) mapPhotoImage.src = fallbackSrc;
});
mapAssignmentImage.addEventListener('load', () => {
  clearTimeout(mapAssignmentImageFallbackTimer);
  mapAssignmentImageFallbackTimer = 0;
});
mapAssignmentImage.addEventListener('error', () => {
  clearTimeout(mapAssignmentImageFallbackTimer);
  mapAssignmentImageFallbackTimer = 0;
  const fallbackSrc = mapAssignmentImage.dataset.fallbackSrc;
  if (fallbackSrc && mapAssignmentImage.getAttribute('src') !== fallbackSrc) {
    mapAssignmentImage.src = fallbackSrc;
  }
});
presentationButton.addEventListener('click', () => setPresentationMode(!presentationMode));
timelineTrack.addEventListener('scroll', () => {
  scheduleTimelineScrollbarUpdate();
  scheduleTimelineWindowRender();
  scheduleNavigationStateSave();
}, { passive: true });
timelineScrollbar.addEventListener('input', () => {
  const maxScroll = Math.max(0, timelineTrack.scrollWidth - timelineTrack.clientWidth);
  timelineTrack.scrollLeft = maxScroll * Number(timelineScrollbar.value) / Number(timelineScrollbar.max);
});
window.addEventListener('wheel', (event) => {
  if (timelineView.hidden || viewer.open || (event.deltaX === 0 && event.deltaY === 0)) return;
  event.preventDefault();
  const multiplier = event.deltaMode === 1
    ? 24
    : event.deltaMode === 2
      ? timelineTrack.clientWidth
      : 1;
  const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
    ? event.deltaY
    : event.deltaX;
  timelineTrack.scrollLeft += delta * multiplier;
}, { passive: false, capture: true });
lifeCanvas.addEventListener('pointermove', showLifeTooltip);
lifeTooltipPreview.addEventListener('error', () => {
  const fallbackSrc = lifeTooltipPreview.dataset.fallbackSrc;
  if (fallbackSrc && lifeTooltipPreview.getAttribute('src') !== fallbackSrc) {
    lifeTooltipPreview.removeAttribute('data-fallback-src');
    lifeTooltipPreview.src = fallbackSrc;
    return;
  }
  lifeTooltipMedia.hidden = true;
});
lifeCanvas.addEventListener('pointerleave', () => {
  lifeTooltip.hidden = true;
  lifeTooltipIndex = -1;
  lifeCanvas.style.cursor = 'crosshair';
});
lifeCanvas.addEventListener('click', (event) => {
  const index = lifeIndexFromPointer(event);
  const photo = lifeLayout?.photoIndices.get(index);
  if (photo) openViewer(photo.dayPhotos);
});
lifeRemainingToggle.addEventListener('change', () => {
  lifeFutureLegend.hidden = !lifeRemainingToggle.checked;
  lifeTooltip.hidden = true;
  renderLifeCanvas();
});
lifeBirthDateInput.addEventListener('input', () => {
  lifeBirthDateInput.classList.remove('is-error');
  lifeBirthDateStatus.classList.remove('is-error');
  lifeBirthDateStatus.textContent = lifeBirthDatePicker.value
    ? 'Нажмите Enter'
    : lifeBirthDateInput.value.trim()
      ? 'Можно ввести 9.7.1990'
      : 'Формат: ДД.ММ.ГГГГ';
});
lifeBirthDateInput.addEventListener('change', commitBirthDateInput);
lifeBirthDateInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitBirthDateInput();
  } else if (event.key === 'Escape') {
    updateLifeBirthDateUi();
    lifeBirthDateInput.blur();
  }
});
document.querySelector('#randomToggle').addEventListener('click', toggleRandomPause);
document.querySelector('#randomNext').addEventListener('click', showNextRandomPhoto);
document.querySelector('#randomFullscreen').addEventListener('click', toggleRandomFullscreen);
function handleRandomFullscreenChange() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  if (randomNativeFullscreenActive && fullscreenElement !== document.documentElement) {
    randomNativeFullscreenActive = false;
    setRandomNativeFullscreen(false);
    setRandomFullscreenFallback(false);
  }
  updateRandomFullscreenButton();
}
document.addEventListener('fullscreenchange', handleRandomFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleRandomFullscreenChange);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && randomView.classList.contains('is-fullscreen-fallback')) {
    exitRandomFullscreen();
  }
});
document.querySelector('#randomStage').addEventListener('click', openCurrentRandomPhoto);
document.querySelector('#randomStage').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openCurrentRandomPhoto();
  }
});
let lifeResizeFrame;
window.addEventListener('resize', () => {
  cancelAnimationFrame(lifeResizeFrame);
  lifeResizeFrame = requestAnimationFrame(() => {
    renderLifeCanvas();
    if (!timelineView.hidden) {
      const maxScroll = Math.max(0, timelineTrack.scrollWidth - timelineTrack.clientWidth);
      const progress = maxScroll ? timelineTrack.scrollLeft / maxScroll : 0;
      renderTimelineWindow(true);
      timelineTrack.scrollLeft = progress * Math.max(0, timelineTrack.scrollWidth - timelineTrack.clientWidth);
      renderTimelineWindow(true);
      updateTimelineScrollbar();
      renderTimelineYears();
    }
  });
});
window.addEventListener('photo-day-theme-change', renderLifeCanvas);
yearSelect.addEventListener('change', () => {
  visibleDate = new Date(Number(yearSelect.value), visibleDate.getMonth(), 1);
  renderCalendar();
  persistNavigationState();
  yearSelect.blur();
});
document.querySelectorAll('[data-calendar-focus]').forEach((button) => {
  button.addEventListener('click', () => setCalendarFocus(button.dataset.calendarFocus));
});
document.querySelectorAll('[data-close]').forEach((element) => element.addEventListener('click', () => viewer.close()));
document.querySelector('#previousPhoto').addEventListener('click', () => movePhoto(-1));
document.querySelector('#nextPhoto').addEventListener('click', () => movePhoto(1));
viewerDateEdit.addEventListener('click', openViewerDateEditor);
viewerDateCancel.addEventListener('click', closeViewerDateEditor);
viewerDateInput.addEventListener('date-picker-select', () => {
  void changeViewerPhotoDate();
});
viewerDateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void changeViewerPhotoDate();
});
viewerTrashButton.addEventListener('click', () => void trashViewerPhoto());
viewerLocationButton.addEventListener('click', openViewerLocationEditor);
viewerMiniMapOpen.addEventListener('click', openCurrentViewerPhotoOnMap);
document.querySelector('#viewerLocationClose').addEventListener('click', closeViewerLocationEditor);
document.querySelector('#viewerLocationZoomIn').addEventListener('click', () => viewerLocationMap?.zoomBy(1));
document.querySelector('#viewerLocationZoomOut').addEventListener('click', () => viewerLocationMap?.zoomBy(-1));
viewerLocationSave.addEventListener('click', saveViewerLocation);
viewerLocationRemove.addEventListener('click', removeViewerLocation);
viewerDiaryToggle.addEventListener('click', () => {
  setViewerDiaryVisible(!viewerDiaryVisible);
  persistNavigationState();
});
viewerMonthHighlight.addEventListener('click', () => setPeriodHighlight('month'));
viewerYearHighlight.addEventListener('click', () => setPeriodHighlight('year'));
viewerBlurToggle.addEventListener('change', async () => {
  const photo = activePhotos[activeIndex];
  if (!photo) return;
  const date = photo.date;
  const shouldBlur = viewerBlurToggle.checked;
  const wasBlurred = blurDates.has(date);
  viewerBlurToggle.disabled = true;
  if (shouldBlur) blurDates.add(date);
  else blurDates.delete(date);
  storeBlurDates();
  refreshPresentationBlurState();

  try {
    const response = await fetch(`/api/blur-dates/${encodeURIComponent(date)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blurred: shouldBlur })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || 'Не удалось сохранить');
    replaceBlurDates(result);
    showViewerBlurStatus('Сохранено');
  } catch (error) {
    if (wasBlurred) blurDates.add(date);
    else blurDates.delete(date);
    storeBlurDates();
    refreshPresentationBlurState();
    showViewerBlurStatus(error.message, true);
  } finally {
    viewerBlurToggle.disabled = false;
  }
});
viewerImage.addEventListener('load', async () => {
  const pendingDate = viewerImage.dataset.pendingPhotoDate;
  if (!pendingDate || !await revealPhotoAfterDecode(viewerImage, pendingDate, viewerMedia)) return;
  viewerImage.removeAttribute('data-pending-photo-date');
  viewerMedia.classList.remove('is-photo-loading');
  viewerImage.classList.add('is-loaded');
  imageLoader.classList.add('is-hidden');
});
viewerImage.addEventListener('pointerdown', prepareViewerPressZoom);
viewerImage.addEventListener('pointermove', moveViewerPressZoom);
viewerImage.addEventListener('pointerup', resetViewerPressZoom);
viewerImage.addEventListener('pointercancel', resetViewerPressZoom);
viewerImage.addEventListener('lostpointercapture', resetViewerPressZoom);
viewerImage.addEventListener('dragstart', (event) => event.preventDefault());
viewer.addEventListener('close', () => {
  desktopBridge?.setViewerPhotoContext?.(null);
  closeViewerDateEditor();
  closeViewerLocationEditor();
  resetViewerPressZoom();
  persistNavigationState();
});
window.addEventListener('beforeunload', () => {
  desktopBridge?.setViewerPhotoContext?.(null);
  persistNavigationState({ desktopDelay: 0 });
});
document.addEventListener('keydown', (event) => {
  if (viewer.open) {
    if (!viewerDateForm.hidden) {
      if (event.key === 'Escape') closeViewerDateEditor();
      return;
    }
    if (!viewerLocationEditor.hidden) {
      if (event.key === 'Escape') closeViewerLocationEditor();
      return;
    }
    if (event.key === 'ArrowLeft' && activePhotos.length > 1) movePhoto(-1);
    if (event.key === 'ArrowRight' && activePhotos.length > 1) movePhoto(1);
    return;
  }

  const isArrowKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
  const target = event.target;
  const isEditableTarget = target instanceof HTMLElement
    && (target.matches('input, select, textarea') || target.isContentEditable);

  if (event.code === 'KeyM'
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey
      && !isEditableTarget
      && !mapView.hidden
      && !mapPhotoCard.hidden
      && !mapPhotoChoosePlace.hidden
      && !mapPhotoChoosePlace.disabled
      && mapAssignment.hidden
      && mapPlaceEditor.hidden
      && !mapPhotoPickerDialog.open
      && !mapPlacePickerDialog.open) {
    event.preventDefault();
    startMapPhotoPlacement();
    return;
  }

  if (!document.querySelector('#calendarView').hidden
      && ['year', 'month', 'week'].includes(calendarFocus)
      && isArrowKey
      && !isEditableTarget) {
    event.preventDefault();
    const amount = event.key === 'ArrowLeft' ? -1 : 1;
    const navigationButton = document.querySelector(amount < 0 ? '#previousMonth' : '#nextMonth');
    if (!navigationButton.disabled) shiftMonth(amount);
    return;
  }

  if (!randomView.hidden && event.key === 'ArrowRight' && !isEditableTarget) {
    event.preventDefault();
    showNextRandomPhoto();
    return;
  }

  if (timelineView.hidden || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  timelineTrack.scrollBy({
    left: (event.key === 'ArrowLeft' ? -1 : 1) * window.innerWidth / 2,
    behavior: 'smooth'
  });
});

window.addEventListener('storage', (event) => {
  if (event.key === PRESENTATION_MODE_STORAGE_KEY) {
    setPresentationMode(event.newValue === 'true');
  }
  if (event.key === BLUR_DATES_STORAGE_KEY) {
    try {
      replaceBlurDates(JSON.parse(event.newValue || '[]'));
    } catch {
      // Оставляем последнюю валидную копию.
    }
  }
  if (event.key === LIFE_BIRTH_DATE_STORAGE_KEY && !desktopBridge) {
    birthDate = isValidBirthDate(event.newValue || '') ? event.newValue : '';
    rebuildLife();
    updateLifeBirthDateUi();
  }
});

window.addEventListener('dragenter', handlePhotoDragEnter);
window.addEventListener('dragover', handlePhotoDragOver);
window.addEventListener('dragleave', handlePhotoDragLeave);
window.addEventListener('drop', handlePhotoDrop);
window.addEventListener('dragend', resetPhotoDragState);
window.addEventListener('blur', resetPhotoDragState);
aboutButton.addEventListener('click', openAboutDialog);
aboutClose.addEventListener('click', () => aboutDialog.close());
aboutDialog.addEventListener('click', (event) => {
  if (event.target === aboutDialog) aboutDialog.close();
});
photoImportClose.addEventListener('click', closePhotoImportDialog);
photoImportCancel.addEventListener('click', closePhotoImportDialog);
photoImportDialog.addEventListener('cancel', (event) => {
  if (photoImportInProgress) {
    event.preventDefault();
    return;
  }
  closePhotoImportDialog();
});
photoImportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!desktopBridge || photoImportInProgress || !pendingPhotoImportPaths.length) return;
  photoImportDatePicker.validate();
  if (!photoImportForm.reportValidity()) return;

  photoImportInProgress = true;
  photoImportSuggestionSequence += 1;
  photoImportDatePicker.disabled = true;
  photoImportSubmit.disabled = true;
  photoImportCancel.disabled = true;
  photoImportClose.disabled = true;
  photoImportSubmit.textContent = 'Сохраняем…';
  photoImportError.hidden = true;
  let reloadAfterImport = false;
  try {
    const result = await desktopBridge.importPhotos(pendingPhotoImportPaths, photoImportDatePicker.value);
    if (result.warning) {
      pendingPhotoImportPaths = [];
      photoImportError.textContent = `Фотографии сохранены, но не добавлены в календарь: ${result.warning}`;
      photoImportError.hidden = false;
      photoImportSubmit.textContent = 'Файлы сохранены';
    } else {
      reloadAfterImport = true;
    }
  } catch (error) {
    photoImportError.textContent = `Не удалось сохранить фотографии: ${error.message}`;
    photoImportError.hidden = false;
    photoImportSubmit.textContent = 'Повторить';
  } finally {
    photoImportInProgress = false;
    photoImportDatePicker.disabled = false;
    photoImportSubmit.disabled = pendingPhotoImportPaths.length === 0;
    photoImportCancel.disabled = false;
    photoImportClose.disabled = false;
  }

  if (reloadAfterImport) {
    archiveReloadPending = false;
    closePhotoImportDialog();
    window.location.reload();
  }
});

archiveSettingsButton.addEventListener('click', () => showArchiveSetup('settings'));
backgroundOperationClose.addEventListener('click', dismissBackgroundOperation);
archiveSetupClose.addEventListener('click', () => archiveSetupDialog.close());
archiveSetupDialog.addEventListener('cancel', (event) => {
  if (archiveSetupDialog.dataset.mode === 'welcome') event.preventDefault();
});
archiveRevealButton.addEventListener('click', async () => {
  if (!desktopBridge) return;
  const opened = await desktopBridge.revealArchiveDirectory();
  if (!opened) {
    archiveSetupError.textContent = 'Не удалось открыть папку в проводнике.';
    archiveSetupError.hidden = false;
  }
});
archiveConvertToggle.addEventListener('change', async () => {
  if (!desktopBridge) return;
  const previousValue = Boolean(desktopArchiveState?.convertImages);
  const requestedValue = archiveConvertToggle.checked;
  archiveConvertToggle.disabled = true;
  archiveSetupError.hidden = true;
  try {
    const state = await desktopBridge.setArchiveConversion(requestedValue);
    updateArchiveSettingsUi(state);
    if (state.error) {
      archiveSetupError.textContent = state.error;
      archiveSetupError.hidden = false;
    }
  } catch (error) {
    archiveConvertToggle.checked = previousValue;
    archiveSetupError.textContent = `Не удалось изменить настройку: ${error.message}`;
    archiveSetupError.hidden = false;
  } finally {
    archiveConvertToggle.disabled = !desktopArchiveState?.canConvertImages;
  }
});

async function selectArchiveSource(action, activeButton) {
  if (!desktopBridge || archiveSelectionInProgress) return;
  const activeLabel = activeButton.querySelector('strong');
  const previousLabel = activeLabel.textContent;
  archiveSelectionInProgress = true;
  archiveChooseButton.disabled = true;
  archiveComputerButton.disabled = true;
  activeLabel.textContent = activeButton === archiveChooseButton ? 'Выбираем…' : 'Начинаем поиск…';
  archiveSetupError.hidden = true;
  archiveIndexProgress.hidden = false;
  archiveIndexDetail.textContent = 'Готовим индексацию…';
  archiveIndexAmount.textContent = '0%';
  archiveIndexEta.textContent = 'Оцениваем время завершения…';
  archiveIndexBar.setAttribute('aria-valuenow', '0');
  archiveIndexBarFill.style.width = '0%';
  try {
    const state = await action();
    if (state.canceled) {
      archiveIndexProgress.hidden = true;
      return;
    }
    updateArchiveSettingsUi(state);
    if (state.error || !state.available) {
      archiveSetupError.textContent = state.error || 'Выбранный источник недоступен.';
      archiveSetupError.hidden = false;
      return;
    }
    if (operationNeedsAcknowledgement()) {
      archiveReloadPending = true;
      return;
    }
    window.location.reload();
  } catch (error) {
    archiveSetupError.textContent = `Не удалось создать индекс: ${error.message}`;
    archiveSetupError.hidden = false;
  } finally {
    archiveSelectionInProgress = false;
    archiveChooseButton.disabled = false;
    archiveComputerButton.disabled = false;
    activeLabel.textContent = previousLabel;
    if (archiveReloadPending && !operationNeedsAcknowledgement()) {
      archiveReloadPending = false;
      clearTimeout(archiveReloadTimer);
      archiveReloadTimer = setTimeout(() => window.location.reload(), 0);
    }
  }
}

archiveChooseButton.addEventListener('click', () => {
  selectArchiveSource(() => desktopBridge.chooseArchiveDirectory(), archiveChooseButton);
});
archiveComputerButton.addEventListener('click', () => {
  selectArchiveSource(() => desktopBridge.scanPhotoLocations(), archiveComputerButton);
});

setPresentationMode(presentationMode);
updateLifeBirthDateUi();
initializeDesktopShell().finally(() => {
  init();
  watchArchiveUpdates();
});
