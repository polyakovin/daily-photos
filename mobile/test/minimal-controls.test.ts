import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('mobile command controls render icons with accessible names', () => {
  const viewerButton = source.slice(
    source.indexOf('function ViewerButton('),
    source.indexOf('function MobileToast(')
  );
  assert.match(viewerButton, /accessibilityLabel=/);
  assert.match(viewerButton, /<MobileIcon[^>]*name=\{icon\}/);
  assert.match(viewerButton, /!compact \? <Text/);
  assert.match(source, /accessibilityRole="tab"/);
});

test('main screen omits archive subtitle, folder statistics and manual refresh row', () => {
  assert.doesNotMatch(source, /ЛИЧНЫЙ ФОТОАРХИВ/);
  assert.doesNotMatch(source, /accessibilityLabel="Обновить фотоархив"/);
  assert.doesNotMatch(source, /style=\{styles\.sourceName\}/);
  assert.doesNotMatch(source, /index\.photoCount\} фото · \{index\.dates\.length\} дней/);
});

test('mobile icons come from the Expo Material Community icon pack', () => {
  assert.match(source, /@expo\/vector-icons\/MaterialCommunityIcons/);
  assert.match(source, /calendar-month-outline/);
  assert.match(source, /presentation: 'presentation-play'/);
  assert.doesNotMatch(source, /calendar: '▦'/);
});

test('presentation mode has a persistent accessible header button', () => {
  assert.match(source, /AsyncStorage\.getItem\(PRESENTATION_MODE_STORAGE_KEY\)/);
  assert.match(source, /AsyncStorage\.setItem\(PRESENTATION_MODE_STORAGE_KEY, String\(next\)\)/);
  assert.match(source, /accessibilityState=\{\{ selected: presentationMode \}\}/);
  assert.match(source, /name="presentation"/);
  assert.match(source, /<PresentationModeContext\.Provider value=\{presentationModeValue\}>/);
});

test('mobile actions use an overlay toast that does not shift the interface', () => {
  assert.match(source, /function MobileToast/);
  assert.match(source, /accessibilityLiveRegion="polite"/);
  assert.match(source, /position: 'absolute'/);
  assert.match(source, /showViewerMessage\([^)]*, true\)/);
});

test('calendar has a labeled today action that returns to the current date', () => {
  const calendarHeader = source.slice(
    source.indexOf('<View style={styles.monthHeader}>'),
    source.indexOf("{calendarFocus === 'month' || calendarFocus === 'week' ? (")
  );
  assert.match(source, /accessibilityLabel="Перейти к сегодняшней дате"/);
  assert.match(source, /<MobileIcon[^>]*name="today"/);
  assert.match(source, /<Text style=\{styles\.todayButtonText\}>Сегодня<\/Text>/);
  assert.match(calendarHeader, /style=\{styles\.monthTitle\}/);
  assert.match(calendarHeader, /styles\.todayButton/);
  assert.match(source, /const showToday = useCallback\(\(\) => \{[\s\S]*?setViewMonth\(new Date\(\)\)/);
  assert.match(source, /calendarFocus === 'years'\) setCalendarFocus\('month'\)/);
});

test('week calendar uses seven full-width horizontal rows across available height', () => {
  assert.match(source, /weekMode && styles\.weekCalendarGrid/);
  assert.match(source, /weekMode && styles\.weekCalendarRows/);
  assert.match(source, /weekCalendarRows: \{[\s\S]*?flexDirection: 'column'/);
  assert.match(source, /weekDayCell: \{[\s\S]*?width: '100%'/);
  assert.match(source, /\{calendarFocus === 'month' \? \(/);
  assert.match(source, /WEEK_DAY_FORMATTER\.format\(parsedDate\)/);
});

test('month fills the remaining height while week stays inside the screen', () => {
  assert.match(source, /const screenCalendar = appMode === 'calendar'[\s\S]*?calendarFocus === 'month'[\s\S]*?calendarFocus === 'week'/);
  assert.match(source, /screenCalendar && styles\.screenCalendarContent/);
  assert.match(source, /scrollEnabled=\{appMode !== 'map' && !screenCalendar\}/);
  assert.match(source, /screenCalendar && styles\.screenCalendarCard/);
  assert.match(source, /screenCalendarContent: \{[\s\S]*?flexGrow: 1,[\s\S]*?paddingBottom: 0/);
  assert.match(source, /screenCalendarCard: \{[\s\S]*?flex: 1,[\s\S]*?minHeight: 0/);
  assert.match(source, /calendarGrid: \{[\s\S]*?flex: 1,[\s\S]*?minHeight: 0/);
  assert.match(source, /calendarWeek: \{[\s\S]*?flex: 1,[\s\S]*?minHeight: 0/);
  assert.doesNotMatch(source, /Math\.max\(440, windowHeight - 225\)/);
});

test('map mode fills the remaining screen height', () => {
  assert.match(source, /<ScrollView[\s\S]*?style=\{styles\.mainContent\}/);
  assert.match(source, /mapContent: \{[\s\S]*?flexGrow: 1,[\s\S]*?paddingBottom: 0/);
  assert.match(source, /mapMode: \{[\s\S]*?flex: 1/);
  assert.doesNotMatch(source, /height=\{Math\.max\(260, windowHeight - 330\)\}/);
  assert.doesNotMatch(source, /<View style=\{\[styles\.mapMode, \{ height \}\]\}>/);
});
