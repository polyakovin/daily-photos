const path = require('node:path');

const PHOTO_ID_RE = /^[a-f0-9]{32}$/;

function createPhotoTrashHandler({
  dialog,
  shell,
  getServer,
  getWindow = () => null
}) {
  return async function trashPhoto(photoId) {
    if (typeof photoId !== 'string' || !PHOTO_ID_RE.test(photoId)) {
      throw new Error('Некорректный идентификатор фотографии');
    }

    const server = getServer?.();
    const filePath = server?.getPhotoFilePath?.(photoId);
    if (!filePath) throw new Error('Фотография не найдена или уже удалена');

    const confirmation = await dialog.showMessageBox(getWindow(), {
      type: 'warning',
      title: 'Переместить фотографию в Корзину?',
      message: `«${path.basename(filePath)}» будет перемещена в Корзину.`,
      detail: `${filePath}\n\nФотографию можно будет восстановить средствами системы.`,
      buttons: ['Переместить в Корзину', 'Отмена'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });
    if (confirmation.response !== 0) {
      return { canceled: true, deleted: false, indexed: false, warning: '' };
    }

    await shell.trashItem(filePath);
    let indexed = false;
    try {
      indexed = Boolean(await server.reindex());
    } catch {
      // Файл уже в Корзине; интерфейс должен сообщить об этом даже при сбое индекса.
    }
    return {
      canceled: false,
      deleted: true,
      indexed,
      warning: indexed
        ? ''
        : 'Файл перемещён в Корзину, но индекс архива не удалось обновить'
    };
  };
}

module.exports = { createPhotoTrashHandler };
