import assert from 'node:assert/strict';
import test from 'node:test';
import { saveDiaryEntry } from '../src/diary.ts';

test('saves a standalone entry for a day without a photograph', async () => {
  const writes: Array<[string, string | null]> = [];
  const entry = await saveDiaryEntry('12.08.2024', '# Прогулка\n\nТекст дня', async (date, content) => {
    writes.push([date, content]);
  });
  assert.deepEqual(writes, [['2024-08-12', '# Прогулка\n\nТекст дня']]);
  assert.deepEqual(entry, { date: '2024-08-12', content: '# Прогулка\n\nТекст дня' });
});

test('invalid dates and blank drafts never write to the archive', async () => {
  let writes = 0;
  const write = async () => { writes += 1; };
  await assert.rejects(saveDiaryEntry('31.02.2024', 'Текст', write), /дату/);
  await assert.rejects(saveDiaryEntry('2024-08-12', ' \n ', write), /текст/);
  assert.equal(writes, 0);
});

test('reports storage failures without returning a saved entry', async () => {
  await assert.rejects(saveDiaryEntry('2024-08-12', 'Текст', async () => {
    throw new Error('Архив недоступен');
  }), /Архив недоступен/);
});

test('deletes an entry explicitly rather than treating blank text as deletion', async () => {
  const writes: Array<[string, string | null]> = [];
  assert.deepEqual(await saveDiaryEntry('2024-08-12', null, async (date, content) => {
    writes.push([date, content]);
  }), { date: '2024-08-12', content: null });
  assert.deepEqual(writes, [['2024-08-12', null]]);
});
