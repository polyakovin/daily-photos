import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const iosSource = readFileSync(
  new URL('../modules/photo-archive/ios/PhotoArchiveModule.swift', import.meta.url),
  'utf8'
);
const androidSource = readFileSync(
  new URL(
    '../modules/photo-archive/android/src/main/java/ru/photoday/archive/PhotoArchiveModule.kt',
    import.meta.url
  ),
  'utf8'
);
const androidExifSource = readFileSync(
  new URL(
    '../modules/photo-archive/android/src/main/java/ru/photoday/archive/PhotoExifLocation.java',
    import.meta.url
  ),
  'utf8'
);
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const progressSource = readFileSync(new URL('../src/scan-progress.ts', import.meta.url), 'utf8');

test('native archive scanners publish incremental progress on both platforms', () => {
  for (const source of [iosSource, androidSource]) {
    assert.match(source, /Events\("onScanProgress"\)/);
    assert.match(source, /sendEvent\(\s*(progressEventName|PROGRESS_EVENT_NAME)/);
    assert.match(source, /"scannedItems"/);
    assert.match(source, /"foundPhotos"/);
    assert.match(source, /"counting"/);
    assert.match(source, /"totalItems"/);
    assert.match(source, /collectScannableItems/);
    assert.match(source, /sendScanProgress\([\s\S]*?"scanning"/);
  }
  assert.match(appSource, /createProximityWarmup/);
  assert.match(appSource, /prewarmItems\(previewWarmupPhotos/);
  assert.match(appSource, /BACKGROUND_PREVIEW_PRIORITY/);
  assert.match(appSource, /VISIBLE_PREVIEW_PRIORITY/);
  assert.match(appSource, /enqueuePreviewWarmup = createTaskQueue\(1\)/);
  assert.doesNotMatch(appSource, /Animated\.loop/);
  assert.match(progressSource, /progress\.scannedItems \/ totalItems/);
});

test('native archive modules persist and restore a directory-specific photo index', () => {
  for (const source of [iosSource, androidSource]) {
    assert.match(source, /getCachedPhotos/);
    assert.match(source, /writeIndexCache/);
    assert.match(source, /photo-archive-index\.json/);
  }
});

test('mobile startup restores the local index before touching iCloud metadata', () => {
  const scanDirectorySource = appSource.slice(
    appSource.indexOf('const scanDirectory = useCallback'),
    appSource.indexOf('const chooseDirectory = useCallback')
  );
  assert.ok(
    scanDirectorySource.indexOf('await PhotoArchive.getCachedPhotos()')
      < scanDirectorySource.indexOf('void refreshViewerMetadata(requestId)')
  );
  assert.ok(
    scanDirectorySource.indexOf('setPhotos(nextPhotos)')
      < scanDirectorySource.indexOf('void refreshViewerMetadata(requestId)')
  );
});

test('metadata failure is reported separately without marking the photo archive unavailable', () => {
  const scanDirectorySource = appSource.slice(
    appSource.indexOf('const scanDirectory = useCallback'),
    appSource.indexOf('const chooseDirectory = useCallback')
  );
  assert.match(appSource, /metadataWarning/);
  assert.match(appSource, /Заметки и геометки временно недоступны/);
  assert.doesNotMatch(scanDirectorySource, /setError\(`Фотоархив открыт/);
});

test('iOS cancels a file coordinator that cannot open an unavailable iCloud archive', () => {
  assert.match(iosSource, /archiveCoordinatorTimeout/);
  assert.match(iosSource, /NSFileAccessIntent\.readingIntent/);
  assert.match(iosSource, /coordinator\.coordinate\(with:/);
  assert.match(iosSource, /coordinator\.cancel\(\)/);
  assert.match(iosSource, /iCloud не ответил вовремя/);
});

test('an unavailable archive offers retry and folder replacement actions', () => {
  assert.match(appSource, /Повторить открытие фотоархива/);
  assert.match(appSource, /Выбрать другую папку фотоархива/);
  assert.match(appSource, /onRetry=\{\(\) => void scanDirectory\(directory\)\}/);
});

test('calendar previews use operating-system thumbnail APIs and a disk cache', () => {
  assert.match(iosSource, /QLThumbnailGenerator/);
  assert.match(iosSource, /\.cachesDirectory/);
  assert.match(iosSource, /destination\.resourceValues/);
  assert.match(androidSource, /loadThumbnail/);
  assert.match(androidSource, /context\.cacheDir/);
  assert.match(androidSource, /destination\.isFile && destination\.length\(\) > 0/);
  for (const source of [iosSource, androidSource]) {
    assert.match(source, /getPreview/);
    assert.match(source, /photo-archive-previews/);
  }
});

test('full-screen photos are copied into an app-local display cache on both platforms', () => {
  assert.match(appSource, /loadDisplayPhoto\(PhotoArchive/);
  assert.match(appSource, /function ViewerPhoto/);
  assert.match(appSource, /usePreviewResource\(photo\)/);
  assert.match(iosSource, /AsyncFunction\("getDisplayUri"\)/);
  assert.match(iosSource, /startDownloadingUbiquitousItem/);
  assert.match(iosSource, /NSFileCoordinator\(\)\.coordinate\([\s\S]*?readingItemAt: source/);
  assert.match(iosSource, /copyItem\(at: coordinatedSource, to: temporary\)/);
  assert.match(androidSource, /AsyncFunction\("getDisplayUri"\)/);
  assert.match(androidSource, /prepareDisplayPhoto/);
  for (const source of [iosSource, androidSource]) {
    assert.match(source, /photo-archive-display/);
  }
});

test('native archive modules expose portable viewer metadata and guarded mutations', () => {
  for (const source of [iosSource, androidSource]) {
    assert.match(source, /getViewerMetadata/);
    assert.match(source, /saveDiary/);
    assert.match(source, /setPhotoLocation/);
    assert.match(source, /setHighlight/);
    assert.match(source, /setBlurred/);
    assert.match(source, /movePhoto/);
    assert.match(source, /deletePhoto/);
    assert.match(source, /photo_locations\.json/);
    assert.match(source, /period_photo_selections\.json/);
    assert.match(source, /presentation_blur_dates\.json/);
  }
  assert.match(iosSource, /coordinatedWrite/);
  assert.match(androidSource, /FLAG_GRANT_WRITE_URI_PERMISSION/);
});

test('native archive modules lazily read EXIF coordinates for the open photo', () => {
  assert.match(iosSource, /AsyncFunction\("getPhotoExifLocation"\)/);
  assert.match(iosSource, /kCGImagePropertyGPSDictionary/);
  assert.match(androidSource, /AsyncFunction\("getPhotoExifLocation"\)/);
  assert.match(androidSource, /PhotoExifLocation\.read/);
  assert.match(androidExifSource, /new ExifInterface\(descriptor\.getFileDescriptor\(\)\)\.getLatLong/);
  assert.match(appSource, /loadPhotoExifLocation\([\s\S]*?PhotoArchive/);
  assert.match(appSource, /ensureDisplayPhotoUri\(activePhoto\)/);
  assert.match(appSource, /completedExifLocations/);
});
