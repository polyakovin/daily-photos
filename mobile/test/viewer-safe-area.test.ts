import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const viewerSource = source.slice(
  source.indexOf('function PhotoViewer('),
  source.indexOf("type ViewerPanel =")
);

test('full-screen photo viewer keeps its controls inside the device safe area', () => {
  assert.match(viewerSource, /<SafeAreaView style=\{viewerStyles\.safeArea\}>/);
  assert.match(viewerSource, /<KeyboardAvoidingView[\s\S]*?style=\{viewerStyles\.content\}/);
  assert.ok(viewerSource.indexOf('<SafeAreaView') < viewerSource.indexOf('viewerStyles.photoStage,'));
  assert.ok(viewerSource.indexOf('</KeyboardAvoidingView>') < viewerSource.indexOf('</SafeAreaView>'));
});

test('viewer overlays glass icon controls and a single date on the photo', () => {
  assert.match(viewerSource, /<ViewerGlassButton[\s\S]*?label="Закрыть фотографию"/);
  assert.match(viewerSource, /style=\{viewerStyles\.photoActionRow\}/);
  assert.match(viewerSource, /style=\{viewerStyles\.photoDateRow\}/);
  assert.match(viewerSource, /style=\{viewerStyles\.photoCloseButton\}/);
  assert.match(viewerSource, /accessibilityLabel="Изменить дату фотографии"/);
  assert.match(viewerSource, /onPress=\{\(\) => setPanel\('date'\)\}/);
  assert.match(viewerSource, /style=\{viewerStyles\.dateOnPhoto\}/);
  assert.match(viewerSource, /\{viewerDateLabel\}/);
  assert.match(viewerSource, /formatViewerDate\(activePhoto\?\.date \|\| date\)/);
  assert.doesNotMatch(viewerSource, /<ViewerGlassButton\s+icon="calendar"/);
  assert.doesNotMatch(viewerSource, /label="Предыдущая фотография"|label="Следующая фотография"/);
  assert.doesNotMatch(viewerSource, /showPhotoAt/);
  assert.match(viewerSource, /label=\{isBlurred \? 'Не блюрить в презентации' : 'Блюрить в презентации'\}/);
  assert.doesNotMatch(viewerSource, /navigationCount|viewerStyles\.count/);
  assert.doesNotMatch(viewerSource, /Листайте архив вбок/);
  assert.doesNotMatch(viewerSource, /icon="presentation"/);
  assert.doesNotMatch(viewerSource, /viewerStyles\.photoTopBar/);
  assert.doesNotMatch(viewerSource, /<Switch/);
});

