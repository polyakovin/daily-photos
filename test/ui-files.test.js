const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startPhotoDayServer } = require('../src/server');

test('десктопный сервер отдаёт вспомогательные UI-скрипты', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-ui-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const stateRoot = path.join(temporaryRoot, 'state');
  fs.mkdirSync(archiveRoot, { recursive: true });

  let server = null;
  t.after(async () => {
    await server?.close();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  server = await startPhotoDayServer({
    contentRoot: archiveRoot,
    stateRoot,
    convertImages: false,
    metadataIndex: true,
    mode: 'folder',
    roots: [archiveRoot],
    port: 0
  });

  const response = await fetch(`${server.url}/theme.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/javascript/);
  assert.match(await response.text(), /photo-day:color-theme/);

  const viewStateResponse = await fetch(`${server.url}/view-state.js`);
  assert.equal(viewStateResponse.status, 200);
  assert.match(viewStateResponse.headers.get('content-type'), /^text\/javascript/);
  assert.match(await viewStateResponse.text(), /photo-day:view-state/);

  const importDateResponse = await fetch(`${server.url}/photo-import-date.js`);
  assert.equal(importDateResponse.status, 200);
  assert.match(importDateResponse.headers.get('content-type'), /^text\/javascript/);
  assert.match(await importDateResponse.text(), /suggestCalendarImportDate/);
});
