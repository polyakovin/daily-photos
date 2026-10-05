const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');

function importDialogContext(convertImages) {
  const context = vm.createContext({
    desktopArchiveState: { name: 'Test archive', convertImages },
    desktopBridge: {
      getPathForFile: (file) => file.path,
      suggestPhotoDate: async () => ''
    },
    pendingPhotoImportPaths: [],
    photoImportSuggestionSequence: 0,
    photoCountLabel: (count) => `${count} фотографий`,
    localDateKey: () => '2026-10-05',
    visibleCalendarImportDate: () => null,
    photoImportDatePicker: {
      value: '',
      setMax() {},
      setValue(value) { this.value = value; },
      focus() {}
    },
    photoImportSummary: {},
    photoImportDateHint: {},
    photoImportError: {},
    photoImportSubmit: {},
    photoImportCancel: {},
    photoImportClose: {},
    photoImportDialog: {
      open: false,
      showModal() { this.open = true; }
    },
    setIconButton() {}
  });
  for (const name of ['droppedFileIsSupported', 'showPhotoImportDialog']) {
    const source = appSource.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0];
    assert.ok(source, `${name} exists`);
    vm.runInContext(source, context);
  }
  return context;
}

test('HEIC/HEIF can be submitted regardless of the archive conversion setting', async () => {
  for (const convertImages of [false, true]) {
    const context = importDialogContext(convertImages);
    const files = [
      { name: 'photo.HEIC', path: '/photos/photo.HEIC' },
      { name: 'second.heif', path: '/photos/second.heif' },
      { name: 'third.jpg', path: '/photos/third.jpg' }
    ];

    await context.showPhotoImportDialog(files);

    assert.deepEqual(Array.from(context.pendingPhotoImportPaths), files.map(({ path: filePath }) => filePath));
    assert.equal(context.photoImportSubmit.disabled, false);
    assert.equal(context.photoImportError.hidden, true);
    assert.equal(context.photoImportDialog.open, true);
    assert.match(context.photoImportSummary.textContent, /автоматически конвертированы/);
    assert.match(context.photoImportSummary.textContent, /исходные файлы сохранятся/);
  }
});

test('unsupported files are still skipped while a HEIC remains available to save', async () => {
  const context = importDialogContext(false);

  await context.showPhotoImportDialog([
    { name: 'photo.heic', path: '/photos/photo.heic' },
    { name: 'notes.txt', path: '/photos/notes.txt' }
  ]);

  assert.deepEqual(Array.from(context.pendingPhotoImportPaths), ['/photos/photo.heic']);
  assert.equal(context.photoImportSubmit.disabled, false);
  assert.match(context.photoImportError.textContent, /Пропущено файлов: 1/);
});
