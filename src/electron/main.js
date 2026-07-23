const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, nativeImage, nativeTheme, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { startPhotoDayServer } = require('../server');
const { embeddedPhotoDate } = require('../server/photo-indexer');
const { applicationEditMenu, contextMenuTemplate } = require('./edit-menu');
const {
  CONVERTIBLE_IMAGE_RE,
  STANDARD_IMAGE_RE,
  importPhotoFiles,
  isValidImportDate
} = require('./photo-importer');
const { automaticPhotoRoots } = require('./photo-search-roots');
const { createPhotoPreviewGenerator } = require('./photo-preview-cache');
const { createUpdateManager } = require('./update-manager');

const SETTINGS_FILE_NAME = 'settings.json';
const BIRTH_DATE_PATTERN = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
let mainWindow = null;
let photoDayServer = null;
let archivePath = '';
let sourceMode = 'folder';
let convertImages = false;
let birthDate = '';
let lastUpdateCheckAt = 0;
let navigationState = null;
let updateManager = null;

function settingsFile() {
  return path.join(app.getPath('userData'), SETTINGS_FILE_NAME);
}

function isValidBirthDate(value) {
  if (!BIRTH_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day
    && candidate.getTime() <= todayUtc;
}

function sanitizeNavigationState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 8192) return null;
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}

function readSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    return {
      archivePath: typeof parsed.archivePath === 'string' ? parsed.archivePath : '',
      sourceMode: parsed.sourceMode === 'computer' ? 'computer' : 'folder',
      convertImages: parsed.convertImages === true,
      birthDate: typeof parsed.birthDate === 'string' && isValidBirthDate(parsed.birthDate)
        ? parsed.birthDate
        : '',
      lastUpdateCheckAt: Number.isFinite(parsed.lastUpdateCheckAt) && parsed.lastUpdateCheckAt > 0
        ? parsed.lastUpdateCheckAt
        : 0,
      navigationState: sanitizeNavigationState(parsed.navigationState)
    };
  } catch {
    return {
      archivePath: '',
      sourceMode: 'folder',
      convertImages: false,
      birthDate: '',
      lastUpdateCheckAt: 0,
      navigationState: null
    };
  }
}

