const path = require('path');

const FILE_PROTOCOL_PATTERN = /^PHOTO_DAY_FILE\s+(processing|converted|skipped|replaced|failed)\s+([0-9a-f]+)$/;
const PROGRESS_PROTOCOL_PATTERN = /^PHOTO_DAY_PROGRESS\s+(conversion|previews)\s+(\d+)\s+(\d+)$/;

function parseConversionProtocolLine(line) {
  const progressMatch = line.match(PROGRESS_PROTOCOL_PATTERN);
  if (progressMatch) {
    return {
      type: 'progress',
      phase: progressMatch[1],
      completed: Number(progressMatch[2]),
      total: Number(progressMatch[3])
    };
  }

  const fileMatch = line.match(FILE_PROTOCOL_PATTERN);
  if (!fileMatch || fileMatch[2].length % 2 !== 0) return null;
  return {
    type: 'file',
    status: fileMatch[1],
    filePath: Buffer.from(fileMatch[2], 'hex').toString('utf8')
  };
}

function displayConversionPath(filePath, root) {
  const relativePath = path.relative(root, filePath);
  const displayPath = relativePath && !relativePath.startsWith(`..${path.sep}`) && relativePath !== '..'
    ? relativePath
    : path.basename(filePath);
  return displayPath.split(path.sep).join('/');
}

function updateRecentFiles(files, nextFile, limit = 40) {
  const nextFiles = files.filter((file) => file.path !== nextFile.path);
  nextFiles.push(nextFile);
  return nextFiles.slice(-limit);
}

function sanitizeConversionError(line) {
  return line.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function conversionFailureMessage({ files = [], errors = [] } = {}) {
  const failedPaths = files
    .filter((file) => file.status === 'failed')
    .map((file) => file.path);
  if (failedPaths.length) {
    const visiblePaths = failedPaths.slice(0, 3);
    const remaining = failedPaths.length - visiblePaths.length;
    return `Не удалось конвертировать: ${visiblePaths.join(', ')}${remaining > 0 ? ` и ещё ${remaining}` : ''}; проблемные оригиналы сохранены`;
  }
  return errors.at(-1) || 'Не удалось конвертировать все снимки; оригиналы сохранены';
}

module.exports = {
  conversionFailureMessage,
  displayConversionPath,
  parseConversionProtocolLine,
  sanitizeConversionError,
  updateRecentFiles
};
