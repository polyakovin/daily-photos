function applicationEditMenu() {
  return {
    label: 'Правка',
    submenu: [
      { label: 'Отменить', role: 'undo' },
      { label: 'Повторить', role: 'redo' },
      { type: 'separator' },
      { label: 'Вырезать', role: 'cut' },
      { label: 'Копировать', role: 'copy' },
      { label: 'Вставить', role: 'paste' },
      { label: 'Вставить без форматирования', role: 'pasteAndMatchStyle' },
      { label: 'Удалить', role: 'delete' },
      { type: 'separator' },
      { label: 'Выделить всё', role: 'selectAll' }
    ]
  };
}

function appendMenuSection(template, items) {
  if (!items.length) return;
  if (template.length) template.push({ type: 'separator' });
  template.push(...items);
}

function contextMenuTemplate(params, actions) {
  const template = [];
  const editFlags = params.editFlags || {};

  if (params.isEditable) {
    appendMenuSection(template, [
      { label: 'Отменить', role: 'undo', enabled: Boolean(editFlags.canUndo) },
      { label: 'Повторить', role: 'redo', enabled: Boolean(editFlags.canRedo) }
    ]);
    appendMenuSection(template, [
      { label: 'Вырезать', role: 'cut', enabled: Boolean(editFlags.canCut) },
      { label: 'Копировать', role: 'copy', enabled: Boolean(editFlags.canCopy) },
      { label: 'Вставить', role: 'paste', enabled: Boolean(editFlags.canPaste) },
      { label: 'Удалить', role: 'delete', enabled: Boolean(editFlags.canDelete) }
    ]);
    appendMenuSection(template, [
      { label: 'Выделить всё', role: 'selectAll', enabled: Boolean(editFlags.canSelectAll) }
    ]);
  } else if (params.selectionText) {
    appendMenuSection(template, [
      { label: 'Копировать', role: 'copy', enabled: true }
    ]);
  }

  if (params.mediaType === 'image' && params.hasImageContents) {
    appendMenuSection(template, [
      { label: 'Копировать изображение', click: () => actions.copyImage(params.x, params.y) }
    ]);
  }

  if (/^https?:\/\//i.test(params.linkURL || '')) {
    appendMenuSection(template, [
      { label: 'Открыть ссылку в браузере', click: () => actions.openLink(params.linkURL) },
      { label: 'Копировать адрес ссылки', click: () => actions.copyLink(params.linkURL) }
    ]);
  }

  if (!template.length) {
    template.push({ label: 'Обновить', role: 'reload' });
  }
  return template;
}

module.exports = {
  applicationEditMenu,
  contextMenuTemplate
};
