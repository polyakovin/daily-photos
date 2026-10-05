import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const calendar = source.slice(source.indexOf('function DaysCalendar('), source.indexOf('function YearsCalendar('));
const editor = source.slice(source.indexOf('function DiaryEntryModal('), source.indexOf('function PhotoViewer('));

test('calendar provides a labeled entry action and opens empty days without requiring a photo', () => {
  assert.match(source, /accessibilityLabel="Добавить текстовую запись"/);
  assert.match(source, />Добавить запись<\/Text>/);
  assert.doesNotMatch(calendar, /disabled=\{!photo\}/);
  assert.match(calendar, /onPress=\{\(\) => onSelectDate\(cell.date\)\}/);
  assert.match(calendar, /onLongPress=\{\(\) => onEditDiary\(cell.date\)\}/);
  assert.match(source, /if \(index.byDate.has\(date\)\) setViewerSelection\(\{ date \}\);\s*else if \(!metadataWarning\) setDiarySelection\(\{ date \}\)/);
});

test('standalone entry editor writes the selected day and preserves the draft on save errors', () => {
  assert.doesNotMatch(editor, /activePhoto|photos\[/);
  assert.match(editor, /saveDiaryEntry\(entryDate, draft/);
  assert.match(editor, /onRequestClose=\{\(\) => void persist\(true\)\}/);
  assert.match(editor, /if \(saving.current\) return false/);
  assert.match(editor, /catch \(diaryError\) \{\s*setStatus\(errorMessage\(diaryError\)\);\s*return false/);
});

test('viewer note action has a visible text label alongside its accessible name', () => {
  assert.match(source, /icon="note"\s*label=\{diary \? 'Показать заметку' : 'Добавить заметку'\}\s*showLabel/);
  assert.match(source, /showLabel \? <Text style=\{viewerStyles.glassButtonLabel\}>Запись<\/Text>/);
});
