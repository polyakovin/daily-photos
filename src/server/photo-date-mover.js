const fs = require('node:fs');
const path = require('node:path');
const {
  archiveRetargetDestination,
  detectArchiveStyle,
  normalizeArchiveStyle
} = require('../electron/photo-archive-style');
const {
  importOverrideKey,
  readPhotoImportConfig,
  writePhotoImportConfig
} = require('./import-date-overrides');

async function resolvedArchiveStyle(archivePath, configuredStyle) {
  let style = normalizeArchiveStyle(configuredStyle);
  if (!style || style.type === 'year-month-day-name') {
    const detectedStyle = await detectArchiveStyle(archivePath);
    if (!style || detectedStyle.type === 'year-month-day-file') style = detectedStyle;
  }
  return style;
}

async function availableDestination(directory, stem, extension, sourcePath) {
  for (let sequence = 1; sequence <= 9999; sequence += 1) {
    const suffix = sequence === 1 ? '' : ` (${sequence})`;
    const candidate = path.join(directory, `${stem}${suffix}${extension}`);
    if (path.resolve(candidate) === path.resolve(sourcePath)) return candidate;
    try {
      await fs.promises.access(candidate, fs.constants.F_OK);
    } catch (error) {
      if (error.code === 'ENOENT') return candidate;
      throw error;
    }
  }
  throw new Error(`Не удалось подобрать свободное имя для «${path.basename(sourcePath)}»`);
}

async function moveWithoutOverwrite(sourcePath, destinationPath) {
  try {
    await fs.promises.link(sourcePath, destinationPath);
  } catch (error) {
    if (!['EXDEV', 'EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
    await fs.promises.copyFile(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
    const stats = await fs.promises.stat(sourcePath);
    await fs.promises.chmod(destinationPath, stats.mode);
    await fs.promises.utimes(destinationPath, stats.atime, stats.mtime);
  }
  try {
    await fs.promises.unlink(sourcePath);
  } catch (error) {
    await fs.promises.unlink(destinationPath).catch(() => {});
    throw error;
  }
}

async function movePhotoToDate({ archivePath, filePath, date }) {
  const root = path.resolve(archivePath);
  const sourcePath = path.resolve(filePath);
  if (!sourcePath.startsWith(`${root}${path.sep}`)) {
    throw new Error('Фотография находится вне выбранной папки');
  }
  const sourceStats = await fs.promises.stat(sourcePath);
  if (!sourceStats.isFile()) throw new Error('Оригинал фотографии больше не существует');

  const previousConfig = readPhotoImportConfig(root);
  const style = await resolvedArchiveStyle(root, previousConfig.style);
  const destination = archiveRetargetDestination(style, date, sourcePath);
  const destinationDirectory = path.join(root, ...destination.directoryParts);
  await fs.promises.mkdir(destinationDirectory, { recursive: true });
  const destinationPath = await availableDestination(
    destinationDirectory,
    destination.stem,
    path.extname(sourcePath).toLowerCase(),
    sourcePath
  );
  if (destinationPath === sourcePath) {
    return { sourcePath, destinationPath, previousConfig, unchanged: true };
  }

  await moveWithoutOverwrite(sourcePath, destinationPath);
  const nextOverrides = new Map(previousConfig.overrides);
  const sourceKey = importOverrideKey(root, sourcePath);
  const destinationKey = importOverrideKey(root, destinationPath);
  if (!sourceKey || !destinationKey) {
    await moveWithoutOverwrite(destinationPath, sourcePath);
    throw new Error('Не удалось сохранить новый путь фотографии');
  }
  nextOverrides.delete(sourceKey);
  nextOverrides.set(destinationKey, date);
  try {
    writePhotoImportConfig(root, { style, overrides: nextOverrides });
  } catch (error) {
    await moveWithoutOverwrite(destinationPath, sourcePath).catch(() => {});
    throw error;
  }
  return { sourcePath, destinationPath, previousConfig, unchanged: false };
}

async function rollbackPhotoDateMove(archivePath, move) {
  if (!move || move.unchanged) return;
  await fs.promises.mkdir(path.dirname(move.sourcePath), { recursive: true });
  await moveWithoutOverwrite(move.destinationPath, move.sourcePath);
  writePhotoImportConfig(archivePath, move.previousConfig);
}

module.exports = {
  movePhotoToDate,
  rollbackPhotoDateMove
};
