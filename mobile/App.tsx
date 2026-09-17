import { StatusBar } from 'expo-status-bar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { requireOptionalNativeModule, requireNativeView } from 'expo';
import type { GlassViewProps } from 'expo-glass-effect';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type ViewStyle,
  useColorScheme,
  useWindowDimensions,
  View
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import PhotoArchive, {
  type ArchiveDirectory,
  type ArchiveLocation,
  type ArchivePhoto,
  type ArchiveScanProgress,
  type ArchiveViewerMetadata
} from './modules/photo-archive';
import {
  buildArchiveYears,
  buildCalendarMonth,
  buildCalendarWeek,
  buildCalendarWeeks,
  buildPhotoIndex,
  dateFromKey,
  photosInChronologicalOrder,
  type ArchiveMonthSummary,
  type ArchiveYearSummary,
  type CalendarCell,
  type IndexedPhoto,
  type PhotoIndex
} from './src/calendar';
import { calendarMoveTarget, type CalendarRangeFocus } from './src/calendar-range';
import { horizontalPageShift, isHorizontalSwipeIntent } from './src/gestures';
import {
  buildArchiveMapGroups,
  buildArchiveOverviewMapHtml,
  buildMiniMapTiles,
  buildPhotoLocationMapHtml,
  type ArchiveMapGroup,
  type LocatedArchivePhoto
} from './src/map';
import {
  createProximityWarmup,
  createTaskQueue,
  prewarmItems,
  type ProximityWarmup
} from './src/preview-queue';
import { loadDisplayPhoto, loadPhotoPreview } from './src/photo-display';
import {
  pinchDistance,
  pinchFocalPoint,
  pinchPageFocalPoint,
  pinchTranslation,
  shouldStartPinch,
  transientPinchScale,
  type PinchFocalPoint
} from './src/pinch-zoom';
import {
  loadPhotoExifLocation,
  resolvePhotoLocation
} from './src/photo-location';
import {
  isPresentationPhotoBlurred,
  normalizeStoredPresentationMode,
  PRESENTATION_MODE_STORAGE_KEY
} from './src/presentation';
import {
  scanProgressDescription,
  scanProgressRatio,
  scanProgressTitle
} from './src/scan-progress';
import {
  darkPalette,
  lightPalette,
  normalizeTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type AppPalette as Palette,
  type ColorTheme
} from './src/theme';
import {
  EMPTY_VIEWER_METADATA,
  formatViewerDate,
  moveViewerMetadata,
  normalizePlaceSearchResults,
  normalizeViewerMetadata,
  parseCoordinateQuery,
  parseViewerDate,
  retargetPhotoPath,
  type PlaceSearchResult
} from './src/viewer';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric'
});
const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});
const MONTH_NAME_FORMATTER = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
const WEEK_EDGE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short'
});
const WEEK_DAY_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  weekday: 'long'
});
const enqueuePreview = createTaskQueue(2);
const enqueuePreviewWarmup = createTaskQueue(1);
const enqueueDisplayPhoto = createTaskQueue(1);
const previewJobs = new Map<string, Promise<string>>();
const displayPhotoJobs = new Map<string, Promise<string>>();
const completedPreviewUris = new Map<string, string>();
const completedDisplayUris = new Map<string, string>();
const completedExifLocations = new Map<string, ArchiveLocation | null>();
const BACKGROUND_PREVIEW_PRIORITY = 0;
const VISIBLE_PREVIEW_PRIORITY = 10;
let activePreviewWarmup: ProximityWarmup<ArchivePhoto> | null = null;
const PREFERRED_PHOTOS_KEY_PREFIX = 'photo-day:preferred-photos:';

type PresentationModeContextValue = {
  active: boolean;
  blurDates: ReadonlySet<string>;
  toggle: () => boolean;
};

const PresentationModeContext = createContext<PresentationModeContextValue>({
  active: false,
  blurDates: new Set<string>(),
  toggle: () => false
});

type GlassEffectNativeModule = {
  isGlassEffectAPIAvailable?: boolean;
};

const glassEffectNativeModule = Platform.OS === 'ios'
  ? requireOptionalNativeModule<GlassEffectNativeModule>('ExpoGlassEffect')
  : null;
const NativeViewerGlassView = glassEffectNativeModule?.isGlassEffectAPIAvailable
  ? requireNativeView<GlassViewProps>('ExpoGlassEffect', 'GlassView')
  : null;

type CalendarFocus = 'month' | 'week' | 'year' | 'years';
type AppMode = 'calendar' | 'map';
type ViewerSelection = {
  date: string;
  relativePath?: string;
};

type MobileIconName = keyof typeof MOBILE_ICONS;

const MOBILE_ICONS = {
  blur: 'blur',
  calendar: 'calendar-month-outline',
  check: 'check',
  close: 'close',
  edit: 'pencil-outline',
  folder: 'folder-outline',
  location: 'map-marker-outline',
  map: 'map-outline',
  month: 'calendar-month-outline',
  move: 'calendar-arrow-right',
  next: 'chevron-right',
  note: 'note-edit-outline',
  previous: 'chevron-left',
  presentation: 'presentation-play',
  retry: 'refresh',
  search: 'magnify',
  star: 'star-outline',
  starFilled: 'star',
  theme: 'theme-light-dark',
  today: 'calendar-today',
  trash: 'trash-can-outline',
  week: 'calendar-week',
  year: 'calendar-range',
  yearHighlight: 'trophy-outline',
  years: 'calendar-multiple'
} as const;

function MobileIcon({
  color,
  name,
  size = 22
}: {
  color: string;
  name: MobileIconName;
  size?: number;
}) {
  return <MaterialCommunityIcons color={color} name={MOBILE_ICONS[name]} size={size} />;
};

const CALENDAR_FOCUSES: Array<{
  focus: CalendarFocus;
  icon: MobileIconName;
  label: string;
}> = [
  { focus: 'years', icon: 'years', label: 'Годы' },
  { focus: 'year', icon: 'year', label: 'Год' },
  { focus: 'month', icon: 'month', label: 'Месяц' },
  { focus: 'week', icon: 'week', label: 'Неделя' }
];