test('viewer centers the photo, closes from the upper-right and keeps actions at the bottom', () => {
  assert.match(viewerSource, /panelBelowPhoto[\s\S]*?viewerStyles\.photoStageCentered/);
  assert.match(viewerSource, /style=\{viewerStyles\.photoBottomBar\}/);
  assert.match(source, /photoCloseButton: \{[\s\S]*?right: 12,[\s\S]*?top: 12/);
  const bottomBar = viewerSource.slice(
    viewerSource.indexOf('<View pointerEvents="box-none" style={viewerStyles.photoBottomBar}>'),
    viewerSource.indexOf("{panel === 'diary' ? (")
  );
  assert.doesNotMatch(bottomBar, /label="Закрыть фотографию"/);
  assert.match(bottomBar, /style=\{viewerStyles\.photoActionRow\}/);
  assert.match(bottomBar, /style=\{viewerStyles\.photoDateRow\}/);
  assert.match(bottomBar, /dayPhotos\.length > 1/);
});

test('viewer mini-map opens an interactive neighborhood map centered on the photo point', () => {
  assert.match(viewerSource, /const viewerLocation = resolvePhotoLocation\(location, exifLocation\)/);
  assert.match(viewerSource, /!panel && viewerLocation/);
  assert.match(viewerSource, /accessibilityLabel=\{location[\s\S]*?'Открыть карту сохранённого места фотографии'[\s\S]*?'Открыть карту места фотографии из EXIF'/);
  assert.match(viewerSource, /accessibilityRole="button"[\s\S]*?onPress=\{\(\) => setPanel\('map'\)\}/);
  assert.match(viewerSource, /<ViewerMiniMap[\s\S]*?location=\{viewerLocation\}/);
  assert.match(source, /function ViewerMiniMap\([\s\S]*?buildMiniMapTiles\([\s\S]*?name="map-marker"/);
  assert.match(viewerSource, /panel === 'map' && viewerLocation[\s\S]*?<ArchiveMap[\s\S]*?editable=\{false\}[\s\S]*?location=\{viewerLocation\}/);
  assert.match(viewerSource, /label="Закрыть карту"[\s\S]*?setPanel\(null\)/);
  assert.match(source, /miniMapOverlay: \{[\s\S]*?left: 12,[\s\S]*?opacity: 0\.72,[\s\S]*?top: 12/);
});

test('viewer opens the diary as a glass overlay without shrinking the photo', () => {
  assert.match(viewerSource, /label=\{diary \? 'Показать заметку' : 'Добавить заметку'\}/);
  assert.match(viewerSource, /accessibilityLabel="Заметка поверх фотографии"/);
  assert.match(viewerSource, /<ViewerGlassSurface style=\{viewerStyles\.diaryOverlayGlass\}>/);
  assert.match(viewerSource, /panel === 'diary'[\s\S]*?<DiaryMarkdown content=\{diary\}/);
  assert.match(viewerSource, /label="Редактировать заметку"/);
  assert.match(viewerSource, /const panelBelowPhoto = panel === 'date' \|\| panel === 'location'/);
  assert.match(viewerSource, /panelBelowPhoto[\s\S]*?viewerStyles\.photoStageCentered/);
  assert.doesNotMatch(viewerSource, /style=\{viewerStyles\.diaryPreview\}/);
});

test('photo overlay uses native Liquid Glass with a cross-platform fallback', () => {
  assert.match(source, /requireOptionalNativeModule<GlassEffectNativeModule>\('ExpoGlassEffect'\)/);
  assert.match(source, /requireNativeView<GlassViewProps>\('ExpoGlassEffect', 'GlassView'\)/);
  assert.match(source, /function ViewerGlassSurface/);
  assert.match(source, /if \(NativeViewerGlassView\)/);
  assert.match(source, /return <View pointerEvents="none" style=\{surfaceStyle\}>/);
});

test('viewer shows a cached preview while loading an app-local original', () => {
  assert.match(source, /function ViewerPhoto/);
  assert.match(source, /const preview = usePreviewResource\(photo\)/);
  assert.match(source, /ensureDisplayPhotoUri\(photo\)/);
  assert.match(source, /onError=\{handleDisplayError\}/);
  assert.doesNotMatch(viewerSource, /source=\{\{ uri: item\.uri \}\}/);
});

test('viewer replaces an endless photo spinner with a retry action', () => {
  const photoSource = source.slice(
    source.indexOf('function ViewerPhoto('),
    source.indexOf('function ViewerAlternative(')
  );
  assert.match(photoSource, /const photoFailed =/);
  assert.match(photoSource, /preview\.failed/);
  assert.match(photoSource, /displayStatus === 'failed'/);
  assert.match(photoSource, /Не удалось загрузить фотографию/);
  assert.match(photoSource, /accessibilityLabel="Повторить загрузку"/);
  assert.match(photoSource, /onPress=\{retryPhoto\}/);
  assert.doesNotMatch(photoSource, /!previewUri && !displayUri \?/);
});

test('viewer zooms with two fingers and springs back when the gesture ends', () => {
  const photoSource = source.slice(
    source.indexOf('function ViewerPhoto('),
    source.indexOf('function ViewerAlternative(')
  );
  assert.match(viewerSource, /const viewerPinchResponder = useMemo\(\(\) => PanResponder\.create/);
  assert.match(viewerSource, /\.\.\.viewerPinchResponder\.panHandlers/);
  assert.match(viewerSource, /pinchDistance\(event\.nativeEvent\.touches\)/);
  assert.match(viewerSource, /transientPinchScale\(distance, pinchInitialDistance\.current\)/);
  assert.match(viewerSource, /onPanResponderEnd:[\s\S]*?touches\.length < 2[\s\S]*?resetViewerPinch\(\)/);
  assert.match(viewerSource, /onPanResponderRelease: finishViewerPinch/);
  assert.match(viewerSource, /onPanResponderTerminate: finishViewerPinch/);
  assert.match(viewerSource, /Animated\.spring\(pinchScale,[\s\S]*?toValue: 1/);
  assert.match(viewerSource, /!panel && !viewerPresentationBlurred/);
  assert.match(photoSource, /blurRadius=\{presentationBlurred \? 34/);
  assert.match(viewerSource, /const localFocalPoint = pinchFocalPoint\(event\.nativeEvent\.touches\)/);
  assert.match(viewerSource, /pinchInitialPageFocalPoint\.current = pinchPageFocalPoint\(event\.nativeEvent\.touches\)/);
  assert.match(viewerSource, /pinchTranslation\([\s\S]*?pinchInitialPageFocalPoint\.current[\s\S]*?pinchPageFocalPoint\(event\.nativeEvent\.touches\)/);
  assert.match(viewerSource, /pinchTranslateX\.setValue\(translation\.x\)/);
  assert.match(viewerSource, /pinchTranslateY\.setValue\(translation\.y\)/);
  assert.match(photoSource, /transform: \[[\s\S]*?translateX: pinchTranslateX[\s\S]*?translateY: pinchTranslateY[\s\S]*?scale: pinchScale/);
  assert.match(viewerSource, /Animated\.parallel\([\s\S]*?toValue: 0/);
  assert.match(photoSource, /transformOrigin: \[pinchOrigin\.x, pinchOrigin\.y, 0\]/);
  assert.doesNotMatch(photoSource, /PanResponder\.create|panHandlers|onLongPress|delayLongPress/);
});

test('viewer locks the photo pager for the whole pinch gesture', () => {
  assert.match(viewerSource, /const \[viewerPinching, setViewerPinching\] = useState\(false\)/);
  assert.match(viewerSource, /const viewerPinchingRef = useRef\(false\)/);
  assert.match(viewerSource, /const viewerSwipeInterruptedRef = useRef\(false\)/);
  assert.match(viewerSource, /scrollEnabled=\{!panel && !viewerPinching\}/);
  assert.match(viewerSource, /pinchScale=\{pinchScale\}/);
  assert.match(viewerSource, /listRef\.current\?\.setNativeProps\(\{ scrollEnabled: false \}\)/);
  assert.match(viewerSource, /scrollToOffset\(\{[\s\S]*?animated: false,[\s\S]*?offset: activeIndex \* width/);
});

test('a second touch interrupts an active photo swipe in favor of pinch zoom', () => {
  assert.match(viewerSource, /onStartShouldSetPanResponderCapture: \(event\) => shouldStartPinch\(/);
  assert.match(viewerSource, /onMoveShouldSetPanResponderCapture: \(event\) => shouldStartPinch\(/);
  assert.match(viewerSource, /onPanResponderGrant:[\s\S]*?handleViewerPinchChange\(true\)/);
  assert.match(viewerSource, /onPanResponderGrant:[\s\S]*?pinchInitialDistance\.current = pinchDistance/);
  assert.match(viewerSource, /onMomentumScrollEnd=\{\(event\) => \{[\s\S]*?viewerPinchingRef\.current \|\| viewerSwipeInterruptedRef\.current[\s\S]*?return;/);
  assert.match(viewerSource, /onScrollBeginDrag=\{\(\) => \{[\s\S]*?!viewerPinchingRef\.current[\s\S]*?viewerSwipeInterruptedRef\.current = false/);
});
