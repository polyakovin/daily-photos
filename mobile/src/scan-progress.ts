import type { ArchiveScanProgress } from '../modules/photo-archive';

export function scanProgressRatio(progress: ArchiveScanProgress): number | null {
  if (progress.phase === 'complete') return 1;
  const totalItems = progress.totalItems || 0;
  if (progress.phase !== 'scanning' || totalItems <= 0) return null;
  return Math.max(0, Math.min(1, progress.scannedItems / totalItems));
}

export function scanProgressTitle(
  progress: ArchiveScanProgress | null,
  compact = false
): string {
  if (!progress || progress.phase === 'starting') return 'Открываем фотоархив…';
  if (progress.phase === 'counting') {
    return compact ? 'Считаем объекты архива' : 'Считаем объекты архива…';
  }
  if (progress.phase === 'complete') return 'Фотоархив прочитан';
  return compact ? 'Читаем фотоархив' : 'Читаем фотоархив…';
}

export function scanProgressDescription(progress: ArchiveScanProgress): string {
  if (progress.phase === 'counting') {
    return 'Определяем точный объём работы. Шкала появится после подсчёта.';
  }
  if (progress.totalItems && progress.totalItems > 0) {
    return `Обработано: ${progress.scannedItems.toLocaleString('ru-RU')} из ${progress.totalItems.toLocaleString('ru-RU')} · найдено фото: ${progress.foundPhotos.toLocaleString('ru-RU')}`;
  }
  if (progress.phase === 'complete') return 'Объектов архива не найдено.';
  return 'Подготавливаем точный подсчёт объектов архива.';
}
