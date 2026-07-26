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

  const mapResponse = await fetch(`${server.url}/map.js`);
  assert.equal(mapResponse.status, 200);
  assert.match(mapResponse.headers.get('content-type'), /^text\/javascript/);
  const mapScript = await mapResponse.text();
  assert.match(mapScript, /InteractiveMap/);
  assert.match(mapScript, /parseCoordinateQuery/);

  const appResponse = await fetch(`${server.url}/app.html`);
  assert.equal(appResponse.status, 200);
  const appHtml = await appResponse.text();
  assert.match(appHtml, /id="mapSearch"/);
  assert.match(appHtml, /id="mapAddPlaceButton"/);
  assert.match(appHtml, /id="mapPlaceEditor"/);
  assert.match(appHtml, /id="mapPlaceAttachPhoto"/);
  assert.match(appHtml, /id="mapPhotoChoosePlace"/);
  assert.match(appHtml, /id="mapAssignmentPreview"/);
  assert.match(appHtml, /id="mapAssignmentPreview"[\s\S]*?<img id="mapAssignmentImage"[^>]*\/>\s*<\/button>/);
  assert.match(appHtml, /id="mapAssignmentOpenPhoto"/);
  assert.match(appHtml, /id="mapAssignmentChoosePlace"/);
  assert.match(appHtml, /id="mapPointDelete"/);
  assert.match(appHtml, /id="mapPhotoPickerDialog"/);
  assert.match(appHtml, /id="mapPlacePickerDialog"/);
  assert.match(appHtml, /id="viewerLocationSearch"/);
  assert.match(appHtml, /id="viewerDateEdit"/);
  assert.match(appHtml, /id="viewerDateForm"/);
  assert.match(appHtml, /id="viewerDateInput" type="date" min="1900-01-01"/);

  const stylesResponse = await fetch(`${server.url}/styles.css`);
  assert.equal(stylesResponse.status, 200);
  const styles = await stylesResponse.text();
  assert.match(styles, /\.geo-map-hover-preview/);
  assert.match(styles, /\.geo-map-photo-fan/);
  assert.match(styles, /\.geo-map-marker\.has-photo-stack:hover \.geo-map-fan-photo/);
  assert.match(styles, /\.geo-map-fan-photo:hover/);
  assert.match(styles, /opacity:\s*0[\s\S]*?translate3d\(var\(--fan-x\),\s*var\(--fan-y\),\s*0\)/);
  assert.match(styles, /#mapPointDelete/);
  assert.match(styles, /\.map-place-picker-grid/);
  assert.match(styles, /\.map-place-picker-item\.is-empty/);
  assert.match(styles, /\.geo-map-selection::after[\s\S]*?top:\s*13px/);
  assert.match(styles, /\.map-photo-picker-grid/);
  assert.match(styles, /grid-template-rows:\s*auto auto auto auto auto minmax\(0,\s*1fr\)/);
  assert.match(styles, /grid-auto-rows:\s*max-content/);
  assert.match(styles, /\.map-place-editor/);
  assert.match(styles, /\.geo-map\.is-selecting-location/);
  assert.match(styles, /\.map-assignment[\s\S]*?width:\s*min\(272px,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.map-assignment-preview[\s\S]*?width:\s*100%[\s\S]*?aspect-ratio:\s*248\s*\/\s*184/);
  assert.doesNotMatch(styles, /\.map-assignment-preview\s*>\s*span/);
  assert.match(styles, /\.map-assignment-actions\s*\{\s*grid-column:\s*1/);

  const appScriptResponse = await fetch(`${server.url}/app.js`);
  assert.equal(appScriptResponse.status, 200);
  const appScript = await appScriptResponse.text();
  assert.match(appScript, /locationReferenceId/);
  assert.match(appScript, /linkPhotoToMapPlace/);
  assert.match(appScript, /saveMapPlace/);
  assert.match(appScript, /hidePhotoOnMap/);
  assert.match(appScript, /deleteActiveMapPoint/);
  assert.match(appScript, /mapPlacePickerCandidates/);
  assert.match(appScript, /linkSelectedPhotoToPlace/);
  assert.match(appScript, /openCurrentMapAssignmentPhoto/);
  assert.match(appScript, /mapAssignmentImageFallbackTimer/);
  assert.match(appScript, /mapAssignmentImage\.dataset\.fallbackSrc/);
  assert.match(appScript, /mapAssignmentSaving = false;\s*renderMapAssignment\(\)/);
  assert.match(appScript, /openMapFanPhoto/);
  assert.match(appScript, /onPhotoClick:\s*openMapFanPhoto/);
  assert.match(appScript, /changeViewerPhotoDate/);
  assert.match(appScript, /\/api\/photos\/\$\{photo\.id\}\/date/);

  assert.match(mapScript, /function photoStackPoints\(points\)/);
  assert.match(mapScript, /function photoFanLayout\(total,\s*index\)/);
  assert.match(mapScript, /className = 'geo-map-fan-photo'/);
  assert.match(mapScript, /return photos;/);
  assert.doesNotMatch(mapScript, /return photos\.slice/);
});
