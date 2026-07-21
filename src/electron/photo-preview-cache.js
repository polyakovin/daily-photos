const fs = require('fs');
const path = require('path');

const DEFAULT_PREVIEW_SIZE = 480;
const DEFAULT_PREVIEW_QUALITY = 72;
const DEFAULT_CONCURRENCY = 2;

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function createPhotoPreviewGenerator({
  nativeImage,
  size = DEFAULT_PREVIEW_SIZE,
  quality = DEFAULT_PREVIEW_QUALITY,
  concurrency = DEFAULT_CONCURRENCY
} = {}) {
  if (typeof nativeImage?.createThumbnailFromPath !== 'function') {
    throw new TypeError('Для создания превью требуется Electron nativeImage');
  }

  const previewSize = positiveInteger(size, DEFAULT_PREVIEW_SIZE);
  const jpegQuality = Math.min(100, positiveInteger(quality, DEFAULT_PREVIEW_QUALITY));
  const workerCount = positiveInteger(concurrency, DEFAULT_CONCURRENCY);
  const queue = [];
  let activeWorkers = 0;
  let temporarySequence = 0;

  async function generate(sourcePath, destinationPath) {
    const thumbnail = await nativeImage.createThumbnailFromPath(sourcePath, {
      width: previewSize,
      height: previewSize
    });
    if (!thumbnail || thumbnail.isEmpty()) {
      throw new Error(`Не удалось декодировать изображение: ${sourcePath}`);
    }

    const contents = thumbnail.toJPEG(jpegQuality);
    if (!Buffer.isBuffer(contents) || contents.length === 0) {
      throw new Error(`Не удалось закодировать превью: ${sourcePath}`);
    }

    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
    temporarySequence += 1;
    const temporaryPath = path.join(
      path.dirname(destinationPath),
      `.${path.basename(destinationPath)}.${process.pid}-${temporarySequence}.tmp`
    );

    try {
      await fs.promises.writeFile(temporaryPath, contents);
      await fs.promises.rename(temporaryPath, destinationPath);
    } catch (error) {
      await fs.promises.unlink(temporaryPath).catch(() => {});
      throw error;
    }
  }

  function drainQueue() {
    while (activeWorkers < workerCount && queue.length) {
      const job = queue.shift();
      activeWorkers += 1;
      generate(job.sourcePath, job.destinationPath)
        .then(job.resolve, job.reject)
        .finally(() => {
          activeWorkers -= 1;
          drainQueue();
        });
    }
  }

  return (sourcePath, destinationPath) => new Promise((resolve, reject) => {
    queue.push({ sourcePath, destinationPath, resolve, reject });
    drainQueue();
  });
}

module.exports = {
  DEFAULT_CONCURRENCY,
  DEFAULT_PREVIEW_QUALITY,
  DEFAULT_PREVIEW_SIZE,
  createPhotoPreviewGenerator
};
