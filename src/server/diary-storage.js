const fs = require('node:fs');
const path = require('node:path');

const MAX_DIARY_CONTENT_LENGTH = 500_000;
const DATE_KEY_PATTERN = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function isValidDiaryDate(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function diaryFilePath(diaryRoot, date) {
  if (!isValidDiaryDate(date)) throw new RangeError('Дата должна быть в формате ГГГГ-ММ-ДД');
  return path.join(diaryRoot, `${date.replaceAll('-', '.')}.md`);
}

function writeDiaryEntry(diaryRoot, date, content) {
  if (typeof content !== 'string') throw new TypeError('Поле content должно содержать текст');
  if (!content.trim()) throw new RangeError('Введите текст заметки');
  if (content.length > MAX_DIARY_CONTENT_LENGTH) {
    throw new RangeError('Заметка слишком большая');
  }

  const target = diaryFilePath(diaryRoot, date);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.mkdirSync(diaryRoot, { recursive: true });
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
  return { date, content };
}

function deleteDiaryEntry(diaryRoot, date) {
  const target = diaryFilePath(diaryRoot, date);
  try {
    fs.unlinkSync(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { date, deleted: true };
}

module.exports = {
  MAX_DIARY_CONTENT_LENGTH,
  deleteDiaryEntry,
  diaryFilePath,
  isValidDiaryDate,
  writeDiaryEntry
};
