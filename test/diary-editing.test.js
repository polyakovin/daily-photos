const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startPhotoDayServer } = require('../src/server');

async function createServer(t, mode = 'folder') {
  const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'photo-day-diary-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const stateRoot = path.join(temporaryRoot, 'state');
  await fs.promises.mkdir(archiveRoot, { recursive: true });

  let server;
  t.after(async () => {
    await server?.close();
    await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
  });
  server = await startPhotoDayServer({
    contentRoot: archiveRoot,
    stateRoot,
    convertImages: false,
    metadataIndex: true,
    mode,
    roots: [archiveRoot],
    port: 0
  });
  return { archiveRoot, server };
}

test('viewer diary saves, updates and deletes a portable Markdown entry', async (t) => {
  const { archiveRoot, server } = await createServer(t);
  const entryUrl = `${server.url}/api/diary/2024-07-21`;
  const initialContent = '# Воскресенье\n\n- Прогулка\n- **Тёплый вечер**\n';

  const createResponse = await fetch(entryUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: initialContent })
  });

  assert.equal(createResponse.status, 200);
  assert.deepEqual(await createResponse.json(), {
    date: '2024-07-21',
    content: initialContent
  });
  assert.equal(
    await fs.promises.readFile(path.join(archiveRoot, '_diary', '2024.07.21.md'), 'utf8'),
    initialContent
  );
  assert.deepEqual(await fetch(`${server.url}/api/diary`).then((response) => response.json()), [{
    date: '2024-07-21',
    content: initialContent
  }]);

  const updatedContent = 'Обычный абзац с `кодом`.\n';
  const updateResponse = await fetch(entryUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: updatedContent })
  });
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(await updateResponse.json(), {
    date: '2024-07-21',
    content: updatedContent
  });

  const deleteResponse = await fetch(entryUrl, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(await deleteResponse.json(), { date: '2024-07-21', deleted: true });
  await assert.rejects(
    fs.promises.stat(path.join(archiveRoot, '_diary', '2024.07.21.md')),
    { code: 'ENOENT' }
  );
  assert.deepEqual(await fetch(`${server.url}/api/diary`).then((response) => response.json()), []);
});

test('viewer diary rejects invalid dates and automatic computer search', async (t) => {
  const computer = await createServer(t, 'computer');
  const invalidResponse = await fetch(`${computer.server.url}/api/diary/2024-02-31`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Не должно сохраниться' })
  });
  assert.equal(invalidResponse.status, 400);

  const unavailableResponse = await fetch(`${computer.server.url}/api/diary/2024-07-21`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Некуда сохранить' })
  });
  assert.equal(unavailableResponse.status, 409);
  assert.deepEqual(await unavailableResponse.json(), {
    error: 'Заметки доступны только при работе с выбранной папкой'
  });
});
