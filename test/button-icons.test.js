const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  ICONS,
  STATIC_BUTTONS,
  setIconButton
} = require('../src/renderer/button-icons');

test('реестр управляющих кнопок использует известные иконки и доступные подписи', () => {
  const selectors = new Set();
  for (const definition of STATIC_BUTTONS) {
    assert.ok(definition.selector);
    assert.ok(ICONS[definition.icon], `${definition.selector} uses ${definition.icon}`);
    assert.ok(definition.label.trim(), `${definition.selector} has a label`);
    assert.equal(selectors.has(definition.selector), false, `${definition.selector} is unique`);
    selectors.add(definition.selector);
  }

  for (const selector of [
    '#archiveSettingsButton',
    '[data-view="calendar"]',
    '#todayButton',
    '#mapPlaybackButton',
    '#mapPlaceSave',
    '#randomToggle',
    '#photoImportSubmit',
    '#viewerLocationSave',
    '#viewerDiarySave',
    '#viewerDateSave',
    '#viewerTrashButton',
    '#viewerMonthHighlight',
    '#nextPhoto'
  ]) {
    assert.ok(selectors.has(selector), `${selector} is covered`);
  }
});

test('в HTML без иконки остаются только содержательные кнопки выбора и превью', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const buttonIds = [...html.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)]
    .map((match) => match[1]);
  const registry = STATIC_BUTTONS.map((definition) => definition.selector).join('\n');
  const uncovered = buttonIds.filter((id) => !registry.includes(`#${id}`));

  assert.deepEqual(uncovered, [
    'mapAssignmentPreview',
    'mapPhotoPreview',
    'archiveChooseButton',
    'archiveComputerButton',
    'viewerMiniMapOpen'
  ]);
});

test('иконка кнопки синхронизирует SVG, тултип и доступное имя', () => {
  const attributes = new Map();
  const classes = new Set();
  const iconClasses = new Set();
  const document = {
    createElementNS() {
      return {
        classList: { add: (...values) => values.forEach((value) => iconClasses.add(value)) },
        setAttribute: (name, value) => attributes.set(`svg:${name}`, value),
        set innerHTML(value) { this.markup = value; }
      };
    }
  };
  const button = {
    ownerDocument: document,
    classList: { add: (...values) => values.forEach((value) => classes.add(value)) },
    dataset: {},
    setAttribute: (name, value) => attributes.set(name, value),
    replaceChildren(icon) { this.icon = icon; }
  };

  setIconButton(button, {
    icon: 'spinner',
    label: 'Сохраняем…',
    tooltip: 'Сохранение заметки'
  });

  assert.ok(classes.has('app-icon-button'));
  assert.ok(iconClasses.has('app-button-icon'));
  assert.ok(iconClasses.has('is-spinning'));
  assert.equal(button.dataset.icon, 'spinner');
  assert.equal(button.dataset.tooltip, 'Сохранение заметки');
  assert.equal(attributes.get('aria-label'), 'Сохраняем…');
  assert.equal(button.title, 'Сохраняем…');
  assert.equal(attributes.get('svg:viewBox'), '0 0 24 24');
});
