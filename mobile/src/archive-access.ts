export const DEFAULT_ARCHIVE_ACCESS_TIMEOUT_MS = 12_000;

export class ArchiveAccessTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super('iCloud не ответил вовремя. Проверьте сеть, скачайте папку в «Файлах» и повторите.');
    this.name = 'ArchiveAccessTimeoutError';
    this.timeoutMs = timeoutMs;
  }
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
