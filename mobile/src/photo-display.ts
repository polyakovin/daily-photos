export const DEFAULT_PREVIEW_TIMEOUT_MS = 8_000;
export const DEFAULT_DISPLAY_TIMEOUT_MS = 15_000;

export type PhotoLoadKind = 'preview' | 'display';

export class PhotoLoadTimeoutError extends Error {
  kind: PhotoLoadKind;
  timeoutMs: number;

  constructor(kind: PhotoLoadKind, timeoutMs: number) {
    super(
      kind === 'preview'
        ? 'Превью фотографии не загрузилось вовремя'
        : 'Фотография не загрузилась вовремя'
    );
    this.name = 'PhotoLoadTimeoutError';
    this.kind = kind;
    this.timeoutMs = timeoutMs;
  }
}

type PreviewPhotoModule = {
  getPreview?: (uri: string, cacheKey: string) => Promise<string>;
};

export type DisplayPhotoModule = {
  getDisplayUri?: (uri: string, cacheKey: string) => Promise<string>;
};

function withPhotoLoadTimeout<T>(
  load: () => Promise<T>,
  kind: PhotoLoadKind,
  timeoutMs: number
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new TypeError('Photo loading timeout must be positive'));
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
      finish(() => reject(new PhotoLoadTimeoutError(kind, timeoutMs)));
    }, timeoutMs);

    Promise.resolve()
      .then(load)
      .then(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error))
      );
  });
}

export function loadPhotoPreview(
  nativeModule: PreviewPhotoModule,
  uri: string,
  cacheKey: string,
  timeoutMs = DEFAULT_PREVIEW_TIMEOUT_MS
): Promise<string> {
  if (typeof nativeModule.getPreview !== 'function') {
    return Promise.reject(new Error('Нативный модуль превью фотографий требует пересборки'));
  }
  return withPhotoLoadTimeout(
    () => nativeModule.getPreview!(uri, cacheKey),
    'preview',
    timeoutMs
  );
}

export function loadDisplayPhoto(
  nativeModule: DisplayPhotoModule,
  uri: string,
  cacheKey: string,
  timeoutMs = DEFAULT_DISPLAY_TIMEOUT_MS
): Promise<string> {
  if (typeof nativeModule.getDisplayUri !== 'function') {
    return Promise.reject(new Error('Нативный модуль просмотра фотографий требует пересборки'));
  }
  return withPhotoLoadTimeout(
    () => nativeModule.getDisplayUri!(uri, cacheKey),
    'display',
    timeoutMs
  );
}
