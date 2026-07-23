const assert = require('node:assert/strict');
const test = require('node:test');
const {
  applicationEditMenu,
  contextMenuTemplate
} = require('../src/electron/edit-menu');

const emptyActions = {
  copyImage: () => {},
  copyLink: () => {},
  openLink: () => {}
};

test('меню Правка регистрирует стандартные команды редактирования', () => {
  const menu = applicationEditMenu();
  assert.equal(menu.label, 'Правка');
  assert.deepEqual(
    menu.submenu.filter((item) => item.role).map((item) => item.role),
    ['undo', 'redo', 'cut', 'copy', 'paste', 'pasteAndMatchStyle', 'delete', 'selectAll']
  );
});

test('контекстное меню поля учитывает доступные команды', () => {
  const menu = contextMenuTemplate({
    isEditable: true,
    selectionText: 'текст',
    linkURL: '',
    mediaType: 'none',
    hasImageContents: false,
    editFlags: {
      canUndo: true,
      canRedo: false,
      canCut: true,
      canCopy: true,
      canPaste: false,
      canDelete: true,
      canSelectAll: true
    }
  }, emptyActions);

  const itemsByRole = new Map(menu.filter((item) => item.role).map((item) => [item.role, item]));
  assert.equal(itemsByRole.get('undo').enabled, true);
  assert.equal(itemsByRole.get('redo').enabled, false);
  assert.equal(itemsByRole.get('copy').enabled, true);
  assert.equal(itemsByRole.get('paste').enabled, false);
  assert.equal(itemsByRole.get('selectAll').enabled, true);
});

test('контекстное меню поддерживает выделение, изображения и внешние ссылки', () => {
  const calls = [];
  const menu = contextMenuTemplate({
    x: 42,
    y: 84,
    isEditable: false,
    selectionText: 'подпись',
    linkURL: 'https://example.com/photo',
    mediaType: 'image',
    hasImageContents: true,
    editFlags: {}
  }, {
    copyImage: (x, y) => calls.push(['image', x, y]),
    copyLink: (url) => calls.push(['copy-link', url]),
    openLink: (url) => calls.push(['open-link', url])
  });

  menu.find((item) => item.label === 'Копировать изображение').click();
  menu.find((item) => item.label === 'Открыть ссылку в браузере').click();
  menu.find((item) => item.label === 'Копировать адрес ссылки').click();
  assert.deepEqual(calls, [
    ['image', 42, 84],
    ['open-link', 'https://example.com/photo'],
    ['copy-link', 'https://example.com/photo']
  ]);
  assert.equal(menu.some((item) => item.role === 'copy'), true);
});

test('на свободном месте контекстное меню предлагает обновить страницу', () => {
  assert.deepEqual(contextMenuTemplate({
    isEditable: false,
    selectionText: '',
    linkURL: '',
    mediaType: 'none',
    hasImageContents: false,
    editFlags: {}
  }, emptyActions), [
    { label: 'Обновить', role: 'reload' }
  ]);
});
