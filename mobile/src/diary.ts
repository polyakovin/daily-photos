import { parseViewerDate } from './viewer.ts';

export async function saveDiaryEntry(
  value: string,
  content: string | null,
  write: (date: string, content: string | null) => Promise<void>
): Promise<{ date: string; content: string | null }> {
  const date = parseViewerDate(value);
  if (!date) throw new RangeError('Выберите корректную дату не позже сегодняшней');
  if (content !== null && !content.trim()) throw new RangeError('Введите текст записи');
  await write(date, content);
  return { date, content };
}
