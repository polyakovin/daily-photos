import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../modules/photo-archive/ios/PhotoArchiveModule.swift', import.meta.url),
  'utf8'
);

test('activates an iOS security-scoped URL before saving its bookmark', () => {
  const storeFunction = source.slice(
    source.indexOf('private func storeAndActivate'),
    source.indexOf('private func restoreActiveRoot')
  );
  assert.ok(storeFunction.indexOf('try activate(url)') < storeFunction.indexOf('url.bookmarkData('));
});

test('coordinates reads from the selected iCloud directory', () => {
  assert.match(source, /NSFileCoordinator\(\)\.coordinate\(/);
  assert.match(source, /self\.enumeratePhotos\(coordinatedRoot, items: items\)/);
});

test('reads lightweight viewer metadata without coordinating the entire iCloud archive', () => {
  const metadataFunction = source.slice(
    source.indexOf('private func readViewerMetadata'),
    source.indexOf('private func validDate')
  );
  assert.doesNotMatch(metadataFunction, /coordinatedRead\(root\)/);
  assert.match(metadataFunction, /photo_locations\.json/);
  assert.match(metadataFunction, /period_photo_selections\.json/);
});

test('rejects a selected directory when iOS does not grant security scope', () => {
  assert.match(source, /guard url\.startAccessingSecurityScopedResource\(\) else/);
});