export default function App() {
  const colorScheme = useColorScheme();
  const [storedTheme, setStoredTheme] = useState<ColorTheme | null>(null);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const theme = resolveTheme(storedTheme, colorScheme === 'dark');
  const palette = theme === 'dark' ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [directory, setDirectory] = useState<ArchiveDirectory | null>(null);
  const [photos, setPhotos] = useState<ArchivePhoto[]>([]);
  const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [appMode, setAppMode] = useState<AppMode>('calendar');
  const [calendarFocus, setCalendarFocus] = useState<CalendarFocus>('month');
  const [viewerSelection, setViewerSelection] = useState<ViewerSelection | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [scanProgress, setScanProgress] = useState<ArchiveScanProgress | null>(null);
  const [preferredPaths, setPreferredPaths] = useState<Record<string, string>>({});
  const [viewerMetadata, setViewerMetadata] = useState<ArchiveViewerMetadata>(EMPTY_VIEWER_METADATA);
  const [appToast, setAppToast] = useState('');
  const [presentationMode, setPresentationMode] = useState(false);

  const index = useMemo(() => buildPhotoIndex(photos, preferredPaths), [photos, preferredPaths]);
  const cells = useMemo(
    () => buildCalendarMonth(viewMonth.getFullYear(), viewMonth.getMonth()),
    [viewMonth]
  );
  const weeks = useMemo(() => buildCalendarWeeks(cells), [cells]);
  const week = useMemo(() => buildCalendarWeek(viewMonth), [viewMonth]);
  const archiveYears = useMemo(
    () => buildArchiveYears(index, viewerMetadata.highlights),
    [index, viewerMetadata.highlights]
  );
  const visibleYear = archiveYears.find((summary) => summary.year === viewMonth.getFullYear());
  const viewerPhotos = useMemo(() => photosInChronologicalOrder(index), [index]);
  const mapGroups = useMemo(
    () => buildArchiveMapGroups(viewerPhotos, viewerMetadata.locations),
    [viewerMetadata.locations, viewerPhotos]
  );
  const mapPhotoCount = useMemo(
    () => mapGroups.reduce((count, group) => count + group.photos.length, 0),
    [mapGroups]
  );
  const previewWarmupPhotos = viewerPhotos;
  const presentationBlurDates = useMemo(
    () => new Set(viewerMetadata.blurDates),
    [viewerMetadata.blurDates]
  );
  const screenCalendar = appMode === 'calendar'
    && (calendarFocus === 'month' || calendarFocus === 'week');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .catch(() => null)
      .then((value) => {
        if (active) setStoredTheme(normalizeTheme(value));
      })
      .finally(() => {
        if (active) setThemeLoaded(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PRESENTATION_MODE_STORAGE_KEY)
      .catch(() => null)
      .then((value) => {
        if (active) setPresentationMode(normalizeStoredPresentationMode(value));
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!appToast) return;
    const timer = setTimeout(() => setAppToast(''), 2200);
    return () => clearTimeout(timer);
  }, [appToast]);

  const toggleTheme = useCallback(() => {
    const nextTheme: ColorTheme = theme === 'dark' ? 'light' : 'dark';
    setStoredTheme(nextTheme);
    setAppToast(nextTheme === 'dark' ? 'Тёмная тема включена' : 'Светлая тема включена');
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme).catch(() => undefined);
  }, [theme]);

  const togglePresentationMode = useCallback(() => {
    const next = !presentationMode;
    setPresentationMode(next);
    void AsyncStorage.setItem(PRESENTATION_MODE_STORAGE_KEY, String(next))
      .catch(() => undefined);
    return next;
  }, [presentationMode]);

  const presentationModeValue = useMemo<PresentationModeContextValue>(() => ({
    active: presentationMode,
    blurDates: presentationBlurDates,
    toggle: togglePresentationMode
  }), [presentationBlurDates, presentationMode, togglePresentationMode]);

  const toggleMainPresentationMode = useCallback(() => {
    const enabled = togglePresentationMode();
    setAppToast(
      enabled ? 'Режим презентации включён' : 'Режим презентации выключен'
    );
  }, [togglePresentationMode]);

  useEffect(() => {
    if (!directory || previewWarmupPhotos.length === 0) return;
    let active = true;
    const warmup = createProximityWarmup(
      previewWarmupPhotos,
      previewCacheKey,
      completedPreviewUris.keys()
    );
    activePreviewWarmup = warmup;
    void enqueuePreviewWarmup(() => prewarmItems(previewWarmupPhotos, async (photo) => {
      await ensurePreviewUri(photo, BACKGROUND_PREVIEW_PRIORITY);
    }, {
      concurrency: 1,
      shouldContinue: () => active,
      takeNext: warmup.takeNext
    })).catch(() => undefined);
    return () => {
      active = false;
      if (activePreviewWarmup === warmup) activePreviewWarmup = null;
    };
  }, [directory?.uri, previewWarmupPhotos]);

  const changeCalendarFocus = useCallback((focus: CalendarFocus) => {
    setCalendarFocus(focus);
    setAppToast(`Режим календаря: ${CALENDAR_FOCUSES.find((item) => item.focus === focus)?.label || focus}`);
    setViewMonth((current) => {
      if (focus === 'week') return new Date();
      if (focus === 'year') return new Date(current.getFullYear(), 0, 1);
      if (focus === 'month') return new Date(current.getFullYear(), current.getMonth(), 1);
      return current;
    });
  }, []);

  const firstPhotoDate = useMemo(
    () => dateFromKey(index.dates[0] || ''),
    [index.dates]
  );

  const shiftCalendar = useCallback((amount: number) => {
    setViewMonth((current) => {
      if (calendarFocus === 'years' || !firstPhotoDate) return current;
      return calendarMoveTarget(
        current,
        calendarFocus as CalendarRangeFocus,
        amount,
        firstPhotoDate,
        new Date()
      ) || current;
    });
  }, [calendarFocus, firstPhotoDate]);

  const canShiftCalendar = useCallback((amount: number) => (
    calendarFocus !== 'years'
    && Boolean(firstPhotoDate && calendarMoveTarget(
      viewMonth,
      calendarFocus as CalendarRangeFocus,
      amount,
      firstPhotoDate,
      new Date()
    ))
  ), [calendarFocus, firstPhotoDate, viewMonth]);

  const canShiftCalendarBackward = canShiftCalendar(-1);
  const canShiftCalendarForward = canShiftCalendar(1);

  const showToday = useCallback(() => {
    setViewMonth(new Date());
    if (calendarFocus === 'years') setCalendarFocus('month');
    setAppToast('Открыта сегодняшняя дата');
  }, [calendarFocus]);

  const calendarSwipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      calendarFocus !== 'years' && isHorizontalSwipeIntent(gesture.dx, gesture.dy)
    ),
    onMoveShouldSetPanResponderCapture: (_, gesture) => (
      calendarFocus !== 'years' && isHorizontalSwipeIntent(gesture.dx, gesture.dy)
    ),
    onPanResponderRelease: (_, gesture) => {
      const amount = horizontalPageShift(gesture.dx, gesture.dy, gesture.vx);
      if (amount) shiftCalendar(amount);
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => undefined
  }), [calendarFocus, shiftCalendar]);

  const scanDirectory = useCallback(async (nextDirectory: ArchiveDirectory) => {
    setDirectory(nextDirectory);
    setBusy(true);
    setError('');
    setScanProgress({ foundPhotos: 0, phase: 'starting', photos: [], scannedItems: 0 });
    let hasCachedIndex = false;
    const incrementalPhotos: ArchivePhoto[] = [];
    let publishedPhotoCount = 0;
    const progressSubscription = PhotoArchive.addListener('onScanProgress', (progress) => {
      setScanProgress(progress);
      if (progress.photos.length > 0) {
        incrementalPhotos.push(...progress.photos);
        const shouldPublish = publishedPhotoCount === 0
          || incrementalPhotos.length - publishedPhotoCount >= 100;
        if (!hasCachedIndex && shouldPublish) {
          const nextIncrementalPhotos = [...incrementalPhotos];
          publishedPhotoCount = nextIncrementalPhotos.length;
          setPhotos(nextIncrementalPhotos);
          if (publishedPhotoCount === progress.photos.length) {
            showLatestPhotoMonth(nextIncrementalPhotos, setViewMonth);
          }
          setBusy(false);
        }
      }
    });
    try {
      const metadataPromise = PhotoArchive.getViewerMetadata().catch(() => EMPTY_VIEWER_METADATA);
      const preferredPathsPromise = readPreferredPaths(nextDirectory.uri);
      const cachedPhotos = await PhotoArchive.getCachedPhotos();
      hasCachedIndex = cachedPhotos !== null;
      if (cachedPhotos !== null) {
        setPhotos(cachedPhotos);
        showLatestPhotoMonth(cachedPhotos, setViewMonth);
        setBusy(false);
      } else {
        setPhotos([]);
      }
      const [metadata, storedPreferredPaths] = await Promise.all([
        metadataPromise,
        preferredPathsPromise
      ]);
      setViewerMetadata(normalizeViewerMetadata(metadata));
      setPreferredPaths(storedPreferredPaths);
      const nextPhotos = await PhotoArchive.listPhotos();
      setPhotos(nextPhotos);
      showLatestPhotoMonth(nextPhotos, setViewMonth);
      return true;
    } catch (scanError) {
      if (!hasCachedIndex) setPhotos([]);
      setError(errorMessage(scanError));
      return false;
    } finally {
      progressSubscription.remove();
      setBusy(false);
      setScanProgress(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    PhotoArchive.getDirectory()
      .then((savedDirectory) => {
        if (!active) return;
        if (savedDirectory) return scanDirectory(savedDirectory);
        setBusy(false);
      })
      .catch((restoreError) => {
        if (!active) return;
        setError(errorMessage(restoreError));
        setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [scanDirectory]);

  const chooseDirectory = useCallback(async () => {
    setError('');
    try {
      const selected = await PhotoArchive.selectDirectory();
      if (selected && await scanDirectory(selected)) setAppToast('Папка подключена');
    } catch (pickerError) {
      setError(errorMessage(pickerError));
    }
  }, [scanDirectory]);

  return (
    <PresentationModeContext.Provider value={presentationModeValue}>
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Text style={styles.title}>Фото дня</Text>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel={presentationMode
              ? 'Выключить режим презентации'
              : 'Включить режим презентации'}
            accessibilityRole="button"
            accessibilityState={{ selected: presentationMode }}
            onPress={toggleMainPresentationMode}
            style={({ pressed }) => [
              styles.iconButton,
              presentationMode && styles.iconButtonActive,
              pressed && styles.pressed
            ]}
          >
            <MobileIcon
              color={presentationMode ? palette.onAccent : palette.text}
              name="presentation"
              size={20}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            accessibilityRole="button"
            accessibilityState={{ checked: theme === 'dark' }}
            disabled={!themeLoaded}
            onPress={toggleTheme}
            style={({ pressed }) => [
              styles.iconButton,
              !themeLoaded && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <MobileIcon color={palette.text} name="theme" size={20} />
          </Pressable>
        {directory ? (
          <Pressable
            accessibilityLabel="Выбрать другую папку"
            accessibilityRole="button"
            disabled={Boolean(scanProgress)}
            onPress={chooseDirectory}
            style={({ pressed }) => [
              styles.iconButton,
              scanProgress && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <MobileIcon color={palette.text} name="folder" />
          </Pressable>
        ) : null}
        </View>
      </View>

      {busy ? (
        <LoadingState
          progress={scanProgress}
          styles={styles}
        />
      ) : !directory ? (
        <WelcomeState error={error} styles={styles} onChoose={chooseDirectory} />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            appMode === 'map' && styles.mapContent,
            screenCalendar && styles.screenCalendarContent
          ]}
          scrollEnabled={appMode !== 'map' && !screenCalendar}
          style={styles.mainContent}
        >
          {scanProgress ? (
            <ScanStatus
              progress={scanProgress}
              styles={styles}
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View accessibilityRole="tablist" style={styles.appModeTabs}>
            {([
              { icon: 'calendar', label: 'Календарь', mode: 'calendar' },
              { icon: 'map', label: 'Карта', mode: 'map' }
            ] as Array<{ icon: MobileIconName; label: string; mode: AppMode }>).map(({ icon, label, mode }) => {
              const active = appMode === mode;
              return (
                <Pressable
                  accessibilityLabel={label}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={mode}
                  onPress={() => {
                    setAppMode(mode);
                    setAppToast(`Режим: ${label}`);
                  }}
                  style={({ pressed }) => [
                    styles.appModeButton,
                    active && styles.appModeButtonActive,
                    pressed && styles.pressed
                  ]}
                >
                  <MobileIcon
                    color={active ? palette.onAccent : palette.muted}
                    name={icon}
                    size={20}
                  />
                  <Text style={[styles.appModeText, active && styles.appModeTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {appMode === 'calendar' ? <>
          <View accessibilityRole="tablist" style={styles.calendarFocus}>
            {CALENDAR_FOCUSES.map(({ focus, icon, label }) => {
              const active = calendarFocus === focus;
              return (
                <Pressable
                  accessibilityLabel={label}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={focus}
                  onPress={() => changeCalendarFocus(focus)}
                  style={({ pressed }) => [
                    styles.calendarFocusButton,
                    active && styles.calendarFocusButtonActive,
                    pressed && styles.pressed
                  ]}
                >
                  <MobileIcon
                    color={active ? palette.onAccent : palette.muted}
                    name={icon}
                    size={19}
                  />
                  <Text style={[
                    styles.calendarFocusText,
                    active && styles.calendarFocusTextActive
                  ]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View
            {...calendarSwipe.panHandlers}
            style={[
              styles.calendarCard,
              screenCalendar && styles.screenCalendarCard
            ]}
          >
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityLabel={calendarNavigationLabel(calendarFocus, -1)}
                disabled={!canShiftCalendarBackward}
                onPress={() => shiftCalendar(-1)}
                style={({ pressed }) => [
                  styles.monthButton,
                  !canShiftCalendarBackward && styles.invisible,
                  pressed && styles.pressed
                ]}
              >
                <MobileIcon color={palette.text} name="previous" size={28} />
              </Pressable>
              <View style={styles.monthHeading}>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={1}
                  style={styles.monthTitle}
                >
                  {calendarTitle(calendarFocus, viewMonth)}
                </Text>
                <Pressable
                  accessibilityLabel="Перейти к сегодняшней дате"
                  accessibilityRole="button"
                  onPress={showToday}
                  style={({ pressed }) => [
                    styles.todayButton,
                    pressed && styles.pressed
                  ]}
                >
                  <MobileIcon color={palette.text} name="today" size={15} />
                  <Text style={styles.todayButtonText}>Сегодня</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityLabel={calendarNavigationLabel(calendarFocus, 1)}
                disabled={!canShiftCalendarForward}
                onPress={() => shiftCalendar(1)}
                style={({ pressed }) => [
                  styles.monthButton,
                  !canShiftCalendarForward && styles.invisible,
                  pressed && styles.pressed
                ]}
              >
                <MobileIcon color={palette.text} name="next" size={28} />
              </Pressable>
            </View>

            {calendarFocus === 'month' ? (
              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((weekday) => (
                  <Text key={weekday} style={styles.weekday}>{weekday}</Text>
                ))}
              </View>
            ) : null}

            {calendarFocus === 'years' ? (
              <YearsCalendar
                onSelectYear={(year) => {
                  setViewMonth(new Date(year, 0, 1));
                  setCalendarFocus('year');
                }}
                styles={styles}
                years={archiveYears}
              />
            ) : calendarFocus === 'year' ? (
              <YearCalendar
                onSelectMonth={(month) => {
                  setViewMonth(new Date(viewMonth.getFullYear(), month, 1));
                  setCalendarFocus('month');
                }}
                styles={styles}
                summary={visibleYear}
                year={viewMonth.getFullYear()}
              />
            ) : (
              <DaysCalendar
                cells={calendarFocus === 'week' ? [week] : weeks}
                index={index}
                onSelectDate={(date) => setViewerSelection({ date })}
                styles={styles}
                weekMode={calendarFocus === 'week'}
              />
            )}
          </View>

          {index.dates.length === 0 ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>В папке пока нет доступных фотографий</Text>
              <Text style={styles.noticeText}>
                Поддерживаются JPEG, PNG, HEIC, WebP, GIF, AVIF, TIFF и BMP. Дата берётся из пути,
                например 2024/08/15.jpg, либо из даты изменения файла.
              </Text>
            </View>
          ) : null}
          </> : (
            <ArchiveMapMode
              groups={mapGroups}
              onSelectPhoto={(photo) => setViewerSelection({
                date: photo.date,
                relativePath: photo.relativePath
              })}
              palette={palette}
              photoCount={mapPhotoCount}
              styles={styles}
            />
          )}
        </ScrollView>
      )}

      {viewerSelection ? (
        <PhotoViewer
          date={viewerSelection.date}
          directoryUri={directory?.uri || ''}
          initialRelativePath={viewerSelection.relativePath}
          metadata={viewerMetadata}
          onClose={() => setViewerSelection(null)}
          onMetadataChange={setViewerMetadata}
          onPhotosChange={setPhotos}
          onPreferredPathsChange={setPreferredPaths}
          palette={palette}
          photos={viewerPhotos}
          preferredPaths={preferredPaths}
        />
      ) : null}
      {appToast && !viewerSelection ? <MobileToast message={appToast} /> : null}
    </SafeAreaView>
    </PresentationModeContext.Provider>
  );
}

function LoadingState({
  progress,
  styles
}: {
  progress: ArchiveScanProgress | null;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.centeredState}>
      <ActivityIndicator color={styles.loadingSpinner.color} size="large" />
      <Text style={styles.loadingTitle}>{scanProgressTitle(progress)}</Text>
      {progress ? (
        <ScanProgressBar
          progress={progress}
          styles={styles}
        />
      ) : null}
      <Text style={styles.loadingText}>Файлы остаются в выбранной папке и никуда не отправляются.</Text>
    </View>
  );
}

function ScanStatus({
  progress,
  styles
}: {
  progress: ArchiveScanProgress;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.scanStatus}>
      <View style={styles.scanStatusHeader}>
        <ActivityIndicator color={styles.loadingSpinner.color} size="small" />
        <Text style={styles.scanStatusText}>{scanProgressTitle(progress, true)}</Text>
        <Text style={styles.scanStatusCount}>{progress.foundPhotos.toLocaleString('ru-RU')} фото</Text>
      </View>
      <ScanProgressBar
        compact
        progress={progress}
        styles={styles}
      />
    </View>
  );
}

function ScanProgressBar({
  compact = false,
  progress,
  styles
}: {
  compact?: boolean;
  progress: ArchiveScanProgress;
  styles: ReturnType<typeof createStyles>;
}) {
  const totalItems = progress.totalItems || 0;
  const ratio = scanProgressRatio(progress);
  const width = `${Math.max(0, ratio || 0) * 100}%` as `${number}%`;

  return (
    <View style={[styles.progressBlock, compact && styles.progressBlockCompact]}>
      {ratio === null ? (
        <View
          accessibilityLabel="Считаем объекты архива"
          style={[styles.progressTrack, styles.progressTrackPlaceholder]}
        />
      ) : (
        <View
          accessibilityLabel={`Обработано объектов: ${progress.scannedItems} из ${totalItems}`}
          accessibilityRole="progressbar"
          accessibilityValue={{
            max: Math.max(1, totalItems),
            min: 0,
            now: progress.scannedItems
          }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width }]} />
        </View>
      )}
      {!compact ? (
        <Text style={styles.progressText}>
          {scanProgressDescription(progress)}
        </Text>
      ) : null}
    </View>
  );
}

function CalendarPhoto({
  day,
  label,
  photo,
  styles,
  variantCount,
  weekMode = false
}: {
  day: number;
  label?: string;
  photo: IndexedPhoto;
  styles: ReturnType<typeof createStyles>;
  variantCount: number;
  weekMode?: boolean;
}) {
  const preview = usePreviewResource(photo);
  const { active: presentationMode, blurDates } = useContext(PresentationModeContext);
  const presentationBlurred = isPresentationPhotoBlurred(
    presentationMode,
    blurDates,
    photo.date
  );

  return (
    <ImageBackground
      blurRadius={presentationBlurred ? 22 : 0}
      imageStyle={[
        styles.dayImage,
        presentationBlurred && styles.presentationBlurredImage
      ]}
      resizeMode="cover"
      onError={preview.onError}
      source={preview.uri ? { uri: preview.uri } : undefined}
      style={[
        styles.dayImageBackground,
        weekMode && styles.weekDayImageBackground,
        !preview.uri && styles.dayImagePlaceholder
      ]}
    >
      <View style={styles.dayShade} />
      <Text style={[styles.photoDayNumber, weekMode && styles.weekDayLabel]}>
        {label || day}
      </Text>
      {variantCount > 1 ? <Text style={styles.variantBadge}>{variantCount}</Text> : null}
    </ImageBackground>
  );
}

function DaysCalendar({
  cells,
  index,
  onSelectDate,
  styles,
  weekMode
}: {
  cells: CalendarCell[][];
  index: PhotoIndex;
  onSelectDate: (date: string) => void;
  styles: ReturnType<typeof createStyles>;
  weekMode: boolean;
}) {
  return (
    <View style={[styles.calendarGrid, weekMode && styles.weekCalendarGrid]}>
      {cells.map((row) => (
        <View
          key={row[0].date}
          style={[styles.calendarWeek, weekMode && styles.weekCalendarRows]}
        >
          {row.map((cell) => {
            const variants = index.byDate.get(cell.date) || [];
            const photo = variants[0];
            const parsedDate = dateFromKey(cell.date);
            const weekLabel = parsedDate
              ? capitalize(WEEK_DAY_FORMATTER.format(parsedDate))
              : cell.date;
            return (
              <Pressable
                accessibilityLabel={dayAccessibilityLabel(cell.date, variants.length)}
                accessibilityRole={photo ? 'button' : 'text'}
                disabled={!photo}
                key={cell.date}
                onPress={() => onSelectDate(cell.date)}
                style={({ pressed }) => [
                  styles.dayCell,
                  weekMode && styles.weekDayCell,
                  !weekMode && !cell.inMonth && styles.outsideMonth,
                  pressed && styles.pressed
                ]}
              >
                {photo ? (
                  <CalendarPhoto
                    day={cell.day}
                    label={weekMode ? weekLabel : undefined}
                    photo={photo}
                    styles={styles}
                    variantCount={variants.length}
                    weekMode={weekMode}
                  />
                ) : (
                  <View style={[styles.emptyDay, weekMode && styles.weekEmptyDay]}>
                    <Text style={[
                      styles.emptyDayNumber,
                      weekMode && styles.weekEmptyDayNumber
                    ]}>
                      {weekMode ? weekLabel : cell.day}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function YearsCalendar({
  onSelectYear,
  styles,
  years
}: {
  onSelectYear: (year: number) => void;
  styles: ReturnType<typeof createStyles>;
  years: ArchiveYearSummary[];
}) {
  if (years.length === 0) return <Text style={styles.periodEmpty}>Нет распознанных лет</Text>;
  return (
    <View style={styles.periodGrid}>
      {years.map((summary) => (
        <PeriodPhotoCard
          accessibilityLabel={`${summary.year} год, фотографий: ${summary.photoCount}`}
          key={summary.year}
          label="Фото года"
          onPress={() => onSelectYear(summary.year)}
          photo={summary.photo}
          styles={styles}
          title={String(summary.year)}
        />
      ))}
    </View>
  );
}

function YearCalendar({
  onSelectMonth,
  styles,
  summary,
  year
}: {
  onSelectMonth: (month: number) => void;
  styles: ReturnType<typeof createStyles>;
  summary?: ArchiveYearSummary;
  year: number;
}) {
  const months = summary?.months || Array.from({ length: 12 }, (_, month) => ({
    month,
    photoCount: 0
  }));
  return (
    <View style={styles.periodGrid}>
      {months.map((month) => (
        <MonthCard
          key={month.month}
          month={month}
          onPress={() => onSelectMonth(month.month)}
          styles={styles}
          year={year}
        />
      ))}
    </View>
  );
}

function MonthCard({
  month,
  onPress,
  styles,
  year
}: {
  month: ArchiveMonthSummary;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  year: number;
}) {
  return (
    <PeriodPhotoCard
      accessibilityLabel={`${MONTH_NAME_FORMATTER.format(new Date(year, month.month, 1))} ${year}, фотографий: ${month.photoCount}`}
      label={month.photoCount ? `${month.photoCount} фото` : 'Нет фото'}
      onPress={onPress}
      photo={month.photo}
      styles={styles}
      title={capitalize(MONTH_NAME_FORMATTER.format(new Date(year, month.month, 1)))}
    />
  );
}

function PeriodPhotoCard({
  accessibilityLabel,
  label,
  onPress,
  photo,
  styles,
  title
}: {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
  photo?: IndexedPhoto;
  styles: ReturnType<typeof createStyles>;
  title: string;
}) {
  const preview = usePreviewResource(photo);
  const { active: presentationMode, blurDates } = useContext(PresentationModeContext);
  const presentationBlurred = Boolean(photo && isPresentationPhotoBlurred(
    presentationMode,
    blurDates,
    photo.date
  ));
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.periodCard, pressed && styles.pressed]}
    >
      {preview.uri ? (
        <Image
          blurRadius={presentationBlurred ? 22 : 0}
          onError={preview.onError}
          resizeMode="cover"
          source={{ uri: preview.uri }}
          style={[
            styles.periodImage,
            presentationBlurred && styles.presentationBlurredImage
          ]}
        />
      ) : null}
      <View style={[styles.periodShade, !preview.uri && styles.periodShadeEmpty]} />
      <View style={styles.periodCopy}>
        <Text
          numberOfLines={1}
          style={[styles.periodTitle, !preview.uri && styles.periodTitleEmpty]}
        >
          {title}
        </Text>
        <Text style={[styles.periodMeta, !preview.uri && styles.periodMetaEmpty]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function WelcomeState({
  error,
  onChoose,
  styles
}: {
  error: string;
  onChoose: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.welcomeWrap}>
      <View style={styles.welcomeArtwork}>
        <Text style={styles.welcomeMonth}>АВГ</Text>
        <Text style={styles.welcomeDay}>12</Text>
        <View style={styles.welcomeSun} />
      </View>
      <Text style={styles.welcomeTitle}>Вся жизнь — по дням</Text>
      <Text style={styles.welcomeText}>
        Выберите папку с фотографиями. Приложение прочитает её без копирования и соберёт календарь.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityLabel={Platform.OS === 'ios' ? 'Выбрать папку в Файлах' : 'Выбрать папку'}
        accessibilityRole="button"
        onPress={onChoose}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <MobileIcon color={styles.primaryButtonText.color} name="folder" size={22} />
        <Text style={styles.primaryButtonText}>
          {Platform.OS === 'ios' ? 'Выбрать папку в «Файлах»' : 'Выбрать папку'}
        </Text>
      </Pressable>
      <View style={styles.platformHint}>
        <Text style={styles.platformHintTitle}>
          {Platform.OS === 'ios' ? 'iCloud Drive поддерживается' : 'Системные хранилища поддерживаются'}
        </Text>
        <Text style={styles.platformHintText}>
          {Platform.OS === 'ios'
            ? 'В системном окне откройте iCloud Drive и выберите папку архива. Доступ сохранится между запусками.'
            : 'Используется системный Document Provider: локальная память, SD-карта и подключённые облачные сервисы.'}
        </Text>
      </View>
    </View>
  );
}

function PhotoViewer({
  date,
  directoryUri,
  initialRelativePath,
  metadata,
  onClose,
  onMetadataChange,
  onPhotosChange,
  onPreferredPathsChange,
  palette,
  photos,
  preferredPaths
}: {
  date: string;
  directoryUri: string;
  initialRelativePath?: string;
  metadata: ArchiveViewerMetadata;
  onClose: () => void;
  onMetadataChange: (value: ArchiveViewerMetadata) => void;
  onPhotosChange: (value: ArchivePhoto[]) => void;
  onPreferredPathsChange: (value: Record<string, string>) => void;
  palette: Palette;
  photos: IndexedPhoto[];
  preferredPaths: Record<string, string>;
}) {
  const { height, width } = useWindowDimensions();
  const { active: presentationMode, blurDates } = useContext(PresentationModeContext);
  const exactIndex = initialRelativePath
    ? photos.findIndex((photo) => photo.relativePath === initialRelativePath)
    : -1;
  const preferredPath = preferredPaths[date];
  const preferredIndex = photos.findIndex((photo) => (
    photo.date === date && (!preferredPath || photo.relativePath === preferredPath)
  ));
  const firstDateIndex = photos.findIndex((photo) => photo.date === date);
  const initialIndex = Math.max(
    0,
    exactIndex >= 0 ? exactIndex : preferredIndex >= 0 ? preferredIndex : firstDateIndex
  );
  const [activePhotoUri, setActivePhotoUri] = useState(photos[initialIndex]?.uri || '');
  const [panel, setPanel] = useState<ViewerPanel>(null);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState('');
  const [dateInput, setDateInput] = useState(date);
  const [diaryDraft, setDiaryDraft] = useState(metadata.diaries[date] || '');
  const [diaryEditing, setDiaryEditing] = useState(false);
  const [locationDraft, setLocationDraft] = useState<ArchiveLocation | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<PlaceSearchResult[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [exifLocation, setExifLocation] = useState<ArchiveLocation | null>(null);
  const [viewerPinching, setViewerPinching] = useState(false);
  const viewerPinchingRef = useRef(false);
  const viewerSwipeInterruptedRef = useRef(false);
  const [photoStageHeight, setPhotoStageHeight] = useState(Math.max(280, height * 0.7));
  const [pinchOrigin, setPinchOrigin] = useState(() => ({
    x: width / 2,
    y: Math.max(280, height * 0.7) / 2
  }));
  const pinchInitialDistance = useRef(0);
  const pinchInitialPageFocalPoint = useRef<PinchFocalPoint | null>(null);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const pinchTranslateX = useRef(new Animated.Value(0)).current;
  const pinchTranslateY = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<IndexedPhoto>>(null);
  const activeIndex = Math.max(0, photos.findIndex((photo) => photo.uri === activePhotoUri));
  const activePhoto = photos[activeIndex] || photos[initialIndex];
  const viewerPresentationBlurred = Boolean(activePhoto && isPresentationPhotoBlurred(
    presentationMode,
    blurDates,
    activePhoto.date
  ));
  const viewerDateLabel = formatViewerDate(activePhoto?.date || date);
  const dayPhotos = activePhoto
    ? photos.filter((photo) => photo.date === activePhoto.date)
    : [];
  const diary = activePhoto ? metadata.diaries[activePhoto.date] : '';
  const location = activePhoto ? metadata.locations[activePhoto.relativePath] : undefined;
  const viewerLocation = resolvePhotoLocation(location, exifLocation);
  const monthPeriod = activePhoto?.date.slice(0, 7) || '';
  const yearPeriod = activePhoto?.date.slice(0, 4) || '';
  const isMonthHighlight = Boolean(activePhoto && metadata.highlights.months[monthPeriod] === activePhoto.date);
  const isYearHighlight = Boolean(activePhoto && metadata.highlights.years[yearPeriod] === activePhoto.date);
  const isBlurred = Boolean(activePhoto && metadata.blurDates.includes(activePhoto.date));

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const showViewerMessage = useCallback((message: string, toastMessage = false) => {
    if (toastMessage) {
      setStatus('');
      setToast(message);
    } else {
      setStatus(message);
    }
  }, []);

  useEffect(() => {
    if (!activePhoto) return;
    void ensurePreviewUri(activePhoto, VISIBLE_PREVIEW_PRIORITY).catch(() => undefined);
    setDateInput(activePhoto.date);
    setDiaryDraft(metadata.diaries[activePhoto.date] || '');
    setLocationDraft(metadata.locations[activePhoto.relativePath] || null);
    setLocationQuery('');
    setLocationResults([]);
    setDiaryEditing(false);
    setPanel(null);
    setStatus('');
  }, [activePhoto?.uri]);

  useEffect(() => {
    if (!activePhoto || location) {
      setExifLocation(null);
      return;
    }
    let mounted = true;
    const cacheKey = previewCacheKey(activePhoto);
    const cached = completedExifLocations.get(cacheKey);
    if (cached !== undefined || completedExifLocations.has(cacheKey)) {
      setExifLocation(cached || null);
      return () => { mounted = false; };
    }
    setExifLocation(null);
    loadPhotoExifLocation(
      PhotoArchive,
      activePhoto.uri,
      () => ensureDisplayPhotoUri(activePhoto)
    )
      .then((value) => {
        const normalized = resolvePhotoLocation(null, value);
        completedExifLocations.set(cacheKey, normalized);
        if (mounted) setExifLocation(normalized);
      });
    return () => { mounted = false; };
  }, [activePhoto?.modifiedAt, activePhoto?.uri, location]);

  const updatePreferredPhoto = useCallback(async (photo: IndexedPhoto) => {
    const next = { ...preferredPaths, [photo.date]: photo.relativePath };
    onPreferredPathsChange(next);
    await writePreferredPaths(directoryUri, next);
    showViewerMessage('Фото дня сохранено', true);
  }, [directoryUri, onPreferredPathsChange, preferredPaths, showViewerMessage]);

  const updateMetadata = useCallback(async (
    operation: () => Promise<void>,
    next: ArchiveViewerMetadata,
    message: string
  ) => {
    setWorking(true);
    setStatus('Сохраняем…');
    try {
      await operation();
      onMetadataChange(normalizeViewerMetadata(next));
      showViewerMessage(message, true);
      return true;
    } catch (viewerError) {
      setStatus(errorMessage(viewerError));
      return false;
    } finally {
      setWorking(false);
    }
  }, [onMetadataChange, showViewerMessage]);

  const saveDiary = useCallback(async (closeEditor = true) => {
    if (!activePhoto) return false;
    const previousContent = metadata.diaries[activePhoto.date] || '';
    if (!diaryDraft.trim()) {
      if (previousContent) {
        setStatus('Напишите заметку или нажмите «Удалить»');
        return false;
      }
      if (closeEditor) {
        setDiaryEditing(false);
        setPanel(null);
      }
      return true;
    }
    const content = diaryDraft;
    const next = normalizeViewerMetadata(metadata);
    next.diaries[activePhoto.date] = diaryDraft;
    const saved = await updateMetadata(
      () => PhotoArchive.saveDiary(activePhoto.date, content),
      next,
      closeEditor ? 'Заметка сохранена' : 'Автосохранено'
    );
    if (saved && closeEditor) {
      setDiaryEditing(false);
      setPanel(null);
    }
    return saved;
  }, [activePhoto, diaryDraft, metadata, updateMetadata]);

  useEffect(() => {
    if (
      panel !== 'diary'
      || !diaryEditing
      || !activePhoto
      || working
      || diaryDraft === (metadata.diaries[activePhoto.date] || '')
    ) return;
    const timer = setTimeout(() => void saveDiary(false), 10_000);
    return () => clearTimeout(timer);
  }, [activePhoto, diaryDraft, diaryEditing, metadata.diaries, panel, saveDiary, working]);

  const movePhoto = useCallback(async () => {
    if (!activePhoto) return;
    const nextDate = parseViewerDate(dateInput);
    if (!nextDate) {
      setStatus('Введите корректную дату не позднее сегодняшней');
      return;
    }
    if (nextDate === activePhoto.date) {
      setPanel(null);
      return;
    }
    setWorking(true);
    setStatus('Переносим оригинал…');
    try {
      const proposedPath = retargetPhotoPath(activePhoto.relativePath, nextDate);
      const moved = await PhotoArchive.movePhoto(
        activePhoto.uri,
        activePhoto.relativePath,
        proposedPath
      );
      const movingOnlyPhoto = dayPhotos.length === 1;
      const movingPreferredPhoto = (
        preferredPaths[activePhoto.date] || dayPhotos[0]?.relativePath
      ) === activePhoto.relativePath;
      const nextPhotos = photos.map((photo) => photo.uri === activePhoto.uri ? moved : photo);
      const nextMetadata = moveViewerMetadata(
        metadata,
        activePhoto.relativePath,
        moved.relativePath,
        activePhoto.date,
        nextDate,
        {
          moveBlurDate: movingOnlyPhoto,
          moveHighlights: movingPreferredPhoto
        }
      );
      const movedLocation = metadata.locations[activePhoto.relativePath];
      if (movedLocation) {
        await PhotoArchive.setPhotoLocation(
          activePhoto.relativePath,
          null,
          null,
          null,
          null
        );
        await PhotoArchive.setPhotoLocation(
          moved.relativePath,
          movedLocation.latitude,
          movedLocation.longitude,
          movedLocation.place || null,
          movedLocation.country || null
        );
      }
      if (movingOnlyPhoto && metadata.blurDates.includes(activePhoto.date)) {
        await PhotoArchive.setBlurred(activePhoto.date, false);
        await PhotoArchive.setBlurred(nextDate, true);
      }
      if (movingPreferredPhoto) {
        for (const scope of ['month', 'year'] as const) {
          const key = scope === 'month' ? 'months' : 'years';
          const oldPeriod = activePhoto.date.slice(0, scope === 'month' ? 7 : 4);
          if (metadata.highlights[key][oldPeriod] !== activePhoto.date) continue;
          const nextPeriod = nextDate.slice(0, scope === 'month' ? 7 : 4);
          await PhotoArchive.setHighlight(scope, oldPeriod, null);
          await PhotoArchive.setHighlight(scope, nextPeriod, nextDate);
        }
      }
      onPhotosChange(nextPhotos);
      onMetadataChange(nextMetadata);
      const nextPreferred = Object.fromEntries(Object.entries(preferredPaths).filter(([, path]) => (
        path !== activePhoto.relativePath
      )));
      if (preferredPaths[activePhoto.date] === activePhoto.relativePath) {
        nextPreferred[nextDate] = moved.relativePath;
      }
      onPreferredPathsChange(nextPreferred);
      await writePreferredPaths(directoryUri, nextPreferred);
      setActivePhotoUri(moved.uri);
      setPanel(null);
      showViewerMessage('Фотография перенесена', true);
    } catch (viewerError) {
      setStatus(errorMessage(viewerError));
    } finally {
      setWorking(false);
    }
  }, [
    activePhoto,
    dateInput,
    dayPhotos,
    directoryUri,
    metadata,
    onMetadataChange,
    onPhotosChange,
    onPreferredPathsChange,
    photos,
    preferredPaths,
    showViewerMessage
  ]);

  const saveLocation = useCallback(async () => {
    if (!activePhoto || !locationDraft) {
      setStatus('Выберите точку на карте');
      return;
    }
    const next = normalizeViewerMetadata(metadata);
    next.locations[activePhoto.relativePath] = locationDraft;
    if (await updateMetadata(
      () => PhotoArchive.setPhotoLocation(
        activePhoto.relativePath,
        locationDraft.latitude,
        locationDraft.longitude,
        locationDraft.place || null,
        locationDraft.country || null
      ),
      next,
      'Место сохранено'
    )) setPanel(null);
  }, [activePhoto, locationDraft, metadata, updateMetadata]);

  const removeLocation = useCallback(async () => {
    if (!activePhoto) return;
    const next = normalizeViewerMetadata(metadata);
    delete next.locations[activePhoto.relativePath];
    if (await updateMetadata(
      () => PhotoArchive.setPhotoLocation(activePhoto.relativePath, null, null, null, null),
      next,
      'Геометка удалена'
    )) {
      setLocationDraft(null);
      setPanel(null);
    }
  }, [activePhoto, metadata, updateMetadata]);

  const searchLocation = useCallback(async () => {
    const coordinates = parseCoordinateQuery(locationQuery);
    if (coordinates) {
      setLocationDraft(coordinates);
      setLocationResults([]);
      return;
    }
    const query = locationQuery.trim().replace(/\s+/g, ' ');
    if (query.length < 2) {
      setStatus('Введите название места или координаты');
      return;
    }
    setLocationSearching(true);
    setStatus('Ищем место…');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&accept-language=ru,en&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'ru,en;q=0.8',
          'User-Agent': 'PhotoDayMobile/0.1 (+https://github.com/polyakovin/daily-photos)'
        }
      });
      if (!response.ok) throw new Error(`Поиск места: ${response.status}`);
      const results = normalizePlaceSearchResults(await response.json());
      setLocationResults(results);
      setStatus(results.length ? '' : 'Ничего не найдено');
    } catch (searchError) {
      setStatus(errorMessage(searchError));
    } finally {
      setLocationSearching(false);
    }
  }, [locationQuery]);

  const setPeriodHighlight = useCallback(async (scope: 'month' | 'year') => {
    if (!activePhoto) return;
    const key = scope === 'month' ? 'months' : 'years';
    const period = activePhoto.date.slice(0, scope === 'month' ? 7 : 4);
    const active = metadata.highlights[key][period] === activePhoto.date;
    const next = normalizeViewerMetadata(metadata);
    if (active) delete next.highlights[key][period];
    else next.highlights[key][period] = activePhoto.date;
    await updateMetadata(
      () => PhotoArchive.setHighlight(scope, period, active ? null : activePhoto.date),
      next,
      active ? 'Отметка снята' : `Фото ${scope === 'month' ? 'месяца' : 'года'} сохранено`
    );
  }, [activePhoto, metadata, updateMetadata]);

  const setBlurred = useCallback(async (blurred: boolean) => {
    if (!activePhoto) return;
    const next = normalizeViewerMetadata(metadata);
    next.blurDates = blurred
      ? [...new Set(next.blurDates.concat(activePhoto.date))].sort()
      : next.blurDates.filter((date) => date !== activePhoto.date);
    await updateMetadata(
      () => PhotoArchive.setBlurred(activePhoto.date, blurred),
      next,
      'Настройка презентации сохранена'
    );
  }, [activePhoto, metadata, updateMetadata]);

  const confirmDeletePhoto = useCallback(() => {
    if (!activePhoto) return;
    Alert.alert(
      'Удалить фотографию?',
      'На iOS и в облачных хранилищах восстановление зависит от приложения «Файлы» и провайдера.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              await PhotoArchive.deletePhoto(activePhoto.uri, activePhoto.relativePath);
              const nextPhotos = photos.filter((photo) => photo.uri !== activePhoto.uri);
              onPhotosChange(nextPhotos);
              const nextPreferred = Object.fromEntries(Object.entries(preferredPaths).filter(([, path]) => (
                path !== activePhoto.relativePath
              )));
              onPreferredPathsChange(nextPreferred);
              await writePreferredPaths(directoryUri, nextPreferred);
              if (nextPhotos.length === 0) onClose();
              else setActivePhotoUri(nextPhotos[Math.min(activeIndex, nextPhotos.length - 1)].uri);
              showViewerMessage('Фотография удалена', true);
            } catch (viewerError) {
              setStatus(errorMessage(viewerError));
            } finally {
              setWorking(false);
            }
          }
        }
      ]
    );
  }, [
    activeIndex,
    activePhoto,
    directoryUri,
    onClose,
    onPhotosChange,
    onPreferredPathsChange,
    photos,
    preferredPaths,
    showViewerMessage
  ]);

  const confirmDeleteDiary = useCallback(() => {
    if (!activePhoto || !diary) return;
    Alert.alert(
      'Удалить заметку?',
      `Заметка за ${activePhoto.date} будет удалена из папки _diary.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            setStatus('Удаляем заметку…');
            try {
              await PhotoArchive.saveDiary(activePhoto.date, null);
              const next = normalizeViewerMetadata(metadata);
              delete next.diaries[activePhoto.date];
              onMetadataChange(next);
              setDiaryDraft('');
              setDiaryEditing(false);
              setPanel(null);
              showViewerMessage('Заметка удалена', true);
            } catch (viewerError) {
              setStatus(errorMessage(viewerError));
            } finally {
              setWorking(false);
            }
          }
        }
      ]
    );
  }, [activePhoto, diary, metadata, onMetadataChange, showViewerMessage]);

  const persistDiaryDraft = useCallback(async () => {
    if (
      panel !== 'diary'
      || !diaryEditing
      || !activePhoto
      || diaryDraft === (metadata.diaries[activePhoto.date] || '')
    ) return true;
    return saveDiary(false);
  }, [activePhoto, diaryDraft, diaryEditing, metadata.diaries, panel, saveDiary]);
  const closeViewer = useCallback(async () => {
    if (!await persistDiaryDraft()) return;
    onClose();
  }, [onClose, persistDiaryDraft]);

  const panelBelowPhoto = panel === 'date' || panel === 'location';
  const panelImageHeight = Math.max(280, height * 0.43);
  const handleViewerPinchChange = useCallback((pinching: boolean) => {
    viewerPinchingRef.current = pinching;
    setViewerPinching(pinching);
    if (pinching) {
      viewerSwipeInterruptedRef.current = true;
      listRef.current?.setNativeProps({ scrollEnabled: false });
      listRef.current?.scrollToOffset({
        animated: false,
        offset: activeIndex * width
      });
    }
  }, [activeIndex, width]);
  const resetViewerPinch = useCallback((animated = true) => {
    pinchInitialDistance.current = 0;
    pinchInitialPageFocalPoint.current = null;
    pinchScale.stopAnimation();
    pinchTranslateX.stopAnimation();
    pinchTranslateY.stopAnimation();
    if (!animated) {
      pinchScale.setValue(1);
      pinchTranslateX.setValue(0);
      pinchTranslateY.setValue(0);
      setPinchOrigin({ x: width / 2, y: photoStageHeight / 2 });
      return;
    }
    Animated.parallel([
      Animated.spring(pinchScale, {
        bounciness: 0,
        speed: 24,
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.spring(pinchTranslateX, {
        bounciness: 0,
        speed: 24,
        toValue: 0,
        useNativeDriver: true
      }),
      Animated.spring(pinchTranslateY, {
        bounciness: 0,
        speed: 24,
        toValue: 0,
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) setPinchOrigin({ x: width / 2, y: photoStageHeight / 2 });
    });
  }, [photoStageHeight, pinchScale, pinchTranslateX, pinchTranslateY, width]);
  const finishViewerPinch = useCallback(() => {
    resetViewerPinch();
    handleViewerPinchChange(false);
  }, [handleViewerPinchChange, resetViewerPinch]);
  const viewerPinchResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event) => shouldStartPinch(
      event.nativeEvent.touches,
      !panel && !viewerPresentationBlurred
    ),
    onMoveShouldSetPanResponderCapture: (event) => shouldStartPinch(
      event.nativeEvent.touches,
      !panel && !viewerPresentationBlurred
    ),
    onPanResponderEnd: (event) => {
      if (event.nativeEvent.touches.length < 2 && pinchInitialDistance.current) {
        resetViewerPinch();
      }
      if (event.nativeEvent.touches.length === 0) handleViewerPinchChange(false);
    },
    onPanResponderGrant: (event) => {
      pinchScale.stopAnimation();
      pinchTranslateX.stopAnimation();
      pinchTranslateY.stopAnimation();
      pinchScale.setValue(1);
      pinchTranslateX.setValue(0);
      pinchTranslateY.setValue(0);
      pinchInitialDistance.current = pinchDistance(event.nativeEvent.touches) || 0;
      const localFocalPoint = pinchFocalPoint(event.nativeEvent.touches);
      pinchInitialPageFocalPoint.current = pinchPageFocalPoint(event.nativeEvent.touches);
      if (localFocalPoint) setPinchOrigin(localFocalPoint);
      handleViewerPinchChange(true);
    },
    onPanResponderMove: (event) => {
      if (event.nativeEvent.touches.length < 2) {
        if (pinchInitialDistance.current) resetViewerPinch();
        return;
      }
      const distance = pinchDistance(event.nativeEvent.touches);
      if (!distance || !pinchInitialDistance.current) return;
      pinchScale.setValue(transientPinchScale(distance, pinchInitialDistance.current));
      const translation = pinchTranslation(
        pinchInitialPageFocalPoint.current,
        pinchPageFocalPoint(event.nativeEvent.touches)
      );
      pinchTranslateX.setValue(translation.x);
      pinchTranslateY.setValue(translation.y);
    },
    onPanResponderRelease: finishViewerPinch,
    onPanResponderTerminate: finishViewerPinch,
    onPanResponderTerminationRequest: () => false,
    onStartShouldSetPanResponder: (event) => shouldStartPinch(
      event.nativeEvent.touches,
      !panel && !viewerPresentationBlurred
    ),
    onStartShouldSetPanResponderCapture: (event) => shouldStartPinch(
      event.nativeEvent.touches,
      !panel && !viewerPresentationBlurred
    )
  }), [
    finishViewerPinch,
    handleViewerPinchChange,
    panel,
    pinchScale,
    pinchTranslateX,
    pinchTranslateY,
    resetViewerPinch,
    viewerPresentationBlurred
  ]);

  useEffect(() => {
    resetViewerPinch(false);
    handleViewerPinchChange(false);
  }, [activePhoto?.uri, panel, viewerPresentationBlurred]);
  return (
    <Modal animationType="fade" onRequestClose={() => void closeViewer()} visible>
      <SafeAreaView style={viewerStyles.safeArea}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={viewerStyles.content}
        >
          <View
            {...viewerPinchResponder.panHandlers}
            onLayout={(event) => {
              const nextHeight = Math.round(event.nativeEvent.layout.height);
              if (nextHeight > 0 && nextHeight !== photoStageHeight) {
                setPhotoStageHeight(nextHeight);
              }
            }}
            style={[
              viewerStyles.photoStage,
              panelBelowPhoto
                ? { height: panelImageHeight }
                : viewerStyles.photoStageCentered
            ]}
          >
            <FlatList
              ref={listRef}
              data={photos}
              decelerationRate="fast"
              disableIntervalMomentum
              getItemLayout={(_, index) => ({ index, length: width, offset: width * index })}
              horizontal
              initialNumToRender={1}
              initialScrollIndex={initialIndex}
              keyExtractor={(photo) => photo.uri}
              maxToRenderPerBatch={3}
              onMomentumScrollEnd={(event) => {
                if (viewerPinchingRef.current || viewerSwipeInterruptedRef.current) {
                  listRef.current?.scrollToOffset({
                    animated: false,
                    offset: activeIndex * width
                  });
                  return;
                }
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
                const boundedIndex = Math.max(0, Math.min(photos.length - 1, nextIndex));
                setActivePhotoUri(photos[boundedIndex]?.uri || '');
              }}
              onScrollBeginDrag={() => {
                if (!viewerPinchingRef.current) viewerSwipeInterruptedRef.current = false;
              }}
              pagingEnabled
              scrollEnabled={!panel && !viewerPinching}
              renderItem={({ index, item }) => (
                <ViewerPhoto
                  active={index === activeIndex}
                  height={photoStageHeight}
                  pinchOrigin={pinchOrigin}
                  pinchScale={pinchScale}
                  pinchTranslateX={pinchTranslateX}
                  pinchTranslateY={pinchTranslateY}
                  photo={item}
                  width={width}
                />
              )}
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              snapToInterval={width}
              style={viewerStyles.list}
              windowSize={3}
            />
            <View pointerEvents="box-none" style={viewerStyles.photoOverlay}>
              {!panel && viewerLocation ? (
                <Pressable
                  accessibilityLabel={location
                    ? 'Открыть карту сохранённого места фотографии'
                    : 'Открыть карту места фотографии из EXIF'}
                  accessibilityRole="button"
                  onPress={() => setPanel('map')}
                  style={({ pressed }) => [
                    viewerStyles.miniMapOverlay,
                    pressed && viewerStyles.miniMapOverlayPressed
                  ]}
                >
                  <ViewerMiniMap
                    location={viewerLocation}
                    palette={palette}
                  />
                </Pressable>
              ) : null}
              {!panel ? (
                <View pointerEvents="box-none" style={viewerStyles.photoCloseButton}>
                  <ViewerGlassButton
                    icon="close"
                    label="Закрыть фотографию"
                    onPress={() => void closeViewer()}
                  />
                </View>
              ) : null}
              {!panel ? (
                <View pointerEvents="box-none" style={viewerStyles.photoBottomBar}>
                  {dayPhotos.length > 1 ? (
                    <ScrollView
                      contentContainerStyle={viewerStyles.photoAlternatives}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {dayPhotos.map((photo, index) => {
                        const current = photo.uri === activePhoto?.uri;
                        const preferred = preferredPaths[photo.date] === photo.relativePath
                          || (!preferredPaths[photo.date] && index === 0);
                        return (
                          <ViewerAlternative
                            current={current}
                            key={photo.uri}
                            onPress={() => {
                              const nextIndex = photos.findIndex((item) => item.uri === photo.uri);
                              if (nextIndex >= 0) {
                                listRef.current?.scrollToIndex({ animated: true, index: nextIndex });
                                setActivePhotoUri(photo.uri);
                              }
                              void updatePreferredPhoto(photo);
                            }}
                            photo={photo}
                            preferred={preferred}
                          />
                        );
                      })}
                    </ScrollView>
                  ) : null}
                  <View style={viewerStyles.photoActionRow}>
                    <ViewerGlassButton
                      active={Boolean(location)}
                      icon="location"
                      label={location ? 'Изменить место' : 'Добавить место'}
                      onPress={() => setPanel('location')}
                    />
                    <ViewerGlassButton
                      active={Boolean(diary)}
                      icon="note"
                      label={diary ? 'Показать заметку' : 'Добавить заметку'}
                      onPress={() => {
                        setDiaryEditing(!diary);
                        setPanel('diary');
                      }}
                    />
                    <ViewerGlassButton
                      active={isMonthHighlight}
                      icon={isMonthHighlight ? 'starFilled' : 'star'}
                      label={isMonthHighlight ? 'Снять отметку фото месяца' : 'Сделать фото месяца'}
                      onPress={() => void setPeriodHighlight('month')}
                    />
                    <ViewerGlassButton
                      active={isYearHighlight}
                      icon="yearHighlight"
                      label={isYearHighlight ? 'Снять отметку фото года' : 'Сделать фото года'}
                      onPress={() => void setPeriodHighlight('year')}
                    />
                    <ViewerGlassButton
                      active={isBlurred}
                      disabled={working}
                      icon="blur"
                      label={isBlurred ? 'Не блюрить в презентации' : 'Блюрить в презентации'}
                      onPress={() => void setBlurred(!isBlurred)}
                    />
                    <ViewerGlassButton
                      destructive
                      icon="trash"
                      label="Удалить фотографию"
                      onPress={confirmDeletePhoto}
                    />
                  </View>
                  <View style={viewerStyles.photoDateRow}>
                    <Pressable
                      accessibilityLabel="Изменить дату фотографии"
                      accessibilityRole="button"
                      onPress={() => setPanel('date')}
                      style={({ pressed }) => [
                        viewerStyles.dateButtonFrame,
                        pressed && viewerStyles.glassButtonPressed
                      ]}
                    >
                      <ViewerGlassSurface style={viewerStyles.dateGlass}>
                        <Text numberOfLines={1} style={viewerStyles.dateOnPhoto}>
                          {viewerDateLabel}
                        </Text>
                      </ViewerGlassSurface>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {panel === 'map' && viewerLocation ? (
                <View
                  accessibilityLabel="Карта места фотографии"
                  accessibilityViewIsModal
                  style={viewerStyles.mapOverlay}
                >
                  <ArchiveMap
                    editable={false}
                    location={viewerLocation}
                    palette={palette}
                    style={viewerStyles.mapOverlayMap}
                  />
                  <View pointerEvents="box-none" style={viewerStyles.mapOverlayClose}>
                    <ViewerGlassButton
                      icon="close"
                      label="Закрыть карту"
                      onPress={() => setPanel(null)}
                    />
                  </View>
                </View>
              ) : null}
              {panel === 'diary' ? (
                <View
                  accessibilityLabel="Заметка поверх фотографии"
                  accessibilityViewIsModal
                  style={viewerStyles.diaryOverlay}
                >
                  <ViewerGlassSurface style={viewerStyles.diaryOverlayGlass}>
                    <View />
                  </ViewerGlassSurface>
                  {diaryEditing ? (
                    <View style={viewerStyles.diaryOverlayContent}>
                      <Text style={viewerStyles.diaryOverlayTitle}>Заметка дня · Markdown</Text>
                      <TextInput
                        autoFocus={!diary}
                        maxLength={500_000}
                        multiline
                        onChangeText={setDiaryDraft}
                        placeholder="# Что запомнилось сегодня"
                        placeholderTextColor="rgba(216, 232, 222, 0.48)"
                        style={[viewerStyles.textArea, viewerStyles.diaryOverlayTextArea]}
                        value={diaryDraft}
                      />
                      {status ? (
                        <Text style={viewerStyles.diaryOverlayStatus}>{status}</Text>
                      ) : null}
                      <View style={viewerStyles.diaryOverlayActions}>
                        <ViewerGlassButton
                          icon="close"
                          label="Сохранить и закрыть заметку"
                          onPress={() => void saveDiary(true)}
                        />
                        {diary ? (
                          <ViewerGlassButton
                            destructive
                            icon="trash"
                            label="Удалить заметку"
                            onPress={confirmDeleteDiary}
                          />
                        ) : null}
                        <ViewerGlassButton
                          active
                          disabled={
                            working
                            || !diaryDraft.trim()
                            || diaryDraft === (metadata.diaries[activePhoto.date] || '')
                          }
                          icon="check"
                          label="Сохранить заметку"
                          onPress={() => void saveDiary(true)}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={viewerStyles.diaryOverlayContent}>
                      <Text style={viewerStyles.diaryOverlayTitle}>Заметка дня</Text>
                      <ScrollView
                        contentContainerStyle={viewerStyles.diaryOverlayMarkdownContent}
                        style={viewerStyles.diaryOverlayScroll}
                      >
                        <DiaryMarkdown content={diary} />
                      </ScrollView>
                      <View style={viewerStyles.diaryOverlayActions}>
                        <ViewerGlassButton
                          icon="close"
                          label="Закрыть заметку"
                          onPress={() => {
                            setDiaryEditing(false);
                            setPanel(null);
                          }}
                        />
                        <ViewerGlassButton
                          icon="edit"
                          label="Редактировать заметку"
                          onPress={() => setDiaryEditing(true)}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          </View>
          {panelBelowPhoto ? (
          <ScrollView
            contentContainerStyle={viewerStyles.controls}
            keyboardShouldPersistTaps="handled"
            style={viewerStyles.controlsScroll}
          >
          {panel === 'date' ? (
            <View style={viewerStyles.editor}>
              <Text style={viewerStyles.editorTitle}>Новая дата фотографии</Text>
              <TextInput
                autoFocus
                onChangeText={setDateInput}
                placeholder="ДД.ММ.ГГГГ"
                placeholderTextColor="rgba(216, 232, 222, 0.38)"
                style={viewerStyles.input}
                value={dateInput}
              />
              <View style={viewerStyles.editorActions}>
                <ViewerButton compact icon="close" label="Отмена" onPress={() => setPanel(null)} />
                <ViewerButton active disabled={working} icon="move" label="Перенести" onPress={() => void movePhoto()} />
              </View>
            </View>
          ) : null}

          {panel === 'location' && activePhoto ? (
            <View style={viewerStyles.editor}>
              <Text style={viewerStyles.editorTitle}>Место съёмки</Text>
              <View style={viewerStyles.searchRow}>
                <TextInput
                  onChangeText={setLocationQuery}
                  onSubmitEditing={() => void searchLocation()}
                  placeholder="Город, адрес или 55.75, 37.61"
                  placeholderTextColor="rgba(216, 232, 222, 0.38)"
                  returnKeyType="search"
                  style={[viewerStyles.input, viewerStyles.searchInput]}
                  value={locationQuery}
                />
                <ViewerButton disabled={locationSearching} icon="search" label="Найти" onPress={() => void searchLocation()} />
              </View>
              {locationResults.map((result) => (
                <Pressable
                  key={result.id}
                  onPress={() => {
                    setLocationDraft(result);
                    setLocationResults([]);
                  }}
                  style={viewerStyles.searchResult}
                >
                  <Text numberOfLines={2} style={viewerStyles.searchResultText}>{result.label}</Text>
                </Pressable>
              ))}
              <ArchiveMap
                editable
                location={locationDraft || location}
                onLocationChange={setLocationDraft}
                palette={palette}
                style={viewerStyles.map}
              />
              <Text style={viewerStyles.coordinateText}>
                {locationDraft
                  ? `${locationDraft.latitude.toFixed(5)}, ${locationDraft.longitude.toFixed(5)}`
                  : 'Нажмите на карте, чтобы поставить точку'}
              </Text>
              <Text
                accessibilityRole="link"
                onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}
                style={viewerStyles.attribution}
              >
                Поиск мест © OpenStreetMap / Nominatim
              </Text>
              <View style={viewerStyles.editorActions}>
                <ViewerButton compact icon="close" label="Отмена" onPress={() => setPanel(null)} />
                {location ? <ViewerButton compact destructive icon="trash" label="Удалить метку" onPress={() => void removeLocation()} /> : null}
                <ViewerButton active disabled={!locationDraft || working} icon="check" label="Сохранить" onPress={() => void saveLocation()} />
              </View>
            </View>
          ) : null}

          {status ? <Text style={viewerStyles.status}>{status}</Text> : null}
          </ScrollView>
          ) : null}
        </KeyboardAvoidingView>
        {toast ? <MobileToast dark message={toast} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

type ViewerPanel = 'date' | 'diary' | 'location' | 'map' | null;

function ViewerPhoto({
  active,
  height,
  pinchOrigin,
  pinchScale,
  pinchTranslateX,
  pinchTranslateY,
  photo,
  width
}: {
  active: boolean;
  height: number;
  pinchOrigin: PinchFocalPoint;
  pinchScale: Animated.Value;
  pinchTranslateX: Animated.Value;
  pinchTranslateY: Animated.Value;
  photo: IndexedPhoto;
  width: number;
}) {
  const preview = usePreviewResource(photo);
  const { active: presentationMode, blurDates } = useContext(PresentationModeContext);
  const presentationBlurred = isPresentationPhotoBlurred(
    presentationMode,
    blurDates,
    photo.date
  );
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [displayStatus, setDisplayStatus] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
  const [displayAttempt, setDisplayAttempt] = useState(0);
  const cacheKey = previewCacheKey(photo);

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    setDisplayUri(null);
    setDisplayStatus('loading');
    ensureDisplayPhotoUri(photo).then((uri) => {
      if (mounted) {
        setDisplayUri(uri);
        setDisplayStatus('loaded');
      }
    }).catch(() => {
      if (mounted) setDisplayStatus('failed');
    });
    return () => { mounted = false; };
  }, [active, cacheKey, displayAttempt]);

  const handleDisplayError = useCallback(() => {
    completedDisplayUris.delete(cacheKey);
    setDisplayUri(null);
    setDisplayStatus('failed');
  }, [cacheKey]);

  const retryPhoto = useCallback(() => {
    completedDisplayUris.delete(cacheKey);
    preview.retry();
    setDisplayUri(null);
    setDisplayStatus('loading');
    setDisplayAttempt((current) => current + 1);
  }, [cacheKey, preview.retry]);

  const photoLoading = active
    && !preview.uri
    && !displayUri
    && (preview.loading || displayStatus === 'loading');
  const photoFailed = active
    && !preview.uri
    && !displayUri
    && preview.failed
    && displayStatus === 'failed';

  return (
    <View style={[viewerStyles.photoPage, { height, width }]}>
      <Animated.View
        style={[
          viewerStyles.photo,
          active ? {
            transform: [
              { translateX: pinchTranslateX },
              { translateY: pinchTranslateY },
              { scale: pinchScale }
            ],
            transformOrigin: [pinchOrigin.x, pinchOrigin.y, 0]
          } : null
        ]}
      >
        {preview.uri ? (
          <Image
            accessibilityLabel={`Превью фотографии ${photo.name}`}
            blurRadius={presentationBlurred ? 34 : displayUri ? 0 : 0.3}
            onError={preview.onError}
            resizeMode="contain"
            source={{ uri: preview.uri }}
            style={[
              viewerStyles.photo,
              presentationBlurred && viewerStyles.presentationBlurredPhoto
            ]}
          />
        ) : null}
        {displayUri ? (
          <Image
            accessibilityLabel={`Фотография ${photo.name}`}
            blurRadius={presentationBlurred ? 34 : 0}
            onError={handleDisplayError}
            resizeMode="contain"
            source={{ uri: displayUri }}
            style={[
              viewerStyles.displayPhoto,
              presentationBlurred && viewerStyles.presentationBlurredPhoto
            ]}
          />
        ) : null}
        {photoLoading ? (
          <ActivityIndicator color="#ffffff" size="large" style={viewerStyles.photoLoader} />
        ) : null}
        {photoFailed ? (
          <View accessibilityLiveRegion="polite" style={viewerStyles.photoFailure}>
            <Text style={viewerStyles.photoFailureTitle}>Не удалось загрузить фотографию</Text>
            <Text style={viewerStyles.photoFailureText}>
              Файл может быть временно недоступен в iCloud или другом файловом хранилище.
            </Text>
            <Pressable
              accessibilityLabel="Повторить загрузку"
              accessibilityRole="button"
              onPress={retryPhoto}
              style={({ pressed }) => [
                viewerStyles.photoRetryButton,
                pressed && { opacity: 0.55 }
              ]}
            >
              <MobileIcon color="#ffffff" name="retry" size={20} />
              <Text style={viewerStyles.photoRetryText}>Повторить</Text>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function ViewerAlternative({
  current,
  onPress,
  photo,
  preferred
}: {
  current: boolean;
  onPress: () => void;
  photo: IndexedPhoto;
  preferred: boolean;
}) {
  const preview = usePreviewResource(photo);
  const { active: presentationMode, blurDates } = useContext(PresentationModeContext);
  const presentationBlurred = isPresentationPhotoBlurred(
    presentationMode,
    blurDates,
    photo.date
  );
  return (
    <Pressable
      accessibilityLabel={`${preferred ? 'Фото дня, ' : ''}${photo.name}`}
      onPress={onPress}
      style={[viewerStyles.alternative, current && viewerStyles.alternativeCurrent]}
    >
      {preview.uri ? (
        <Image
          blurRadius={presentationBlurred ? 18 : 0}
          onError={preview.onError}
          source={{ uri: preview.uri }}
          style={[
            viewerStyles.alternativeImage,
            presentationBlurred && viewerStyles.presentationBlurredPhoto
          ]}
        />
      ) : null}
      {preferred ? <Text style={viewerStyles.preferredBadge}>✓</Text> : null}
    </Pressable>
  );
}

function ViewerGlassSurface({
  active = false,
  children,
  destructive = false,
  style
}: {
  active?: boolean;
  children: ReactNode;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const surfaceStyle = [
    viewerStyles.glassSurface,
    active && viewerStyles.glassSurfaceActive,
    destructive && viewerStyles.glassSurfaceDestructive,
    style
  ];
  const tintColor = destructive
    ? 'rgba(145, 36, 36, 0.28)'
    : active
      ? 'rgba(46, 123, 88, 0.3)'
      : 'rgba(14, 20, 18, 0.16)';
  if (NativeViewerGlassView) {
    return (
      <NativeViewerGlassView
        colorScheme="dark"
        glassEffectStyle="regular"
        pointerEvents="none"
        style={surfaceStyle}
        tintColor={tintColor}
      >
        {children}
      </NativeViewerGlassView>
    );
  }
  return <View pointerEvents="none" style={surfaceStyle}>{children}</View>;
}

function ViewerGlassButton({
  active = false,
  destructive = false,
  disabled = false,
  icon,
  label,
  onPress
}: {
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  icon: MobileIconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        viewerStyles.glassButtonFrame,
        pressed && viewerStyles.glassButtonPressed
      ]}
    >
      <ViewerGlassSurface
        active={active}
        destructive={destructive}
        style={viewerStyles.glassButton}
      >
        <MobileIcon color={disabled ? '#7d8782' : '#ffffff'} name={icon} size={20} />
      </ViewerGlassSurface>
    </Pressable>
  );
}

function ViewerButton({
  active = false,
  compact = false,
  destructive = false,
  disabled = false,
  icon,
  label,
  onPress
}: {
  active?: boolean;
  compact?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  icon: MobileIconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label.replace(/[★☆✓]/g, '').trim()}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        viewerStyles.actionButton,
        compact && viewerStyles.actionButtonCompact,
        active && viewerStyles.actionButtonActive,
        destructive && viewerStyles.actionButtonDestructive,
        disabled && viewerStyles.actionButtonDisabled,
        pressed && { opacity: 0.55 }
      ]}
    >
      <MobileIcon color="#ffffff" name={icon} size={20} />
      {!compact ? <Text style={viewerStyles.actionButtonText}>{label.replace(/[★☆✓]/g, '').trim()}</Text> : null}
    </Pressable>
  );
}

function MobileToast({ dark = false, message }: { dark?: boolean; message: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[mobileToastStyles.toast, dark && mobileToastStyles.toastDark]}
    >
      <Text style={mobileToastStyles.text}>{message}</Text>
    </View>
  );
}

function DiaryMarkdown({ content }: { content: string }) {
  const source = content.replace(/\r\n?/g, '\n').replace(/^---\n[\s\S]*?\n---(?:\n|$)/, '');
  return (
    <View style={viewerStyles.markdown}>
      {source.split('\n').map((line, index) => {
        if (!line.trim()) return <View key={index} style={viewerStyles.markdownBreak} />;
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          return (
            <Text key={index} style={[
              viewerStyles.markdownText,
              heading[1].length === 1 ? viewerStyles.markdownHeading1 : viewerStyles.markdownHeading2
            ]}>
              {inlineMarkdown(heading[2], index)}
            </Text>
          );
        }
        const list = line.match(/^\s*(?:[-*+]|(\d+)\.)\s+(.+)$/);
        const text = list ? `${list[1] ? `${list[1]}.` : '•'} ${list[2]}` : line;
        return (
          <Text key={index} style={[
            viewerStyles.markdownText,
            list && viewerStyles.markdownList
          ]}>
            {inlineMarkdown(text, index)}
          </Text>
        );
      })}
    </View>
  );
}

function inlineMarkdown(value: string, line: number): ReactNode[] {
  const pattern = /(https?:\/\/[^\s]+|www\.[^\s]+|\[[^\]]+\]\(https?:\/\/[^)]+\)|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*)/gi;
  const nodes: ReactNode[] = [];
  let offset = 0;
  let sequence = 0;
  for (const match of value.matchAll(pattern)) {
    if ((match.index || 0) > offset) nodes.push(value.slice(offset, match.index));
    const token = match[0];
    const key = `${line}-${sequence += 1}`;
    const markdownLink = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/i);
    if (markdownLink) {
      nodes.push(
        <Text
          accessibilityRole="link"
          key={key}
          onPress={() => void Linking.openURL(markdownLink[2])}
          style={viewerStyles.markdownLink}
        >
          {markdownLink[1]}
        </Text>
      );
    } else if (/^(?:https?:\/\/|www\.)/i.test(token)) {
      const suffix = token.match(/[),.!?:;]+$/)?.[0] || '';
      const label = suffix ? token.slice(0, -suffix.length) : token;
      nodes.push(
        <Text
          accessibilityRole="link"
          key={key}
          onPress={() => void Linking.openURL(label.startsWith('www.') ? `https://${label}` : label)}
          style={viewerStyles.markdownLink}
        >
          {label}
        </Text>,
        suffix
      );
    } else if (token.startsWith('**')) {
      nodes.push(<Text key={key} style={viewerStyles.markdownStrong}>{token.slice(2, -2)}</Text>);
    } else if (token.startsWith('~~')) {
      nodes.push(<Text key={key} style={viewerStyles.markdownStrike}>{token.slice(2, -2)}</Text>);
    } else if (token.startsWith('`')) {
      nodes.push(<Text key={key} style={viewerStyles.markdownCode}>{token.slice(1, -1)}</Text>);
    } else {
      nodes.push(<Text key={key} style={viewerStyles.markdownEmphasis}>{token.slice(1, -1)}</Text>);
    }
    offset = (match.index || 0) + token.length;
  }
  if (offset < value.length) nodes.push(value.slice(offset));
  return nodes;
}

function ArchiveMapMode({
  groups,
  onSelectPhoto,
  palette,
  photoCount,
  styles
}: {
  groups: ArchiveMapGroup[];
  onSelectPhoto: (photo: LocatedArchivePhoto) => void;
  palette: Palette;
  photoCount: number;
  styles: ReturnType<typeof createStyles>;
}) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const selectedGroups = selectedGroupIds.flatMap((id) => {
    const group = groups.find((candidate) => candidate.id === id);
    return group ? [group] : [];
  });
  const selectedGroup: ArchiveMapGroup | null = selectedGroups.length === 0
    ? null
    : selectedGroups.length === 1
      ? selectedGroups[0]
      : {
          id: `cluster:${selectedGroups.map((group) => group.id).join('|')}`,
          label: `${selectedGroups.length.toLocaleString('ru-RU')} мест`,
          latitude: selectedGroups.reduce((sum, group) => sum + group.latitude, 0)
            / selectedGroups.length,
          longitude: selectedGroups.reduce((sum, group) => sum + group.longitude, 0)
            / selectedGroups.length,
          photos: selectedGroups.flatMap((group) => group.photos)
        };
  const html = useMemo(() => buildArchiveOverviewMapHtml(groups, palette), [groups, palette]);
  useEffect(() => {
    if (selectedGroupIds.length > selectedGroups.length) {
      setSelectedGroupIds(selectedGroups.map((group) => group.id));
    }
  }, [groups, selectedGroupIds]);
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      const ids: string[] = message.type === 'group' && typeof message.id === 'string'
        ? [message.id]
        : message.type === 'groups' && Array.isArray(message.ids)
          ? message.ids.filter((id: unknown): id is string => typeof id === 'string')
          : [];
      const nextGroups: ArchiveMapGroup[] = ids.flatMap((id) => {
        const group = groups.find((candidate) => candidate.id === id);
        return group ? [group] : [];
      });
      if (nextGroups.length === 0) return;
      const nextPhotos = nextGroups.flatMap((group) => group.photos);
      if (nextPhotos.length === 1) onSelectPhoto(nextPhotos[0]);
      else setSelectedGroupIds(nextGroups.map((group) => group.id));
    } catch {
      // Сообщения страницы с неизвестным форматом игнорируются.
    }
  }, [groups, onSelectPhoto]);

  return (
    <View style={styles.mapMode}>
      <View style={styles.mapModeHeader}>
        <View style={styles.mapModeCopy}>
          <Text style={styles.mapModeTitle}>Места съёмки</Text>
          <Text style={styles.mapModeMeta}>
            {photoCount.toLocaleString('ru-RU')} фото · {groups.length.toLocaleString('ru-RU')} мест
          </Text>
        </View>
        {selectedGroup ? (
          <Pressable
            accessibilityLabel="Закрыть фотографии места"
            onPress={() => setSelectedGroupIds([])}
            style={styles.mapCloseButton}
          >
            <MobileIcon color={palette.text} name="close" size={25} />
          </Pressable>
        ) : null}
      </View>
      {groups.length === 0 ? (
        <View style={styles.mapEmpty}>
          <Text style={styles.noticeTitle}>На карте пока нет фотографий</Text>
          <Text style={styles.noticeText}>
            Откройте фотографию и добавьте место съёмки. Геометки сохраняются вместе с архивом.
          </Text>
        </View>
      ) : (
        <>
          <WebView
            javaScriptEnabled
            nestedScrollEnabled
            onMessage={handleMessage}
            originWhitelist={['*']}
            overScrollMode="never"
            scrollEnabled={false}
            source={{ html }}
            style={styles.archiveMap}
          />
          {selectedGroup ? (
            <View style={styles.mapSelection}>
              <Text numberOfLines={1} style={styles.mapSelectionTitle}>{selectedGroup.label}</Text>
              <Text style={styles.mapSelectionMeta}>
                {selectedGroup.photos.length.toLocaleString('ru-RU')} фото · выберите снимок
              </Text>
              <FlatList
                data={selectedGroup.photos}
                horizontal
                initialNumToRender={4}
                keyExtractor={(photo) => photo.relativePath}
                maxToRenderPerBatch={6}
                renderItem={({ item }) => (
                  <MapPhotoThumbnail
                    onPress={() => onSelectPhoto(item)}
                    photo={item}
                    styles={styles}
                  />
                )}
                showsHorizontalScrollIndicator={false}
                style={styles.mapPhotoList}
                windowSize={5}
              />
            </View>
          ) : (
            <Text style={styles.mapHint}>Нажмите точку, чтобы открыть фотографию</Text>
          )}
        </>
      )}
    </View>
  );
}

function MapPhotoThumbnail({
  onPress,
  photo,
  styles
}: {
  onPress: () => void;
  photo: LocatedArchivePhoto;
  styles: ReturnType<typeof createStyles>;
}) {
  const preview = usePreviewResource(photo);
  const { active: presentationMode, blurDates } = useContext(PresentationModeContext);
  const presentationBlurred = isPresentationPhotoBlurred(
    presentationMode,
    blurDates,
    photo.date
  );
  return (
    <Pressable
      accessibilityLabel={`Открыть фотографию за ${photo.date}`}
      onPress={onPress}
      style={({ pressed }) => [styles.mapPhoto, pressed && styles.pressed]}
    >
      {preview.uri ? (
        <Image
          blurRadius={presentationBlurred ? 22 : 0}
          onError={preview.onError}
          resizeMode="cover"
          source={{ uri: preview.uri }}
          style={[
            styles.mapPhotoImage,
            presentationBlurred && styles.presentationBlurredImage
          ]}
        />
      ) : (
        <View style={[styles.mapPhotoImage, styles.mapPhotoPlaceholder]} />
      )}
      <Text numberOfLines={1} style={styles.mapPhotoDate}>{photo.date}</Text>
    </Pressable>
  );
}

const VIEWER_MINI_MAP_WIDTH = 128;
const VIEWER_MINI_MAP_HEIGHT = 92;

function ViewerMiniMap({
  location,
  palette
}: {
  location: ArchiveLocation;
  palette: Palette;
}) {
  const tiles = useMemo(() => buildMiniMapTiles(
    location,
    VIEWER_MINI_MAP_WIDTH,
    VIEWER_MINI_MAP_HEIGHT
  ), [location.latitude, location.longitude]);
  return (
    <View style={[viewerStyles.miniMapOverlayMap, { backgroundColor: palette.emptyCell }]}>
      <View style={viewerStyles.miniMapFallbackHorizontal} />
      <View style={viewerStyles.miniMapFallbackVertical} />
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          resizeMode="cover"
          source={{ uri: tile.url }}
          style={[
            viewerStyles.miniMapTile,
            { left: tile.left, top: tile.top }
          ]}
        />
      ))}
      {palette.isDark ? <View style={viewerStyles.miniMapDarkener} /> : null}
      <View style={viewerStyles.miniMapMarker}>
        <MaterialCommunityIcons color="#ffffff" name="map-marker" size={24} />
      </View>
      <Text numberOfLines={1} style={viewerStyles.miniMapCoordinates}>
        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
      </Text>
      <Text style={viewerStyles.miniMapAttribution}>© OSM</Text>
    </View>
  );
}

function ArchiveMap({
  editable,
  location,
  onLocationChange,
  palette,
  style
}: {
  editable: boolean;
  location?: ArchiveLocation | null;
  onLocationChange?: (location: ArchiveLocation) => void;
  palette: Palette;
  style: object;
}) {
  const html = useMemo(
    () => buildPhotoLocationMapHtml(location, editable, palette),
    [editable, location, palette]
  );
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    if (!editable || !onLocationChange) return;
    try {
      const value = JSON.parse(event.nativeEvent.data);
      const latitude = Number(value.latitude);
      const longitude = Number(value.longitude);
      if (
        Number.isFinite(latitude)
        && Number.isFinite(longitude)
        && latitude >= -90
        && latitude <= 90
        && longitude >= -180
        && longitude <= 180
      ) onLocationChange({ latitude, longitude });
    } catch {
      // Сообщения страницы, не содержащие координаты, игнорируются.
    }
  }, [editable, onLocationChange]);
  return (
    <WebView
      javaScriptEnabled
      key={`${editable}:${location?.latitude || 0}:${location?.longitude || 0}`}
      onMessage={handleMessage}
      originWhitelist={['*']}
      pointerEvents="auto"
      scrollEnabled={false}
      source={{ html }}
      style={style}
    />
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Не удалось прочитать выбранную папку';
}

async function readPreferredPaths(directoryUri: string): Promise<Record<string, string>> {
  try {
    const value = JSON.parse(await AsyncStorage.getItem(`${PREFERRED_PHOTOS_KEY_PREFIX}${directoryUri}`) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([date, path]) => (
      /^(?:19|20)\d{2}-\d{2}-\d{2}$/.test(date) && typeof path === 'string'
        ? [[date, path]]
        : []
    )));
  } catch {
    return {};
  }
}

async function writePreferredPaths(
  directoryUri: string,
  value: Record<string, string>
): Promise<void> {
  if (!directoryUri) return;
  await AsyncStorage.setItem(
    `${PREFERRED_PHOTOS_KEY_PREFIX}${directoryUri}`,
    JSON.stringify(value)
  );
}

function showLatestPhotoMonth(
  photos: ArchivePhoto[],
  setViewMonth: (value: Date) => void
) {
  const nextIndex = buildPhotoIndex(photos);
  if (nextIndex.dates.length === 0) return;
  const latest = dateFromKey(nextIndex.dates[nextIndex.dates.length - 1]);
  if (latest) setViewMonth(new Date(latest.getFullYear(), latest.getMonth(), 1));
}

function previewCacheKey(photo: ArchivePhoto): string {
  return `${photo.uri}\n${photo.relativePath}\n${photo.modifiedAt || 0}`;
}

function ensurePreviewUri(
  photo: ArchivePhoto,
  priority = VISIBLE_PREVIEW_PRIORITY
): Promise<string> {
  const cacheKey = previewCacheKey(photo);
  if (priority >= VISIBLE_PREVIEW_PRIORITY) activePreviewWarmup?.prioritize(cacheKey);
  const completedUri = completedPreviewUris.get(cacheKey);
  if (completedUri) {
    activePreviewWarmup?.markVisited(cacheKey);
    return Promise.resolve(completedUri);
  }
  let job = previewJobs.get(cacheKey);
  if (!job) {
    job = enqueuePreview(
      () => loadPhotoPreview(PhotoArchive, photo.uri, cacheKey),
      priority
    );
    previewJobs.set(cacheKey, job);
    const cleanup = () => {
      if (previewJobs.get(cacheKey) === job) previewJobs.delete(cacheKey);
    };
    void job.then((uri) => {
      completedPreviewUris.set(cacheKey, uri);
      activePreviewWarmup?.markVisited(cacheKey);
      cleanup();
      return uri;
    }, cleanup);
  } else {
    enqueuePreview.promote(job, priority);
  }
  return job;
}

type PreviewResource = {
  failed: boolean;
  loading: boolean;
  onError: () => void;
  retry: () => void;
  uri: string | null;
};

type PreviewResourceState = Pick<PreviewResource, 'failed' | 'loading' | 'uri'> & {
  cacheKey: string;
};

function previewResourceState(cacheKey: string): PreviewResourceState {
  const uri = cacheKey ? completedPreviewUris.get(cacheKey) || null : null;
  return {
    cacheKey,
    failed: false,
    loading: Boolean(cacheKey && !uri),
    uri
  };
}

function usePreviewResource(photo?: ArchivePhoto): PreviewResource {
  const cacheKey = photo ? previewCacheKey(photo) : '';
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState<PreviewResourceState>(() => (
    previewResourceState(cacheKey)
  ));
  const renderedErrorKey = useRef('');

  useEffect(() => {
    let active = true;
    const retryTimers: Array<ReturnType<typeof setTimeout>> = [];
    setState(previewResourceState(cacheKey));
    if (!photo) return () => { active = false; };
    let attempts = 0;
    const load = () => {
      ensurePreviewUri(photo).then((uri) => {
        if (active) {
          setState({ cacheKey, failed: false, loading: false, uri });
        }
      }).catch(() => {
        attempts += 1;
        if (active && attempts < 2) {
          retryTimers.push(setTimeout(load, attempts * 700));
        } else if (active) {
          setState({ cacheKey, failed: true, loading: false, uri: null });
        }
      });
    };
    load();
    return () => {
      active = false;
      retryTimers.forEach(clearTimeout);
    };
  }, [cacheKey, reloadVersion]);

  const retry = useCallback(() => {
    if (!cacheKey) return;
    completedPreviewUris.delete(cacheKey);
    renderedErrorKey.current = '';
    setReloadVersion((current) => current + 1);
  }, [cacheKey]);

  const onError = useCallback(() => {
    if (!cacheKey) return;
    completedPreviewUris.delete(cacheKey);
    if (renderedErrorKey.current !== cacheKey) {
      renderedErrorKey.current = cacheKey;
      setReloadVersion((current) => current + 1);
      return;
    }
    setState({ cacheKey, failed: true, loading: false, uri: null });
  }, [cacheKey]);

  const visibleState = state.cacheKey === cacheKey
    ? state
    : previewResourceState(cacheKey);
  return {
    failed: visibleState.failed,
    loading: visibleState.loading,
    onError,
    retry,
    uri: visibleState.uri
  };
}

function ensureDisplayPhotoUri(photo: ArchivePhoto): Promise<string> {
  const cacheKey = previewCacheKey(photo);
  const completedUri = completedDisplayUris.get(cacheKey);
  if (completedUri) return Promise.resolve(completedUri);
  let job = displayPhotoJobs.get(cacheKey);
  if (!job) {
    job = enqueueDisplayPhoto(() => loadDisplayPhoto(PhotoArchive, photo.uri, cacheKey));
    displayPhotoJobs.set(cacheKey, job);
    const cleanup = () => {
      if (displayPhotoJobs.get(cacheKey) === job) displayPhotoJobs.delete(cacheKey);
    };
    void job.then((uri) => {
      completedDisplayUris.set(cacheKey, uri);
      cleanup();
      return uri;
    }, cleanup);
  }
  return job;
}

function calendarTitle(focus: CalendarFocus, value: Date): string {
  if (focus === 'years') return 'Фото по годам';
  if (focus === 'year') return String(value.getFullYear());
  if (focus === 'week') {
    const cells = buildCalendarWeek(value);
    const first = dateFromKey(cells[0].date);
    const last = dateFromKey(cells[6].date);
    if (first && last) {
      return `${WEEK_EDGE_FORMATTER.format(first)} — ${WEEK_EDGE_FORMATTER.format(last)} ${last.getFullYear()}`;
    }
  }
  return capitalize(MONTH_FORMATTER.format(value));
}

function calendarNavigationLabel(focus: CalendarFocus, amount: number): string {
  if (focus === 'week') return `${amount < 0 ? 'Предыдущая' : 'Следующая'} неделя`;
  if (focus === 'year') return `${amount < 0 ? 'Предыдущий' : 'Следующий'} год`;
  if (focus === 'years') return 'Навигация по годам недоступна';
  return `${amount < 0 ? 'Предыдущий' : 'Следующий'} месяц`;
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function dayAccessibilityLabel(date: string, photoCount: number): string {
  const parsed = dateFromKey(date);
  const label = parsed ? DATE_FORMATTER.format(parsed) : date;
  if (!photoCount) return `${label}, фотографий нет`;
  return `${label}, фотографий: ${photoCount}`;
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    safeArea: {
      backgroundColor: palette.background,
      flex: 1
    },
    header: {
      alignItems: 'center',
      borderBottomColor: palette.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12
    },
    title: {
      color: palette.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.7
    },
    iconButton: {
      alignItems: 'center',
      borderColor: palette.border,
      borderRadius: 18,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38
    },
    iconButtonActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent
    },
    iconButtonText: {
      color: palette.text,
      fontSize: 25,
      lineHeight: 27
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8
    },
    themeButtonText: {
      color: palette.text,
      fontSize: 19,
      lineHeight: 21
    },
    content: {
      gap: 16,
      padding: 14,
      paddingBottom: 30
    },
    mainContent: {
      flex: 1
    },
    mapContent: {
      flexGrow: 1,
      paddingBottom: 0
    },
    screenCalendarContent: {
      flexGrow: 1,
      paddingBottom: 0
    },
    scanStatus: {
      backgroundColor: palette.card,
      borderColor: palette.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    scanStatusHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8
    },
    scanStatusText: {
      color: palette.text,
      flex: 1,
      fontSize: 13,
      fontWeight: '700'
    },
    scanStatusCount: {
      color: palette.muted,
      fontSize: 12,
      fontVariant: ['tabular-nums']
    },
    error: {
      backgroundColor: palette.dangerBackground,
      borderColor: colorWithAlpha(palette.danger, '55'),
      borderRadius: 12,
      borderWidth: 1,
      color: palette.danger,
      fontSize: 14,
      lineHeight: 20,
      padding: 12
    },
    appModeTabs: {
      alignSelf: 'center',
      backgroundColor: palette.controlBackground,
      borderRadius: 18,
      flexDirection: 'row',
      padding: 3,
      width: '100%'
    },
    appModeButton: {
      alignItems: 'center',
      borderRadius: 15,
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      height: 42,
      justifyContent: 'center'
    },
    appModeButtonActive: {
      backgroundColor: palette.accent
    },
    appModeText: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '800'
    },
    appModeTextActive: {
      color: palette.onAccent
    },
    calendarFocus: {
      alignSelf: 'center',
      backgroundColor: palette.controlBackground,
      borderRadius: 12,
      flexDirection: 'row',
      padding: 3,
      width: '100%'
    },
    calendarFocusButton: {
      alignItems: 'center',
      borderRadius: 9,
      flex: 1,
      flexDirection: 'row',
      gap: 4,
      height: 40,
      justifyContent: 'center'
    },
    calendarFocusButtonActive: {
      backgroundColor: palette.accent
    },
    calendarFocusText: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700'
    },
    calendarFocusTextActive: {
      color: palette.onAccent
    },
    calendarCard: {
      backgroundColor: palette.card,
      borderColor: palette.border,
      borderRadius: 18,
      borderWidth: 1,
      overflow: 'hidden',
      paddingBottom: 6
    },
    screenCalendarCard: {
      flex: 1,
      minHeight: 0
    },
    mapMode: {
      backgroundColor: palette.card,
      borderColor: palette.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      minHeight: 260,
      overflow: 'hidden'
    },
    mapModeHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 58,
      paddingHorizontal: 14,
      paddingVertical: 10
    },
    mapModeCopy: {
      flex: 1
    },
    mapModeTitle: {
      color: palette.text,
      fontSize: 17,
      fontWeight: '800'
    },
    mapModeMeta: {
      color: palette.muted,
      fontSize: 12,
      marginTop: 2
    },
    mapCloseButton: {
      alignItems: 'center',
      height: 38,
      justifyContent: 'center',
      width: 38
    },
    mapCloseText: {
      color: palette.text,
      fontSize: 29,
      fontWeight: '300',
      lineHeight: 31
    },
    archiveMap: {
      flex: 1
    },
    mapHint: {
      backgroundColor: palette.card,
      color: palette.muted,
      fontSize: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      textAlign: 'center'
    },
    mapEmpty: {
      alignItems: 'center',
      flex: 1,
      gap: 7,
      justifyContent: 'center',
      padding: 28
    },
    mapSelection: {
      backgroundColor: palette.card,
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingBottom: 10,
      paddingHorizontal: 12,
      paddingTop: 8
    },
    mapSelectionTitle: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '800'
    },
    mapSelectionMeta: {
      color: palette.muted,
      fontSize: 11,
      marginBottom: 7,
      marginTop: 1
    },
    mapPhotoList: {
      flexGrow: 0
    },
    mapPhoto: {
      backgroundColor: palette.emptyCell,
      borderRadius: 8,
      height: 76,
      marginRight: 8,
      overflow: 'hidden',
      width: 88
    },
    mapPhotoImage: {
      height: 56,
      width: '100%'
    },
    mapPhotoPlaceholder: {
      backgroundColor: palette.emptyCell
    },
    mapPhotoDate: {
      color: palette.text,
      fontSize: 10,
      fontWeight: '700',
      paddingHorizontal: 5,
      paddingTop: 3
    },
    monthHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 10
    },
    monthButton: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      width: 42
    },
    monthButtonText: {
      color: palette.text,
      fontSize: 34,
      fontWeight: '300',
      lineHeight: 36
    },
    monthHeading: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minWidth: 0
    },
    monthTitle: {
      color: palette.text,
      flexShrink: 1,
      fontSize: 18,
      fontWeight: '800',
      minWidth: 0,
      textAlign: 'center'
    },
    todayButton: {
      alignItems: 'center',
      borderColor: palette.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      flexShrink: 0,
      gap: 4,
      minHeight: 28,
      paddingHorizontal: 8
    },
    todayButtonText: {
      color: palette.text,
      fontSize: 11,
      fontWeight: '700'
    },
    weekdayRow: {
      flexDirection: 'row',
      paddingHorizontal: 5,
      paddingVertical: 5
    },
    weekday: {
      color: palette.muted,
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      minWidth: 0,
      textAlign: 'center'
    },
    calendarGrid: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: 5
    },
    weekCalendarGrid: {
      flex: 1,
      minHeight: 0,
      paddingBottom: 4
    },
    calendarWeek: {
      flex: 1,
      flexDirection: 'row',
      minHeight: 0
    },
    weekCalendarRows: {
      flex: 1,
      flexDirection: 'column',
      minHeight: 0
    },
    dayCell: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      padding: 2
    },
    weekDayCell: {
      aspectRatio: undefined,
      flex: 1,
      minHeight: 0,
      paddingHorizontal: 2,
      paddingVertical: 3,
      width: '100%'
    },
    outsideMonth: {
      opacity: 0.35
    },
    dayImageBackground: {
      flex: 1,
      justifyContent: 'space-between',
      overflow: 'hidden',
      padding: 5
    },
    weekDayImageBackground: {
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    dayImage: {
      borderRadius: 6,
    },
    presentationBlurredImage: {
      transform: [{ scale: 1.08 }]
    },
    dayImagePlaceholder: {
      backgroundColor: palette.emptyCell
    },
    dayShade: {
      backgroundColor: 'rgba(0, 0, 0, 0.13)',
      borderRadius: 6,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0
    },
    photoDayNumber: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { height: 1, width: 0 },
      textShadowRadius: 2
    },
    weekDayLabel: {
      fontSize: 15
    },
    variantBadge: {
      alignSelf: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      borderRadius: 8,
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
      minWidth: 16,
      overflow: 'hidden',
      paddingHorizontal: 4,
      paddingVertical: 2,
      textAlign: 'center'
    },
    emptyDay: {
      alignItems: 'flex-start',
      backgroundColor: 'transparent',
      borderBottomColor: palette.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderRightColor: palette.border,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRadius: 6,
      flex: 1,
      padding: 5
    },
    weekEmptyDay: {
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    emptyDayNumber: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '600'
    },
    weekEmptyDayNumber: {
      fontSize: 15,
      fontWeight: '700'
    },
    outsideMonthText: {
      color: palette.muted
    },
    periodGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 5,
      paddingBottom: 5
    },
    periodCard: {
      aspectRatio: 1.45,
      backgroundColor: palette.emptyCell,
      borderColor: palette.card,
      borderRadius: 10,
      borderWidth: 2,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      padding: 9,
      width: '50%'
    },
    periodImage: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0
    },
    periodShade: {
      backgroundColor: 'rgba(0, 0, 0, 0.32)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0
    },
    periodShadeEmpty: {
      backgroundColor: 'transparent'
    },
    periodCopy: {
      zIndex: 1
    },
    periodTitle: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '900',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { height: 1, width: 0 },
      textShadowRadius: 2
    },
    periodMeta: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
      opacity: 0.9,
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { height: 1, width: 0 },
      textShadowRadius: 2
    },
    periodTitleEmpty: {
      color: palette.text,
      textShadowRadius: 0
    },
    periodMetaEmpty: {
      color: palette.muted,
      textShadowRadius: 0
    },
    periodEmpty: {
      color: palette.muted,
      padding: 30,
      textAlign: 'center'
    },
    notice: {
      backgroundColor: palette.card,
      borderColor: palette.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 5,
      padding: 15
    },
    noticeTitle: {
      color: palette.text,
      fontSize: 15,
      fontWeight: '800'
    },
    noticeText: {
      color: palette.muted,
      fontSize: 13,
      lineHeight: 19
    },
    centeredState: {
      alignItems: 'center',
      flex: 1,
      gap: 10,
      justifyContent: 'center',
      padding: 36
    },
    loadingTitle: {
      color: palette.text,
      fontSize: 20,
      fontWeight: '800',
      marginTop: 8
    },
    loadingSpinner: {
      color: palette.photoGreen
    },
    loadingText: {
      color: palette.muted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center'
    },
    progressBlock: {
      gap: 7,
      maxWidth: 330,
      width: '100%'
    },
    progressBlockCompact: {
      maxWidth: '100%'
    },
    progressTrack: {
      backgroundColor: palette.emptyCell,
      borderRadius: 4,
      height: 7,
      overflow: 'hidden',
      width: '100%'
    },
    progressFill: {
      backgroundColor: palette.photoGreen,
      borderRadius: 4,
      height: '100%'
    },
    progressTrackPlaceholder: {
      opacity: 0
    },
    progressText: {
      color: palette.muted,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
      textAlign: 'center'
    },
    welcomeWrap: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 28
    },
    welcomeArtwork: {
      backgroundColor: palette.card,
      borderColor: palette.border,
      borderRadius: 24,
      borderWidth: 1,
      height: 174,
      marginBottom: 26,
      overflow: 'hidden',
      padding: 18,
      width: 174
    },
    welcomeMonth: {
      color: palette.eyebrow,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 2
    },
    welcomeDay: {
      color: palette.text,
      fontSize: 70,
      fontWeight: '900',
      letterSpacing: -5,
      lineHeight: 82,
      zIndex: 2
    },
    welcomeSun: {
      backgroundColor: '#d5a24a',
      borderRadius: 52,
      bottom: -20,
      height: 104,
      position: 'absolute',
      right: -18,
      width: 104
    },
    welcomeTitle: {
      color: palette.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.8,
      textAlign: 'center'
    },
    welcomeText: {
      color: palette.muted,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 22,
      marginTop: 10,
      maxWidth: 340,
      textAlign: 'center'
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 9,
      height: 54,
      justifyContent: 'center',
      minWidth: 250,
      paddingHorizontal: 20
    },
    primaryButtonText: {
      color: palette.onAccent,
      fontSize: 16,
      fontWeight: '800',
      textAlign: 'center'
    },
    platformHint: {
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: 28,
      maxWidth: 340,
      paddingTop: 16
    },
    platformHintTitle: {
      color: palette.text,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center'
    },
    platformHintText: {
      color: palette.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
      textAlign: 'center'
    },
    pressed: {
      opacity: 0.58
    },
    disabled: {
      opacity: 0.4
    },
    invisible: {
      opacity: 0
    }
  });
}