function writeSettings() {
  const target = settingsFile();
  const temporary = `${target}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    temporary,
    `${JSON.stringify({ archivePath, sourceMode, convertImages, birthDate, lastUpdateCheckAt, navigationState }, null, 2)}\n`,
    'utf8'
  );
  fs.renameSync(temporary, target);
}

function directoryExists(directory) {
  if (!directory) return false;
  try {
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

function photoSearchRoots() {
  return automaticPhotoRoots({
    platform: process.platform,
    homePath: app.getPath('home'),
    picturesPath: app.getPath('pictures')
  });
}

function archiveState({ canceled = false } = {}) {
  const isComputer = sourceMode === 'computer';
  const automaticRoots = isComputer ? photoSearchRoots() : [];
  const available = isComputer
    ? automaticRoots.some(directoryExists)
    : directoryExists(archivePath);
  return {
    canceled,
    configured: isComputer || Boolean(archivePath),
    available,
    mode: sourceMode,
    path: isComputer ? 'Pictures и фотопапки подключённых носителей' : archivePath,
    name: isComputer ? 'Автопоиск' : archivePath ? path.basename(archivePath) || archivePath : '',
    canReveal: !isComputer && available,
    canConvertImages: process.platform === 'darwin' && !isComputer && available,
    convertImages: process.platform === 'darwin' && !isComputer && convertImages
  };
}

async function chooseArchiveDirectory() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите папку с фотографиями и дневником',
    defaultPath: directoryExists(archivePath) ? archivePath : app.getPath('pictures'),
    buttonLabel: 'Выбрать папку',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return archiveState({ canceled: true });

  const previousArchivePath = archivePath;
  const previousSourceMode = sourceMode;
  const previousConvertImages = convertImages;
  try {
    const nextArchivePath = result.filePaths[0];
    const changedFolder = !archivePath || path.resolve(nextArchivePath) !== path.resolve(archivePath);
    archivePath = nextArchivePath;
    sourceMode = 'folder';
    if (changedFolder) convertImages = false;
    try {
      writeSettings();
    } catch (error) {
      archivePath = previousArchivePath;
      sourceMode = previousSourceMode;
      convertImages = previousConvertImages;
      throw error;
    }
    await photoDayServer.setContentSource({ mode: 'folder', roots: [archivePath], convertImages });
    return archiveState();
  } catch (error) {
    archivePath = previousArchivePath;
    sourceMode = previousSourceMode;
    convertImages = previousConvertImages;
    try { writeSettings(); } catch {}
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Не удалось проиндексировать папку',
      message: 'Приложение не смогло найти и прочитать изображения.',
      detail: error.message
    });
    return { ...archiveState(), error: error.message };
  }
}

async function scanPhotoLocations() {
  const previousArchivePath = archivePath;
  const previousSourceMode = sourceMode;
  const previousConvertImages = convertImages;
  try {
    archivePath = '';
    sourceMode = 'computer';
    convertImages = false;
    writeSettings();
    const roots = photoSearchRoots();
    if (!roots.length) throw new Error('Не найдены доступные папки для автоматического поиска');
    await photoDayServer.setContentSource({ mode: 'computer', roots });
    return archiveState();
  } catch (error) {
    archivePath = previousArchivePath;
    sourceMode = previousSourceMode;
    convertImages = previousConvertImages;
    try { writeSettings(); } catch {}
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Не удалось найти фотографии',
      message: 'Поиск изображений не удалось завершить.',
      detail: error.message
    });
    return { ...archiveState(), error: error.message };
  }
}

async function setArchiveConversion(enabled) {
  if (typeof enabled !== 'boolean') throw new Error('Неверное значение настройки конвертации');
  if (process.platform !== 'darwin') throw new Error('Конвертация из приложения пока доступна только на macOS');
  if (sourceMode !== 'folder' || !directoryExists(archivePath)) {
    throw new Error('Конвертация доступна только для выбранной папки');
  }
  if (enabled && !convertImages) {
    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Конвертировать и заменять оригиналы?',
      message: 'Поддерживаемые изображения будут заменены файлами WebP.',
      detail: 'Исходный JPG, PNG, GIF, AVIF, HEIC или HEIF удаляется только после создания и проверки WebP. Перед включением рекомендуется сделать резервную копию папки.',
      buttons: ['Конвертировать и заменить', 'Отмена'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });
    if (confirmation.response !== 0) return archiveState({ canceled: true });
  }

  const previousConvertImages = convertImages;
  convertImages = enabled;
  try {
    writeSettings();
    photoDayServer.setConvertImages(convertImages);
  } catch (error) {
    convertImages = previousConvertImages;
    try {
      writeSettings();
      photoDayServer.setConvertImages(convertImages);
    } catch {}
    throw error;
  }

  if (convertImages) {
    const converted = await photoDayServer.reindex();
    if (!converted) {
      return {
        ...archiveState(),
        error: photoDayServer.lastOperationError
          || 'Не удалось конвертировать все файлы; оригиналы сохранены.'
      };
    }
  }
  return archiveState();
}

async function importDroppedPhotos(filePaths, date) {
  if (sourceMode !== 'folder' || !directoryExists(archivePath)) {
    throw new Error('Чтобы добавлять фотографии, сначала выберите одну папку архива');
  }

  const imported = await importPhotoFiles({
    archivePath,
    filePaths,
    date,
    allowConvertibleFormats: process.platform === 'darwin' && convertImages
  });
  const indexed = await photoDayServer.reindex();
  return {
    date,
    imported: imported.map(({ name, destinationPath }) => ({ name, destinationPath })),
    indexed,
    warning: indexed
      ? ''
      : photoDayServer.lastOperationError || 'Файлы сохранены, но индекс архива не обновился'
  };
}

async function suggestDroppedPhotoDate(filePaths) {
  if (!Array.isArray(filePaths) || !filePaths.length || filePaths.length > 100) return '';
  for (const filePath of filePaths) {
    if (
      typeof filePath !== 'string'
      || !path.isAbsolute(filePath)
      || (!STANDARD_IMAGE_RE.test(filePath) && !CONVERTIBLE_IMAGE_RE.test(filePath))
    ) continue;
    try {
      if (!(await fs.promises.stat(filePath)).isFile()) continue;
      const date = await embeddedPhotoDate(filePath);
      if (date && isValidImportDate(date)) return date;
    } catch {
      // Нечитаемый файл будет отклонён при импорте; для подсказки используем следующий.
    }
  }
  return '';
}

function installIpcHandlers() {
  ipcMain.handle('archive:get-state', () => archiveState());
  ipcMain.handle('archive:choose-directory', chooseArchiveDirectory);
  ipcMain.handle('archive:scan-photo-locations', scanPhotoLocations);
  ipcMain.handle('archive:set-convert-images', (_event, enabled) => setArchiveConversion(enabled));
  ipcMain.handle('archive:suggest-photo-date', (_event, filePaths) => suggestDroppedPhotoDate(filePaths));
  ipcMain.handle('archive:import-photos', (_event, filePaths, date) => importDroppedPhotos(filePaths, date));
  ipcMain.handle('archive:reveal-directory', async () => {
    if (sourceMode !== 'folder' || !directoryExists(archivePath)) return false;
    const error = await shell.openPath(archivePath);
    return !error;
  });
  ipcMain.handle('profile:get-birth-date', () => birthDate);
  ipcMain.handle('profile:set-birth-date', (_event, value) => {
    if (typeof value !== 'string' || (value && !isValidBirthDate(value))) {
      throw new Error('Дата рождения должна быть корректной и не позже сегодня');
    }
    const previousBirthDate = birthDate;
    birthDate = value;
    try {
      writeSettings();
    } catch (error) {
      birthDate = previousBirthDate;
      throw error;
    }
    return birthDate;
  });
  ipcMain.handle('ui:get-navigation-state', () => navigationState);
  ipcMain.handle('ui:set-navigation-state', (_event, value) => {
    const nextNavigationState = sanitizeNavigationState(value);
    if (!nextNavigationState) throw new Error('Некорректное состояние интерфейса');
    const previousNavigationState = navigationState;
    navigationState = nextNavigationState;
    try {
      writeSettings();
    } catch (error) {
      navigationState = previousNavigationState;
      throw error;
    }
    return navigationState;
  });
}

function buildApplicationMenu() {
  const template = [];
  const checkForUpdatesItem = {
    label: 'Проверить обновления…',
    click: () => { void updateManager?.checkNow(); }
  };
  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        checkForUpdatesItem,
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }
  template.push(
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Источник фотографий…',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('archive:request-settings')
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ]
    },
    applicationEditMenu(),
    {
      label: 'Вид',
      submenu: [
        { role: 'reload' },
        { role: 'togglefullscreen' }
      ]
    }
  );
  if (process.platform !== 'darwin') {
    template.push({
      label: 'Справка',
      submenu: [checkForUpdatesItem]
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 940,
    minHeight: 650,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1512' : '#f3efe5',
    title: 'Фото дня',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate(contextMenuTemplate(params, {
      copyImage: (x, y) => mainWindow?.webContents.copyImageAt(x, y),
      copyLink: (url) => clipboard.writeText(url),
      openLink: (url) => {
        void shell.openExternal(url).catch((error) => {
          console.error(`Не удалось открыть ссылку: ${error.message}`);
        });
      }
    }));
    menu.popup({
      window: mainWindow,
      frame: params.frame || undefined,
      sourceType: params.menuSourceType
    });
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).origin !== new URL(photoDayServer.url).origin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(photoDayServer.url);
}

async function startApplication() {
  const settings = readSettings();
  archivePath = settings.archivePath;
  sourceMode = settings.sourceMode;
  convertImages = process.platform === 'darwin' && sourceMode === 'folder' && settings.convertImages;
  birthDate = settings.birthDate;
  lastUpdateCheckAt = settings.lastUpdateCheckAt;
  navigationState = settings.navigationState;
  const emptyArchive = path.join(app.getPath('userData'), 'empty-archive');
  fs.mkdirSync(emptyArchive, { recursive: true });
  const configuredFolderAvailable = sourceMode === 'folder' && directoryExists(archivePath);
  const initialArchive = configuredFolderAvailable ? archivePath : emptyArchive;
  const automaticRoots = sourceMode === 'computer' ? photoSearchRoots() : [];
  const roots = sourceMode === 'computer' && automaticRoots.length ? automaticRoots : [initialArchive];
  const indexedPreviewGenerator = createPhotoPreviewGenerator({ nativeImage });

  photoDayServer = await startPhotoDayServer({
    contentRoot: initialArchive,
    stateRoot: app.getPath('userData'),
    convertImages: configuredFolderAvailable && convertImages,
    metadataIndex: true,
    indexedPreviewGenerator,
    mode: sourceMode,
    roots,
    port: 0
  });
  updateManager = createUpdateManager({
    app,
    autoUpdater,
    dialog,
    getWindow: () => mainWindow,
    getLastCheckAt: () => lastUpdateCheckAt,
    setLastCheckAt: (value) => {
      lastUpdateCheckAt = value;
      writeSettings();
    }
  });
  installIpcHandlers();
  buildApplicationMenu();
  await createWindow();
  updateManager.start();
  if (archiveState().available && (convertImages || !photoDayServer.hasCachedIndex)) {
    photoDayServer.reindex()
      .then(() => {
        if (!photoDayServer.lastOperationError && !photoDayServer.lastOperationWarning) {
          mainWindow?.webContents.reload();
        }
      })
      .catch((error) => {
        console.error(`Не удалось создать индекс фотографий: ${error.message}`);
      });
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(startApplication).catch((error) => {
    dialog.showErrorBox('Не удалось запустить «Фото дня»', error.message);
    app.quit();
  });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && photoDayServer) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  updateManager?.stop();
  photoDayServer?.close().catch(() => {});
});
