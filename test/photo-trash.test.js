const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createPhotoTrashHandler } = require('../src/electron/photo-trash');

const PHOTO_ID = 'a'.repeat(32);

test('photo trash asks for confirmation, moves the original to Trash, and refreshes the index', async () => {
  const calls = [];
  const filePath = path.resolve('/photos/2024-07-21.jpg');
  const trashPhoto = createPhotoTrashHandler({
    dialog: {
      showMessageBox: async (_window, options) => {
        calls.push(['confirm', options]);
        return { response: 0 };
      }
    },
    shell: {
      trashItem: async (value) => calls.push(['trash', value])
    },
    getWindow: () => ({ id: 'main-window' }),
    getServer: () => ({
      getPhotoFilePath: (photoId) => photoId === PHOTO_ID ? filePath : '',
      reindex: async () => {
        calls.push(['reindex']);
        return true;
      }
    })
  });

  const result = await trashPhoto(PHOTO_ID);

  assert.deepEqual(result, { canceled: false, deleted: true, indexed: true, warning: '' });
  assert.deepEqual(calls.map(([type]) => type), ['confirm', 'trash', 'reindex']);
  assert.equal(calls[1][1], filePath);
  assert.match(calls[0][1].message, /2024-07-21\.jpg/);
  assert.equal(calls[0][1].detail.includes(filePath), true);
  assert.equal(calls[0][1].defaultId, 1);
  assert.equal(calls[0][1].cancelId, 1);
});

test('photo trash leaves the original untouched when confirmation is canceled', async () => {
  let trashed = false;
  const trashPhoto = createPhotoTrashHandler({
    dialog: { showMessageBox: async () => ({ response: 1 }) },
    shell: { trashItem: async () => { trashed = true; } },
    getServer: () => ({
      getPhotoFilePath: () => path.resolve('/photos/2024-07-21.jpg'),
      reindex: async () => true
    })
  });

  assert.deepEqual(await trashPhoto(PHOTO_ID), {
    canceled: true,
    deleted: false,
    indexed: false,
    warning: ''
  });
  assert.equal(trashed, false);
});

test('photo trash reports a moved file when refreshing the index fails', async () => {
  const trashPhoto = createPhotoTrashHandler({
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    shell: { trashItem: async () => {} },
    getServer: () => ({
      getPhotoFilePath: () => path.resolve('/photos/2024-07-21.jpg'),
      reindex: async () => { throw new Error('index failed'); }
    })
  });

  assert.deepEqual(await trashPhoto(PHOTO_ID), {
    canceled: false,
    deleted: true,
    indexed: false,
    warning: 'Файл перемещён в Корзину, но индекс архива не удалось обновить'
  });
});

test('photo trash rejects stale or invalid photo identifiers before confirmation', async () => {
  let confirmed = false;
  const trashPhoto = createPhotoTrashHandler({
    dialog: {
      showMessageBox: async () => {
        confirmed = true;
        return { response: 0 };
      }
    },
    shell: { trashItem: async () => {} },
    getServer: () => ({ getPhotoFilePath: () => '', reindex: async () => true })
  });

  await assert.rejects(trashPhoto('invalid'), /Некорректный идентификатор/);
  await assert.rejects(trashPhoto(PHOTO_ID), /Фотография не найдена/);
  assert.equal(confirmed, false);
});

test('photo trash is exposed through matching main and preload IPC contracts', () => {
  const mainSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'electron', 'main.js'),
    'utf8'
  );
  const preloadSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'electron', 'preload.js'),
    'utf8'
  );

  assert.match(mainSource, /ipcMain\.handle\('archive:trash-photo',[\s\S]*?trashPhoto\(photoId\)/);
  assert.match(preloadSource, /trashPhoto:\s*\(photoId\)\s*=>\s*ipcRenderer\.invoke\('archive:trash-photo', photoId\)/);
});

test('photo viewer renders and wires the Trash action', () => {
  const rendererRoot = path.join(__dirname, '..', 'src', 'renderer');
  const html = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(rendererRoot, 'styles.css'), 'utf8');

  assert.match(html, /id="viewerTrashButton"/);
  assert.match(script, /trashViewerPhoto/);
  assert.match(script, /desktopBridge\.trashPhoto\(photo\.id\)/);
  assert.match(styles, /\.viewer-trash-button/);
});