const mobileToastStyles = StyleSheet.create({
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(22, 58, 48, 0.96)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 22,
    elevation: 8,
    maxWidth: '88%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    zIndex: 100
  },
  toastDark: {
    backgroundColor: 'rgba(33, 42, 38, 0.97)',
    bottom: 18
  },
  text: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center'
  }
});

const viewerStyles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#090d0b',
    flex: 1
  },
  content: {
    flex: 1
  },
  photoStage: {
    backgroundColor: '#050706',
    overflow: 'hidden',
    position: 'relative'
  },
  photoStageCentered: {
    flex: 1
  },
  list: {
    flexGrow: 0
  },
  photoPage: {
    overflow: 'hidden'
  },
  photo: {
    height: '100%',
    width: '100%'
  },
  displayPhoto: {
    height: '100%',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%'
  },
  presentationBlurredPhoto: {
    transform: [{ scale: 1.08 }]
  },
  photoLoader: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  photoFailure: {
    alignItems: 'center',
    bottom: 0,
    gap: 10,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 32,
    position: 'absolute',
    right: 0,
    top: 0
  },
  photoFailureTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center'
  },
  photoFailureText: {
    color: '#aeb8b3',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 360,
    textAlign: 'center'
  },
  photoRetryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.32)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
    minHeight: 42,
    paddingHorizontal: 16
  },
  photoRetryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  photoOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  photoBottomBar: {
    bottom: 0,
    gap: 10,
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 0
  },
  miniMapOverlay: {
    backgroundColor: 'rgba(15, 22, 19, 0.48)',
    borderColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 92,
    left: 12,
    opacity: 0.72,
    overflow: 'hidden',
    position: 'absolute',
    top: 12,
    width: 128
  },
  miniMapOverlayPressed: {
    opacity: 0.5,
    transform: [{ scale: 0.98 }]
  },
  miniMapOverlayMap: {
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: '100%'
  },
  miniMapTile: {
    height: 256,
    position: 'absolute',
    width: 256
  },
  miniMapDarkener: {
    backgroundColor: 'rgba(6, 12, 9, 0.32)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  miniMapFallbackHorizontal: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%'
  },
  miniMapFallbackVertical: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    bottom: 0,
    left: '50%',
    position: 'absolute',
    top: 0,
    width: 1
  },
  miniMapMarker: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -14,
    marginTop: -22,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.52,
    shadowRadius: 3,
    top: '50%',
    width: 28
  },
  miniMapCoordinates: {
    backgroundColor: 'rgba(5, 10, 8, 0.72)',
    borderRadius: 5,
    bottom: 5,
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
    left: 5,
    maxWidth: 91,
    paddingHorizontal: 4,
    paddingVertical: 2,
    position: 'absolute'
  },
  miniMapAttribution: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    bottom: 0,
    color: '#17211c',
    fontSize: 6,
    paddingHorizontal: 2,
    position: 'absolute',
    right: 0
  },
  mapOverlay: {
    backgroundColor: '#14211c',
    borderColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 12,
    left: 12,
    overflow: 'hidden',
    position: 'absolute',
    right: 12,
    top: 12
  },
  mapOverlayMap: {
    height: '100%',
    width: '100%'
  },
  mapOverlayClose: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 2
  },
  photoAlternatives: {
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 2
  },
  diaryOverlay: {
    bottom: 12,
    left: 12,
    position: 'absolute',
    right: 12,
    top: 12
  },
  diaryOverlayGlass: {
    borderRadius: 22,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  diaryOverlayContent: {
    flex: 1,
    gap: 12,
    padding: 16
  },
  diaryOverlayTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center'
  },
  diaryOverlayTextArea: {
    flex: 1,
    minHeight: 0
  },
  diaryOverlayActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end'
  },
  diaryOverlayStatus: {
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 11,
    textAlign: 'right'
  },
  diaryOverlayScroll: {
    flex: 1
  },
  diaryOverlayMarkdownContent: {
    paddingBottom: 12
  },
  photoActionRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%'
  },
  photoDateRow: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  photoCloseButton: {
    position: 'absolute',
    right: 12,
    top: 12
  },
  glassSurface: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 22, 19, 0.48)',
    borderColor: 'rgba(255, 255, 255, 0.36)',
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 10
  },
  glassSurfaceActive: {
    backgroundColor: 'rgba(44, 116, 82, 0.58)',
    borderColor: 'rgba(181, 255, 215, 0.62)'
  },
  glassSurfaceDestructive: {
    backgroundColor: 'rgba(112, 29, 29, 0.58)',
    borderColor: 'rgba(255, 178, 178, 0.58)'
  },
  glassButtonFrame: {
    borderRadius: 22,
    height: 42,
    width: 42
  },
  glassButton: {
    borderRadius: 22,
    height: 42,
    width: 42
  },
  glassButtonPressed: {
    transform: [{ scale: 0.92 }]
  },
  dateButtonFrame: {
    minHeight: 38,
    width: 148
  },
  dateGlass: {
    borderRadius: 18,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: '100%'
  },
  dateOnPhoto: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 3
  },
  controlsScroll: {
    flex: 1
  },
  controls: {
    gap: 12,
    paddingBottom: 18,
    paddingHorizontal: 14,
    paddingTop: 10
  },
  section: {
    gap: 7
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  alternative: {
    backgroundColor: '#141c18',
    borderColor: 'transparent',
    borderRadius: 9,
    borderWidth: 2,
    height: 58,
    overflow: 'hidden',
    width: 78
  },
  alternativeCurrent: {
    borderColor: '#ffffff'
  },
  alternativeImage: {
    height: '100%',
    width: '100%'
  },
  preferredBadge: {
    backgroundColor: '#39745e',
    borderRadius: 10,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: 'absolute',
    right: 3,
    top: 3
  },
  actionButton: {
    alignItems: 'center',
    borderColor: 'rgba(216, 232, 222, 0.24)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 13
  },
  actionButtonCompact: {
    paddingHorizontal: 0,
    width: 42
  },
  actionButtonActive: {
    backgroundColor: '#356e58',
    borderColor: '#78b38e'
  },
  actionButtonDestructive: {
    backgroundColor: '#4b2020',
    borderColor: '#a95050'
  },
  actionButtonDisabled: {
    opacity: 0.4
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  editor: {
    backgroundColor: '#18211d',
    borderColor: 'rgba(216, 232, 222, 0.16)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 12
  },
  editorTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  input: {
    backgroundColor: 'rgba(216, 232, 222, 0.08)',
    borderRadius: 9,
    color: '#edf3ef',
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12
  },
  textArea: {
    backgroundColor: 'rgba(216, 232, 222, 0.08)',
    borderRadius: 9,
    color: '#edf3ef',
    fontSize: 15,
    minHeight: 160,
    padding: 12,
    textAlignVertical: 'top'
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end'
  },
  markdown: {
    marginTop: 7
  },
  markdownText: {
    color: '#f5f0e8',
    fontSize: 14,
    lineHeight: 20
  },
  markdownBreak: {
    height: 7
  },
  markdownHeading1: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
    marginBottom: 4,
    marginTop: 5
  },
  markdownHeading2: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 3,
    marginTop: 4
  },
  markdownList: {
    paddingLeft: 7
  },
  markdownLink: {
    color: '#a8d5b9',
    textDecorationLine: 'underline'
  },
  markdownStrong: {
    fontWeight: '800'
  },
  markdownEmphasis: {
    fontStyle: 'italic'
  },
  markdownStrike: {
    textDecorationLine: 'line-through'
  },
  markdownCode: {
    backgroundColor: '#26332d',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 13
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  searchInput: {
    flex: 1
  },
  searchResult: {
    backgroundColor: 'rgba(216, 232, 222, 0.08)',
    borderRadius: 8,
    padding: 9
  },
  searchResultText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 17
  },
  map: {
    borderRadius: 10,
    height: 250,
    overflow: 'hidden',
    width: '100%'
  },
  miniMapWrap: {
    borderRadius: 12,
    height: 110,
    overflow: 'hidden'
  },
  miniMap: {
    height: '100%',
    width: '100%'
  },
  miniMapLabel: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    bottom: 7,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    left: 7,
    maxWidth: '85%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: 'absolute'
  },
  coordinateText: {
    color: '#aaaaaa',
    fontSize: 11,
    textAlign: 'center'
  },
  attribution: {
    color: '#aaaaaa',
    fontSize: 10,
    textAlign: 'center',
    textDecorationLine: 'underline'
  },
  status: {
    color: '#9daaa2',
    fontSize: 12,
    textAlign: 'center'
  }
});

function colorWithAlpha(color: string, alpha: string): string {
  return color.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color;
}
