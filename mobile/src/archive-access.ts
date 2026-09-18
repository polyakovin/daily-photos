export const DEFAULT_ARCHIVE_ACCESS_TIMEOUT_MS = 12_000;

export class ArchiveAccessTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super('iCloud не ответил вовремя. Проверьте сеть, скачайте папку в «Файлах» и повторите.');
    this.name = 'ArchiveAccessTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export function archiveAccessErrorMessage(error: unknown): string {
  const fallback = 'Не удалось прочитать выбранную папку';
  const rawMessage = error instanceof Error && error.message
    ? error.message
    : typeof error === 'string' && error.trim()
      ? error
      : fallback;
  const message = rawMessage
    .replace(/^(?:Error:\s*)?UnexpectedException:\s*/i, '')
    .replace(/\s+\(at ExpoModulesCore\/AsyncFunctionDefinition\.swift:\d+\)\s*$/i, '')
    .trim();
  return message || fallback;
}

export function withArchiveAccessTimeout<T>(
  load: () => Promise<T>,
  timeoutMs = DEFAULT_ARCHIVE_ACCESS_TIMEOUT_MS
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new TypeError('Archive access timeout must be positive'));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new ArchiveAccessTimeoutError(timeoutMs)));
    }, timeoutMs);

    Promise.resolve()
      .then(load)
      .then(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error))
      );
  });
}
